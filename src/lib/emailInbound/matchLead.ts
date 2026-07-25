import { prisma } from "@/lib/prisma";

export type LeadMatch = { leadId: string; ambiguous: boolean };

// Gmail-aware canonicalization — gmail.com and googlemail.com are the same
// mailbox, and Gmail ignores dots in the local part (e.g. "sascha.dith" and
// "saschadith" both deliver to the same inbox). Both quirks are unique to
// Google's own mail handling — dots ARE significant on virtually every other
// provider, so this is only applied when the domain is actually a Gmail one,
// never as a general rule. Caught before it could cause a real, confusing
// "the code is right but the fallback silently failed" debugging session —
// see the conversation this was flagged in.
const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
function canonicalizeEmail(e: string | null | undefined): string {
  const trimmed = (e ?? "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at === -1) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!GMAIL_DOMAINS.has(domain)) return trimmed;
  return `${local.replace(/\./g, "")}@gmail.com`;
}

/**
 * Primary: walk In-Reply-To then References (in that order — References is
 * the full ancestor chain, so a multi-hop thread still resolves even when
 * the immediate parent isn't one of our own sends) against stored
 * LeadInteraction.messageId values. First hit wins, unambiguous.
 *
 * Fallback: normalized sender-address match against Lead.email (Gmail-aware
 * canonicalization — see above — plus trim+lowercase, same base as the
 * existing duplicate-lead detection). Multiple leads sharing that address →
 * assign to the one with the most recent interaction (or most recently
 * created, if neither has any yet), flagged ambiguous so the timeline entry
 * can note it.
 */
export async function matchLeadForInboundEmail(opts: {
  inReplyTo: string | null;
  references: string[];
  fromAddress: string;
}): Promise<LeadMatch | null> {
  const candidateIds = [opts.inReplyTo, ...opts.references].filter((id): id is string => !!id);
  for (const messageId of candidateIds) {
    const hit = await prisma.leadInteraction.findFirst({ where: { messageId }, select: { leadId: true } });
    if (hit) return { leadId: hit.leadId, ambiguous: false };
  }

  const canonicalSender = canonicalizeEmail(opts.fromAddress);
  if (!canonicalSender) return null;

  // Dot/domain-alias canonicalization can't be expressed as a Postgres
  // WHERE filter, so compare in JS — same tradeoff the existing duplicate-
  // lead detection already makes for this table (small, "low hundreds").
  const allLeads = await prisma.lead.findMany({ where: { deletedAt: null }, select: { id: true, email: true, createdAt: true } });
  const leads = allLeads.filter((l) => canonicalizeEmail(l.email) === canonicalSender);
  if (leads.length === 0) return null;
  if (leads.length === 1) return { leadId: leads[0].id, ambiguous: false };

  // Multiple leads share this address — pick the most recently contacted one.
  const mostRecentInteraction = await prisma.leadInteraction.findFirst({
    where: { leadId: { in: leads.map((l) => l.id) } },
    orderBy: { occurredAt: "desc" },
    select: { leadId: true },
  });
  if (mostRecentInteraction) return { leadId: mostRecentInteraction.leadId, ambiguous: true };

  const mostRecentlyCreated = leads.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return { leadId: mostRecentlyCreated.id, ambiguous: true };
}
