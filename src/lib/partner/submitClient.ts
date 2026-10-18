// Server side of a partner client submission (partner portal phase 3b, decision 2).
// Kept apart from the pure validator in submission.ts so client components can import that
// module's constants without pulling Prisma along.
//
// The partner's answer never differs between a new lead and a review of a known contact:
// both return RECEIVED. Only "you already hold this client" is said out loud.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findDuplicateLead } from "@/lib/crm/createLead";
import { sendTelegramMessage } from "@/lib/telegram";
import { inBackground } from "./accounts";
import { decideSubmission } from "./claims";
import type { PartnerSessionInfo } from "./session";
import type { SubmissionInput } from "./submission";
import {
  alreadyYoursAnswer, buildPartnerClientNotice, claimSubmissionJson, clientDisplayName, leadDataFromSubmission, partnerDisplayName,
  partnerSubmissionNote, type PartnerClientNotice,
} from "./submitFlow";

export type SubmitOutcome = { kind: "RECEIVED" } | { kind: "ALREADY_YOURS" } | { kind: "PROJECT_UNAVAILABLE" };

type Partner = PartnerSessionInfo["partner"];

/** The chosen projects, published only, in the order the partner picked them; null if any id is not offered. */
async function loadProjects(ids: string[]): Promise<{ id: string; name: string }[] | null> {
  if (!ids.length) return [];
  const rows = await prisma.development.findMany({
    where: { id: { in: ids }, publishStatus: "published" },
    select: { id: true, publicName: true, override: { select: { alias: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id.toLowerCase(), { id: r.id, name: r.override?.alias?.trim() || r.publicName }]));
  const out = ids.map((id) => byId.get(id.toLowerCase()));
  return out.every((p): p is { id: string; name: string } => !!p) ? out : null;
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Claim IN_REVIEW on a known lead — unless this partner already has one there (then nothing new). */
async function reviewClaim(partner: Partner, leadId: string, input: SubmissionInput, projects: { id: string; name: string }[]): Promise<boolean> {
  const existing = await prisma.partnerClaim.findFirst({
    where: { partnerId: partner.id, leadId, state: { in: ["IN_REVIEW", "ACTIVE"] } },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.partnerClaim.create({
    data: {
      leadId, partnerId: partner.id, state: "IN_REVIEW", mode: input.mode, contactMode: input.contactMode,
      submission: claimSubmissionJson(input, projects),
    },
  });
  return true;
}

async function createLeadWithClaim(partner: Partner, input: SubmissionInput, projects: { id: string; name: string }[]): Promise<string> {
  const note = partnerSubmissionNote(partner, input.mode);
  const actorName = `${partnerDisplayName(partner)} (partner)`;
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({ data: leadDataFromSubmission(input, partner, projects.map((p) => p.name)), select: { id: true } });
    const claim = await tx.partnerClaim.create({
      data: {
        leadId: lead.id, partnerId: partner.id, state: "ACTIVE", mode: input.mode, contactMode: input.contactMode,
        submission: claimSubmissionJson(input, projects),
      },
      select: { id: true },
    });
    // createdById / createdByUserId reference staff users; a partner is not one, so only the name snapshot.
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "CREATED", content: note, createdBy: actorName } });
    await tx.leadInteraction.create({
      data: {
        leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", body: note, createdByName: actorName,
        metadata: { via: "partner-portal", partnerId: partner.id, claimId: claim.id },
      },
    });
    return lead.id;
  });
}

function notifyOffice(partner: Partner, input: SubmissionInput, outcome: { outcome: "CREATED"; leadId: string } | { outcome: "REVIEW" }) {
  const notice: PartnerClientNotice = {
    clientName: clientDisplayName(input),
    partnerName: partnerDisplayName(partner),
    mode: input.mode,
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
    ...outcome,
  };
  inBackground("client submission notice", sendTelegramMessage(buildPartnerClientNotice(notice)));
}

/** Caller has validated the input and checked requirePartner({ active: true }) + throttles. */
export async function submitClient(me: PartnerSessionInfo, input: SubmissionInput): Promise<SubmitOutcome> {
  const partner = me.partner;
  if (partner.status !== "ACTIVE") throw new Error("submitClient: partner not active");
  const projects = await loadProjects(input.projectIds);
  if (!projects) return { kind: "PROJECT_UNAVAILABLE" };

  const review = async (leadId: string): Promise<SubmitOutcome> => {
    if (await reviewClaim(partner, leadId, input, projects)) notifyOffice(partner, input, { outcome: "REVIEW" });
    return { kind: "RECEIVED" };
  };

  const dup = await findDuplicateLead(input.email, input.phone);
  const mine = dup
    ? await prisma.partnerClaim.findMany({ where: { partnerId: partner.id, leadId: dup.id, state: "ACTIVE" }, select: { leadId: true } })
    : [];
  const decision = decideSubmission({ duplicate: dup ? { leadId: dup.id } : null, myActiveClaimLeadIds: mine.map((c) => c.leadId) });
  if (decision.kind === "ALREADY_YOURS") {
    // Only a full identifier match may say so; a partial match writes nothing and answers neutrally.
    return dup && alreadyYoursAnswer(input, dup) === "ALREADY_YOURS" ? { kind: "ALREADY_YOURS" } : { kind: "RECEIVED" };
  }
  // CREATE (transaction + more writes) and REVIEW (one claim row) take slightly different time;
  // that small timing difference is accepted — the answer itself is identical.
  if (decision.kind === "REVIEW") return review(decision.leadId);

  let leadId: string;
  try {
    leadId = await createLeadWithClaim(partner, input, projects);
  } catch (e) {
    // Backstop: the partial unique index (one ACTIVE claim per lead) cannot fire on a brand-new
    // lead; if a unique violation still happens, a concurrent request created this contact —
    // treat it like any known contact and send it to review.
    if (!isUniqueViolation(e)) throw e;
    const again = await findDuplicateLead(input.email, input.phone);
    if (!again) throw e;
    return review(again.id);
  }
  notifyOffice(partner, input, { outcome: "CREATED", leadId });
  return { kind: "RECEIVED" };
}
