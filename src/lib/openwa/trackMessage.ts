import type { LeadInteractionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyFollowUpCadence } from "@/lib/crm/followUpCadence";
import { matchLeadForInboundWhatsApp, type WhatsAppLeadMatch } from "./matchLead";
import { toMsisdn } from "./phoneMatch";

/**
 * WhatsApp messages of the business number → the lead's timeline, both directions (2026-10-29).
 *
 * Replaces the inbound-only processInboundWhatsApp. Two things changed since that was written:
 *
 * 1. WhatsApp now names private chats by privacy id ("…@lid") instead of "<phone>@c.us". The old
 *    `from.endsWith("@c.us")` guard therefore dropped EVERY customer message as "not-a-chat": the
 *    gateway held 646 incoming private messages for the 14 days before 2026-10-29, the CRM recorded
 *    none. A lid is resolved to the phone number through the gateway before matching.
 * 2. The operator's own messages (typed on the phone, on the same number) count as contact. They
 *    arrive as `message.sent` / fromMe and are recorded as WHATSAPP_OUT. A message the CRM itself
 *    sent is already on the timeline without a WhatsApp id; the echo links that row instead of
 *    adding a second one.
 *
 * Group chats and status broadcasts never reach a customer's timeline.
 */

export type WaMessage = {
  id: string | null;
  from: string | null;
  to?: string | null;
  chatId?: string | null;
  body: string | null;
  type?: string | null;
  fromMe?: boolean | null;
  /** Seconds (the gateway's unit). */
  timestamp?: number | null;
  isGroup?: boolean | null;
  /** The gateway's own lid → phone resolution for an inbound sender, when it has one. */
  senderPhone?: string | null;
};

export type TrackOpts = {
  /** Live = webhook/poll as it happens: advances the follow-up cadence. Sync/backfill writes history only. */
  live: boolean;
  via: "openwa-webhook" | "openwa-sync";
};

export type TrackResult =
  | { status: "logged" | "linked"; leadId: string; direction: "INBOUND" | "OUTBOUND" }
  | { status: "skipped"; reason: "duplicate" | "no-lead" | "empty" | "not-a-chat" | "unresolved" };

export type TrackDeps = {
  resolvePhone(jid: string): Promise<string | null>;
  messageIdExists(id: string): Promise<boolean>;
  matchLead(msisdn: string): Promise<WhatsAppLeadMatch | null>;
  /** This lead's WhatsApp rows in one direction, without a WhatsApp id, within ±LINK_WINDOW of `at`. */
  unlinkedRows(leadId: string, direction: "INBOUND" | "OUTBOUND", at: Date): Promise<{ id: string; body: string | null }[]>;
  linkMessageId(interactionId: string, messageId: string): Promise<void>;
  create(row: NewWaRow): Promise<void>;
  /** Whether this lead already has a real contact in this direction since `since` (cadence throttle). */
  contactSince(leadId: string, direction: "INBOUND" | "OUTBOUND", since: Date): Promise<boolean>;
  applyCadence(leadId: string, leadReacted: boolean): Promise<void>;
};

export type NewWaRow = {
  leadId: string;
  type: "WHATSAPP_IN" | "WHATSAPP_OUT";
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  occurredAt: Date;
  messageId: string | null;
  metadata: Record<string, unknown>;
};

const LINK_WINDOW_MS = 30 * 60_000;
// One chat is often a burst of messages; the cadence counter must move once per conversation, not
// once per message (three messages would otherwise use up the whole 3-step chain in a minute).
const CADENCE_GAP_MS = 12 * 3_600_000;
const MAX_BODY = 8000;

const MEDIA_LABEL: Record<string, string> = {
  image: "[Photo]", video: "[Video]", audio: "[Voice message]", ptt: "[Voice message]",
  document: "[Document]", sticker: "[Sticker]", location: "[Location]", vcard: "[Contact card]",
};

/** The text a timeline row shows: the message body, or a label for a media message without caption. */
export function messageText(msg: Pick<WaMessage, "body" | "type">): string | null {
  const body = (msg.body ?? "").trim();
  if (body) return body.slice(0, MAX_BODY);
  return MEDIA_LABEL[(msg.type ?? "").trim()] ?? null;
}

/** The customer's side of a one-to-one chat ("…@c.us" or "…@lid"), or null for groups, broadcasts and the like. */
export function counterpartJid(msg: Pick<WaMessage, "from" | "to" | "chatId" | "fromMe" | "isGroup">): string | null {
  const ids = [msg.from, msg.to, msg.chatId].map((v) => (v ?? "").trim());
  if (msg.isGroup || ids.some((v) => v.endsWith("@g.us") || v.endsWith("@broadcast") || v.endsWith("@newsletter"))) return null;
  const chat = ids[2];
  // History replies name the chat by phone even when the message itself carries a lid; prefer that.
  if (chat.endsWith("@c.us")) return chat;
  const other = msg.fromMe ? ids[1] || chat : ids[0] || chat;
  return other.endsWith("@c.us") || other.endsWith("@lid") ? other : null;
}

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export async function trackWhatsAppMessage(msg: WaMessage, opts: TrackOpts, deps: TrackDeps): Promise<TrackResult> {
  const text = messageText(msg);
  if (!text) return { status: "skipped", reason: "empty" };

  const jid = counterpartJid(msg);
  if (!jid) return { status: "skipped", reason: "not-a-chat" };

  // A retried delivery, or a message the sync already pulled, never makes a second row.
  if (msg.id && (await deps.messageIdExists(msg.id))) return { status: "skipped", reason: "duplicate" };

  const direction = msg.fromMe ? ("OUTBOUND" as const) : ("INBOUND" as const);
  let phone: string | null = null;
  if (jid.endsWith("@c.us")) phone = toMsisdn(jid.replace(/@c\.us$/, ""));
  else {
    const given = direction === "INBOUND" ? toMsisdn(msg.senderPhone) : null;
    phone = given ?? toMsisdn(await deps.resolvePhone(jid).catch(() => null));
  }
  if (!phone) return { status: "skipped", reason: "unresolved" };

  // An unknown number is not an error: people write to the business number who are not leads.
  const match = await deps.matchLead(phone);
  if (!match) return { status: "skipped", reason: "no-lead" };

  const occurredAt = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();

  // The same message already on the timeline without its WhatsApp id: sent from the CRM (or the MCP
  // tool), or typed in by hand. Link it rather than show it twice.
  if (msg.id) {
    const wanted = norm(text);
    const twin = (await deps.unlinkedRows(match.leadId, direction, occurredAt)).find((r) => norm(r.body) === wanted);
    if (twin) {
      await deps.linkMessageId(twin.id, msg.id);
      return { status: "linked", leadId: match.leadId, direction };
    }
  }

  const contactBefore = opts.live
    ? await deps.contactSince(match.leadId, direction, new Date(occurredAt.getTime() - CADENCE_GAP_MS))
    : true;

  await deps.create({
    leadId: match.leadId,
    type: direction === "INBOUND" ? "WHATSAPP_IN" : "WHATSAPP_OUT",
    direction,
    body: text,
    occurredAt,
    messageId: msg.id,
    metadata: {
      via: opts.via,
      ...(direction === "OUTBOUND" ? { sentFromPhone: true } : { leadReacted: true }),
      ...(match.ambiguous ? { ambiguousSenderMatch: true } : {}),
    },
  });

  if (!contactBefore) await deps.applyCadence(match.leadId, direction === "INBOUND");
  return { status: "logged", leadId: match.leadId, direction };
}

export function realTrackDeps(resolvePhone: (jid: string) => Promise<string | null>): TrackDeps {
  return {
    resolvePhone,
    async messageIdExists(id) {
      return !!(await prisma.leadInteraction.findFirst({ where: { messageId: id }, select: { id: true } }));
    },
    matchLead: matchLeadForInboundWhatsApp,
    async unlinkedRows(leadId, direction, at) {
      return prisma.leadInteraction.findMany({
        where: {
          leadId, channel: "WHATSAPP", direction, messageId: null,
          occurredAt: { gte: new Date(at.getTime() - LINK_WINDOW_MS), lte: new Date(at.getTime() + LINK_WINDOW_MS) },
        },
        select: { id: true, body: true },
      });
    },
    async linkMessageId(interactionId, messageId) {
      await prisma.leadInteraction.update({ where: { id: interactionId }, data: { messageId } });
    },
    async create(row) {
      await prisma.leadInteraction.create({ data: { ...row, channel: "WHATSAPP", metadata: row.metadata as object } });
    },
    async contactSince(leadId, direction, since) {
      const types: LeadInteractionType[] = direction === "INBOUND" ? ["WHATSAPP_IN", "EMAIL_IN"] : ["CALL", "WHATSAPP_OUT", "EMAIL_OUT"];
      return !!(await prisma.leadInteraction.findFirst({ where: { leadId, type: { in: types }, occurredAt: { gte: since } }, select: { id: true } }));
    },
    async applyCadence(leadId, leadReacted) {
      await applyFollowUpCadence(leadId, "manual_contact", { leadReacted });
    },
  };
}
