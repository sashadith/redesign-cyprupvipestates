import { CALL_OUTCOME_LABEL, isCallOutcome, type CallOutcome } from "@/lib/crm/logRule";
import { LOST_REASON_LABEL, isLeadStatus, type LeadStatusValue, type LostReasonValue } from "@/lib/crm/leadStatus";
import type { RawMessage } from "@/lib/partner/clientDto";

// The partner's view of a FIX client's history (partner pipeline, 2026-11-05).
// Pure: no prisma. The lead's timeline mixes staff work with the partner's, and
// staff rows (notes, calls, emails, WhatsApp, system events) are internal, so only
// four things pass: rows the partner's own users wrote, status moves, presentation
// events and the staff messages addressed to this partner. A status move is shown
// by its status and time only, never by the stored text, and only a partner-authored
// row carries a name. The caller scopes the rows to this partner's lead and users.

export type TimelineRow = {
  id: string;
  type: string;
  occurredAt: Date;
  createdByUserId?: string | null;
  createdByPartnerUserId?: string | null;
  createdByName?: string | null;
  direction?: string | null;
  subject?: string | null;
  body?: string | null;
  metadata?: unknown;
};

export type TimelineEntry = {
  id: string;
  kind: "note" | "call" | "email" | "whatsapp" | "status" | "presentation" | "message" | "system";
  at: Date;
  inbound: boolean;
  text: string | null;
  subject: string | null;
  /** Set on a status move. */
  status: LeadStatusValue | null;
  lostReason: LostReasonValue | null;
  callOutcome: CallOutcome | null;
  /**
   * What a system row records, for the portal's own wording (the stored text is staff English):
   * a partner SYSTEM row's metadata.kind (follow_up, lead_edit, viewing_date, handover_requested,
   * handover_withdrawn), the manager's handover_accepted / keep_fix_on / keep_fix_off (from a staff row
   * whose metadata.kind is handover_accepted or keep_fix_changed), staff's partner_lead_taken_over or a presentation row's metadata.legacyType
   * (PRESENTATION_VIEWED, PRESENTATION_FAVORITE, …). Null otherwise.
   */
  event: string | null;
  /** The date a follow_up / viewing_date row set (null when it cleared it or for anything else). */
  eventAt: Date | null;
  /** Display name of the partner user who wrote the entry; null for everything else. */
  by: string | null;
};

const meta = (m: unknown): Record<string, unknown> => (m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
const clean = (s: string | null | undefined): string | null => (s?.trim() ? s.trim() : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const dateOf = (v: unknown): Date | null => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const FAVORITE_PREFIX = "Favorited: ";

function kindOf(type: string): TimelineEntry["kind"] {
  switch (type) {
    case "NOTE": return "note";
    case "CALL": return "call";
    case "EMAIL_IN": case "EMAIL_OUT": return "email";
    case "WHATSAPP_IN": case "WHATSAPP_OUT": return "whatsapp";
    case "STATUS_CHANGE": return "status";
    case "PRESENTATION_EVENT": return "presentation";
    default: return "system";
  }
}

function fromRow(r: TimelineRow): TimelineEntry | null {
  const partnerAuthored = !!r.createdByPartnerUserId;
  const kind = kindOf(r.type);
  const base = {
    id: r.id, kind, at: r.occurredAt, inbound: r.type === "EMAIL_IN" || r.type === "WHATSAPP_IN",
    text: null as string | null, subject: null as string | null, status: null as LeadStatusValue | null,
    lostReason: null as LostReasonValue | null, callOutcome: null as CallOutcome | null,
    event: null as string | null, eventAt: null as Date | null, by: null as string | null,
  };
  if (r.type === "STATUS_CHANGE") {
    const m = meta(r.metadata);
    // No recognised target status: the stored text is free and may name staff, so the row is dropped.
    if (typeof m.toStatus !== "string" || !isLeadStatus(m.toStatus)) return null;
    const reason = typeof m.lostReason === "string" && m.lostReason in LOST_REASON_LABEL ? (m.lostReason as LostReasonValue) : null;
    return { ...base, status: m.toStatus, lostReason: reason, by: partnerAuthored ? clean(r.createdByName) : null };
  }
  if (r.type === "PRESENTATION_EVENT") {
    // System-composed line about the presentation (created, viewed, favorited); the staff author is not carried.
    // The portal words it from the event; only a favourite keeps its project name as text.
    const event = str(meta(r.metadata).legacyType);
    const body = clean(r.body);
    const favorite = event === "PRESENTATION_FAVORITE" && body?.startsWith(FAVORITE_PREFIX) ? clean(body.slice(FAVORITE_PREFIX.length)) : null;
    return { ...base, event, text: favorite, by: partnerAuthored ? clean(r.createdByName) : null };
  }
  const m = meta(r.metadata);
  // The manager took the client over (handover or explicit take-over) or changed the keep-FIX override: the partner sees the event, never who.
  if (r.type === "SYSTEM" && !partnerAuthored) {
    if (m.kind === "handover_accepted") return { ...base, event: "handover_accepted" };
    if (m.kind === "keep_fix_changed") return { ...base, event: m.keepFix === true ? "keep_fix_on" : "keep_fix_off" };
    if (m.kind === "partner_lead_taken_over") return { ...base, event: "partner_lead_taken_over" };
    return null;
  }
  if (!partnerAuthored) return null;
  if (r.type === "SYSTEM") {
    // follow_up / lead_edit / viewing_date / handover_*: the stored text is staff English, so only the kind and date pass.
    const event = str(m.kind);
    const eventAt = event === "follow_up" ? dateOf(m.nextFollowUpAt) : event === "viewing_date" ? dateOf(m.viewingScheduledAt) : null;
    return { ...base, event, eventAt, by: clean(r.createdByName) };
  }
  const outcome = r.type === "CALL" && isCallOutcome(m.callOutcome) ? m.callOutcome : null;
  const text = clean(r.body);
  return {
    ...base,
    // A call logged with an outcome and no text stores the English outcome label as its text.
    text: outcome && text === CALL_OUTCOME_LABEL[outcome] ? null : text,
    subject: clean(r.subject), callOutcome: outcome, by: clean(r.createdByName),
  };
}

/**
 * What of the lead's history belongs to this claim (privacy, final review 2026-11-05): only rows from the
 * moment the claim became active (activeSince, as everywhere else in the portal), messages likewise, and
 * presentation events of the partner's own presentations only. A presentation row names its presentation
 * in metadata.presentationId; an older row without it is kept (it is after activeSince) but loses its
 * text, so a favourite of someone else's presentation never shows its project name.
 */
export function scopeTimeline<R extends TimelineRow, M extends { createdAt: Date }>(
  rows: R[], messages: M[], scope: { since: Date; ownPresentationIds: ReadonlySet<string> },
): { rows: R[]; messages: M[] } {
  const since = scope.since.getTime();
  const kept: R[] = [];
  for (const r of rows) {
    if (r.occurredAt.getTime() < since) continue;
    if (r.type === "PRESENTATION_EVENT") {
      const id = str(meta(r.metadata).presentationId);
      if (id) {
        if (!scope.ownPresentationIds.has(id)) continue;
      } else {
        kept.push({ ...r, body: null });
        continue;
      }
    }
    kept.push(r);
  }
  return { rows: kept, messages: messages.filter((m) => m.createdAt.getTime() >= since) };
}

export function partnerTimeline(rows: TimelineRow[], messages: (RawMessage & { id?: string })[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const r of rows) {
    const e = fromRow(r);
    if (e) out.push(e);
  }
  messages.forEach((m, i) => {
    out.push({
      id: m.id ?? `message-${i}`, kind: "message", at: m.createdAt, inbound: false, text: clean(m.body), subject: null,
      status: null, lostReason: null, callOutcome: null, event: null, eventAt: null, by: null,
    });
  });
  // Newest first; entries with the same time keep their input order.
  return out.map((e, i) => ({ e, i })).sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || a.i - b.i).map(({ e }) => e);
}
