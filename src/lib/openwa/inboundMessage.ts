import { prisma } from "@/lib/prisma";
import { matchLeadForInboundWhatsApp } from "./matchLead";

export type InboundResult =
  | { status: "logged"; leadId: string; ambiguous: boolean }
  | { status: "skipped"; reason: "duplicate" | "no-lead" | "from-us" | "empty" | "not-a-chat" };

/** One inbound WhatsApp message, as the gateway reports it. */
export type InboundMessage = {
  id: string | null;
  from: string | null;
  body: string | null;
  fromMe?: boolean | null;
  timestamp?: number | null;
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
export async function processInboundWhatsApp(msg: InboundMessage): Promise<InboundResult> {
  // Our own outgoing messages come back over the same stream. Logging them
  // would double-count every send and, worse, mark the LEAD as having reacted.
  if (msg.fromMe) return { status: "skipped", reason: "from-us" };

  const body = (msg.body ?? "").trim();
  if (!body) return { status: "skipped", reason: "empty" };

  const from = (msg.from ?? "").trim();
  // Only one-to-one chats. A group id ends in @g.us — the team announcement
  // group is one, and its traffic must never land on a customer's timeline.
  if (!from.endsWith("@c.us")) return { status: "skipped", reason: "not-a-chat" };

  // The gateway can deliver the same event more than once, and a retry must
  // not produce a second timeline entry. Same guard the email path uses.
  if (msg.id) {
    const already = await prisma.leadInteraction.findFirst({ where: { messageId: msg.id }, select: { id: true } });
    if (already) return { status: "skipped", reason: "duplicate" };
  }

  const match = await matchLeadForInboundWhatsApp(from.replace(/@c\.us$/, ""));
  // An unknown number is NOT an error: people message the business number who
  // are not leads. Dropped quietly rather than inventing a lead for them.
  if (!match) return { status: "skipped", reason: "no-lead" };

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
      metadata: { ...(match.ambiguous ? { ambiguousSenderMatch: true } : {}), via: "openwa-webhook" },
    },
  });

  return { status: "logged", leadId: match.leadId, ambiguous: match.ambiguous };
}
