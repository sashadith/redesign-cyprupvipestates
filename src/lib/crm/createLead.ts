// One creation path for manually entered leads — extracted from
// admin/actions.ts's createLead (the "New lead" form), which now calls this,
// so the MCP connector's crm_create_lead writes exactly the rows the form
// writes: the Lead with source MANUAL, a CREATED activity row and a SYSTEM
// timeline row naming who created it. The form's own validation (required
// first name, email format, assignee exists) stays in the caller; this only
// persists. findDuplicateLead is the connector's guard against "leg mal X an"
// creating the same person twice — the admin form never had one because a
// human sees the list while typing.
import { prisma } from "@/lib/prisma";
import type { EmailActor } from "./sendLeadEmail";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import { emailKey, phoneDigits, phonesMatch, MIN_PHONE_DIGITS, PHONE_SUFFIX_DIGITS } from "./leadIdentity";

export type CreateLeadData = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  languagePreference?: "en" | "de" | "pl" | "ru" | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  timeline?: "IMMEDIATE" | "THREE_MONTHS" | "SIX_MONTHS" | "ONE_YEAR" | "TWO_YEARS" | "JUST_LOOKING" | null;
  financing?: "CASH" | "MORTGAGE" | "UNDECIDED" | null;
  propertyTypeInterest?: string[];
  message?: string | null;
  notes?: string | null;
  status?: "NEW" | "CONTACTED" | "COMMUNICATING" | "VIEWING_SCHEDULED" | "OFFER" | "KEEP_CONTACT" | "CLOSED" | "LOST";
  assignedToId?: string | null;
  via?: "mcp";
};

export type DuplicateLead = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string; matchedOn: "email" | "phone" };

/** An active (not deleted, not newsletter) lead with the same email or phone.
 *  Best-effort check-then-act guard (no unique constraint backs it): two
 *  simultaneous creates could both pass — acceptable for a single operator
 *  behind the per-token rate limit. */
export async function findDuplicateLead(email: string | null | undefined, phone: string | null | undefined): Promise<DuplicateLead | null> {
  const select = { id: true, firstName: true, lastName: true, email: true, phone: true, status: true };
  const key = emailKey(email);
  if (key) {
    const domain = key.slice(key.lastIndexOf("@") + 1);
    // Gmail addresses need the dot/domain-insensitive comparison, so pull the
    // gmail candidates and compare canonical keys in memory; everything else
    // is a case-insensitive exact match.
    const candidates =
      domain === "gmail.com"
        ? await prisma.lead.findMany({
            where: { deletedAt: null, ...EXCLUDE_NEWSLETTER, OR: [{ email: { endsWith: "@gmail.com", mode: "insensitive" } }, { email: { endsWith: "@googlemail.com", mode: "insensitive" } }] },
            select,
          })
        : await prisma.lead.findMany({ where: { deletedAt: null, ...EXCLUDE_NEWSLETTER, email: { equals: key, mode: "insensitive" } }, select });
    const hit = candidates.find((c) => emailKey(c.email) === key);
    if (hit) return { ...hit, matchedOn: "email" };
  }
  const digits = phoneDigits(phone);
  if (digits.length >= MIN_PHONE_DIGITS) {
    // Stored phones keep the lead's punctuation; normalise on the DB side and
    // pre-filter on the suffix, then let phonesMatch apply the exact rule.
    const suffix = digits.slice(-PHONE_SUFFIX_DIGITS);
    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM leads WHERE phone IS NOT NULL AND "deletedAt" IS NULL AND source <> 'NEWSLETTER' AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${suffix}`}`;
    if (rows.length) {
      const candidates = await prisma.lead.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select });
      const hit = candidates.find((c) => phonesMatch(c.phone, phone));
      if (hit) return { ...hit, matchedOn: "phone" };
    }
  }
  return null;
}

export async function createLeadRecord(actor: EmailActor, data: CreateLeadData): Promise<{ id: string }> {
  const lead = await prisma.lead.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: (data.lastName ?? "").trim(),
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone?.trim() || null,
      nationality: data.nationality?.trim() || null,
      languagePreference: data.languagePreference ?? null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      timeline: data.timeline ?? null,
      financing: data.financing ?? null,
      propertyTypeInterest: data.propertyTypeInterest ?? [],
      message: data.message?.trim() || null,
      notes: data.notes?.trim() || null,
      source: "MANUAL",
      status: data.status ?? "NEW",
      assignedToId: data.assignedToId ?? null,
    },
    select: { id: true },
  });
  const body = data.via === "mcp" ? "Lead created via Claude" : "Lead created manually";
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "CREATED", content: body, createdBy: actor.userName, createdById: actor.userId },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId: lead.id,
      type: "SYSTEM",
      channel: "SYSTEM",
      body,
      createdByUserId: actor.userId,
      createdByName: actor.userName,
      ...(data.via ? { metadata: { via: data.via } } : {}),
    },
  });
  return { id: lead.id };
}
