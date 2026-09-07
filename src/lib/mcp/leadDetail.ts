import type { LeadStateInput } from "@/lib/crm/compose/leadState";
import { fmtDate, truncateText, untrusted } from "./format";

export const INBOUND_TYPES = new Set(["EMAIL_IN", "WHATSAPP_IN"]);

type InteractionLike = {
  id: string; type: string; direction: string | null; channel: string | null; subject: string | null; body: string | null;
  occurredAt: Date; createdByName: string | null;
};

// { id, type, direction, channel, subject, body?, untrusted_content?, truncated, occurredAt, by } —
// exactly one of body/untrusted_content is present on any given row. An
// explicit return type (rather than letting the two branches infer a
// discriminated union) is what lets callers read either field off the same
// shape without a type guard.
type ShapedInteraction = {
  id: string; type: string; direction: string | null; channel: string | null; subject: string | null;
  occurredAt: ReturnType<typeof fmtDate>; by: string | null; truncated: boolean;
  body?: string | null; untrusted_content?: string | null;
};

// Lead-authored text (EMAIL_IN / WHATSAPP_IN) goes under untrusted_content;
// everything else in the timeline was written by us (a CALL note is our
// summary even when the direction is INBOUND).
export function shapeInteraction(i: InteractionLike): ShapedInteraction {
  const base = { id: i.id, type: i.type, direction: i.direction, channel: i.channel, subject: i.subject, occurredAt: fmtDate(i.occurredAt), by: i.createdByName };
  if (INBOUND_TYPES.has(i.type)) {
    const u = untrusted(i.body);
    return { ...base, untrusted_content: u?.untrusted_content ?? null, truncated: u?.truncated ?? false };
  }
  const t = truncateText(i.body);
  return { ...base, body: t?.text ?? null, truncated: t?.truncated ?? false };
}

// Same derivation as src/lib/crm/compose/generate.ts (generateReplyDraft),
// kept in one place so crm_get_lead and Compose agree on a lead's state.
// `interactions` must be sorted newest first.
export function leadStateInput(
  lead: { status: string; createdAt: Date },
  interactions: Pick<InteractionLike, "type" | "direction" | "occurredAt">[],
  presentation: LeadStateInput["presentation"],
): LeadStateInput {
  const lastDirected = interactions.find((i) => i.direction != null);
  const hasRealInboundMessage = interactions.some((i) => INBOUND_TYPES.has(i.type) || (i.type === "CALL" && i.direction === "INBOUND"));
  return { status: lead.status, createdAt: lead.createdAt, lastDirectedInteractionAt: lastDirected?.occurredAt ?? null, presentation, hasRealInboundMessage };
}

export const LEAD_STATE_LABEL: Record<string, string> = {
  NEW: "New — first response pending",
  ONGOING_COMMUNICATION: "Ongoing communication — the lead has replied; continue that conversation",
  CONTACTED_FRESH: "Contacted recently — open thread, no reply yet",
  CONTACTED_COLD: "Contacted, gone cold (14+ days)",
  PRESENTATION_UNOPENED: "Presentation sent, never opened",
  PRESENTATION_OPENED_NO_REACTION: "Presentation opened, no reaction since",
};
