import type { LeadStateInput } from "@/lib/crm/compose/leadState";
import { fmtDate, truncateText, untrusted } from "./format";
import { CALL_OUTCOMES, isCallOutcome, type CallOutcome } from "@/lib/crm/logRule";

export const INBOUND_TYPES = new Set(["EMAIL_IN", "WHATSAPP_IN"]);

type InteractionLike = {
  id: string; type: string; direction: string | null; channel: string | null; subject: string | null; body: string | null;
  occurredAt: Date; createdByName: string | null;
  /** Only `metadata.cc` is read: the copy recipients of an EMAIL_OUT, or the
   *  other participants of an EMAIL_IN (for "reply all"). */
  metadata?: unknown;
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
  cc?: string[];
  callOutcome?: CallOutcome;
};

// Addresses only — stored after validation (ccRecipients / replyRecipients).
function ccOf(metadata: unknown): string[] {
  const cc = (metadata as { cc?: unknown } | null | undefined)?.cc;
  return Array.isArray(cc) ? cc.filter((a): a is string => typeof a === "string" && !!a) : [];
}

// Lead-authored text (EMAIL_IN / WHATSAPP_IN) goes under untrusted_content;
// everything else in the timeline was written by us (a CALL note is our
// summary even when the direction is INBOUND).
export function shapeInteraction(i: InteractionLike): ShapedInteraction {
  const cc = ccOf(i.metadata);
  const outcome = (i.metadata as { callOutcome?: unknown } | null | undefined)?.callOutcome;
  const base = {
    id: i.id, type: i.type, direction: i.direction, channel: i.channel, subject: i.subject, occurredAt: fmtDate(i.occurredAt), by: i.createdByName,
    ...(cc.length ? { cc } : {}), ...(isCallOutcome(outcome) ? { callOutcome: outcome } : {}),
  };
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

/* First-touch attribution as crm_get_lead reports it: the partner/campaign the
   lead came through (utm_* and the partner `?ref=`) plus the external referrer.
   Always the same keys, null when unknown, so a caller can tell "no attribution"
   from "field missing". */
export function attributionOf(lead: {
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  attributionRef: string | null; referrer: string | null;
}) {
  return {
    utmSource: lead.utmSource ?? null,
    utmMedium: lead.utmMedium ?? null,
    utmCampaign: lead.utmCampaign ?? null,
    ref: lead.attributionRef ?? null,
    referrer: lead.referrer ?? null,
  };
}

/** Calls on the lead, newest first in: how many, how each ended (calls logged before 2026-11-04 have
 *  no outcome and count as "unknown"), and how many unanswered attempts since the last conversation. */
export function callAttempts(calls: { occurredAt: Date; metadata: unknown }[]) {
  const outcomeOf = (m: unknown): CallOutcome | null => {
    const o = (m as { callOutcome?: unknown } | null)?.callOutcome;
    return isCallOutcome(o) ? o : null;
  };
  const byOutcome = Object.fromEntries([...CALL_OUTCOMES, "UNKNOWN"].map((k) => [k, 0])) as Record<CallOutcome | "UNKNOWN", number>;
  let unansweredSinceSpoke = 0;
  let spokeSeen = false;
  for (const c of calls) {
    const outcome = outcomeOf(c.metadata) ?? "UNKNOWN";
    byOutcome[outcome]++;
    if (outcome === "SPOKE") spokeSeen = true;
    if (!spokeSeen && (outcome === "NO_ANSWER" || outcome === "VOICEMAIL")) unansweredSinceSpoke++;
  }
  const last = calls[0];
  return { total: calls.length, byOutcome, unansweredSinceSpoke, lastCallAt: fmtDate(last?.occurredAt ?? null), lastOutcome: last ? outcomeOf(last.metadata) : null };
}
