import { prisma } from "@/lib/prisma";
import { toMsisdn } from "./phoneMatch";

export type WhatsAppLeadMatch = { leadId: string; ambiguous: boolean };

/**
 * Which lead an inbound WhatsApp message belongs to.
 *
 * The counterpart to phoneMatch.ts, which only ever goes lead → chatId and
 * warns against fuzzy matching because a wrong match there sends a message to
 * a stranger. This direction is a real join, so the rule is stricter, not
 * looser: the FULL normalised MSISDN must be equal. No last-N-digits
 * comparison — "+357 99 278285" and "+44 7999 278285" share nine digits and
 * are different people.
 *
 * Measured against production 2026-10-17 before choosing this: of 170 leads
 * with a phone number, all 170 carry a country code, 169 normalise to distinct
 * MSISDNs, none is shared between two leads, and exactly one is too short to
 * use. Exact matching is therefore not a limitation here, it is sufficient.
 *
 * `ambiguous` exists anyway, mirroring matchLeadForInboundEmail: two leads CAN
 * come to share a number later (a couple, a company line), and when they do the
 * message should still land — on the most recently active lead — with the
 * timeline saying it was ambiguous rather than silently picking one.
 */
export async function matchLeadForInboundWhatsApp(fromMsisdn: string): Promise<WhatsAppLeadMatch | null> {
  const wanted = toMsisdn(fromMsisdn);
  if (!wanted) return null;

  // Phones are stored as humans typed them ("+971 56 342 8755"), so the
  // comparison has to happen on normalised values rather than in SQL.
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, phone: { not: null } },
    select: { id: true, phone: true, createdAt: true, interactions: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 } },
  });

  const hits = leads.filter((l) => toMsisdn(l.phone) === wanted);
  if (hits.length === 0) return null;
  if (hits.length === 1) return { leadId: hits[0].id, ambiguous: false };

  // Same tie-break as the email path: most recent interaction, else most
  // recently created.
  const rank = (l: (typeof hits)[number]) => (l.interactions[0]?.occurredAt ?? l.createdAt).getTime();
  const best = hits.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  return { leadId: best.id, ambiguous: true };
}
