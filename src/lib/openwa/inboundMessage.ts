import { prisma } from "@/lib/prisma";
import { matchLeadForInboundWhatsApp } from "./matchLead";
import { toMsisdn } from "./phoneMatch";
import { parseSiteButtonMessage } from "./siteButtonMessage";
import { createLeadFromButtonMessage } from "./buttonLead";

export type InboundResult =
  | { status: "logged"; leadId: string; ambiguous: boolean }
  | { status: "lead-created"; leadId: string }
  | { status: "skipped"; reason: "duplicate" | "no-lead" | "from-us" | "empty" | "not-a-chat" | "unresolved-lid" };

/** One inbound WhatsApp message, as the gateway reports it. */
export type InboundMessage = {
  id: string | null;
  from: string | null;
  body: string | null;
  fromMe?: boolean | null;
  timestamp?: number | null;
  /** The gateway's own phone lookup for an …@lid sender, when it managed one. */
  senderPhone?: string | null;
  /** The sender's WhatsApp display name. */
  pushName?: string | null;
};

export type InboundDeps = {
  /** Asks the gateway for the number behind an …@lid. */
  resolvePhone?: (contactId: string) => Promise<string | null>;
};

/**
 * Record an inbound WhatsApp message on its lead's timeline.
 *
 * Why this exists: WHATSAPP_IN was declared in the schema and, as the comment
 * in crm/interactionHelpers.ts said, "not written anywhere yet". No webhook
 * was ever registered with the gateway, so nothing recorded a single customer
 * reply. Measured 2026-10-17: 59 leads had been messaged, 13 had a reply on
 * file, and all 14 inbound rows in the database had been typed in by hand.
 *
 * That is not a cosmetic gap. WHATSAPP_IN carries forcesLeadReacted (see
 * logInteraction.ts), which resets the follow-up cadence, and the Action
 * Center counts it as a real contact. A lead who answered and was never
 * recorded keeps surfacing as "no reply, chase them".
 *
 * Deliberately mirrors emailInbound/processInbound.ts rather than inventing a
 * second shape: same INBOUND/channel fields, same messageId idempotency, same
 * `ambiguous` flag in metadata. Two inbound paths that drift apart are two
 * things to debug.
 */
export async function processInboundWhatsApp(msg: InboundMessage, deps: InboundDeps = {}): Promise<InboundResult> {
  // Our own outgoing messages come back over the same stream. Logging them
  // would double-count every send and, worse, mark the LEAD as having reacted.
  if (msg.fromMe) return { status: "skipped", reason: "from-us" };

  const body = (msg.body ?? "").trim();
  if (!body) return { status: "skipped", reason: "empty" };

  const from = (msg.from ?? "").trim();
  // Only one-to-one chats. A group id ends in @g.us — the team announcement
  // group is one, and its traffic must never land on a customer's timeline.
  //
  // A one-to-one sender is either a phone (…@c.us) or a privacy id (…@lid)
  // that WhatsApp uses instead of the number, often for first contacts. Those
  // were dropped as "not-a-chat" until 2026-10-18, which lost exactly the
  // website-button enquiries (lead V, La Mer). The gateway's inline lookup
  // comes first, then an explicit one; no number means no match, never a guess.
  let msisdn: string | null;
  if (from.endsWith("@c.us")) {
    msisdn = toMsisdn(from.replace(/@c\.us$/, ""));
  } else if (from.endsWith("@lid")) {
    msisdn = toMsisdn(msg.senderPhone) ?? toMsisdn(await deps.resolvePhone?.(from).catch(() => null));
    if (!msisdn) return { status: "skipped", reason: "unresolved-lid" };
  } else {
    return { status: "skipped", reason: "not-a-chat" };
  }
  if (!msisdn) return { status: "skipped", reason: "no-lead" };

  // The gateway can deliver the same event more than once, and a retry must
  // not produce a second timeline entry. Same guard the email path uses.
  if (msg.id) {
    const already = await prisma.leadInteraction.findFirst({ where: { messageId: msg.id }, select: { id: true } });
    if (already) return { status: "skipped", reason: "duplicate" };
  }

  const match = await matchLeadForInboundWhatsApp(msisdn);
  if (!match) {
    // An unknown number is NOT an error: people message the business number
    // who are not leads, and they are dropped quietly. The one exception is
    // the text the site's WhatsApp button pre-fills — that is an enquiry.
    const site = parseSiteButtonMessage(body);
    if (!site) return { status: "skipped", reason: "no-lead" };
    const created = await createLeadFromButtonMessage({
      messageId: msg.id,
      msisdn,
      from,
      pushName: msg.pushName ?? null,
      body,
      occurredAt: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
      site,
    });
    if (created.status === "duplicate") return { status: "skipped", reason: "duplicate" };
    if (created.status === "attached") return { status: "logged", leadId: created.leadId, ambiguous: false };
    return { status: "lead-created", leadId: created.leadId };
  }

  await prisma.leadInteraction.create({
    data: {
      leadId: match.leadId,
      type: "WHATSAPP_IN",
      direction: "INBOUND",
      channel: "WHATSAPP",
      body: body.slice(0, 8000),
      // The gateway timestamp is seconds, not milliseconds.
      occurredAt: msg.timestamp ? new Date(msg.timestamp * 1000) : new Date(),
      messageId: msg.id,
      metadata: { ...(match.ambiguous ? { ambiguousSenderMatch: true } : {}), via: "openwa-webhook", ...(from.endsWith("@lid") ? { from } : {}) },
    },
  });

  return { status: "logged", leadId: match.leadId, ambiguous: match.ambiguous };
}
