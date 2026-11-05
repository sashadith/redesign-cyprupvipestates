import { isCallOutcome, type CallOutcome } from "@/lib/crm/logRule";
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
  /** Display name of the partner user who wrote the entry; null for everything else. */
  by: string | null;
};

const meta = (m: unknown): Record<string, unknown> => (m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});
const clean = (s: string | null | undefined): string | null => (s?.trim() ? s.trim() : null);

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
    lostReason: null as LostReasonValue | null, callOutcome: null as CallOutcome | null, by: null as string | null,
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
    return { ...base, text: clean(r.body), by: partnerAuthored ? clean(r.createdByName) : null };
  }
  if (!partnerAuthored) return null;
  const outcome = r.type === "CALL" ? meta(r.metadata).callOutcome : null;
  return {
    ...base, text: clean(r.body), subject: clean(r.subject), callOutcome: isCallOutcome(outcome) ? outcome : null, by: clean(r.createdByName),
  };
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
      status: null, lostReason: null, callOutcome: null, by: null,
    });
  });
  // Newest first; entries with the same time keep their input order.
  return out.map((e, i) => ({ e, i })).sort((a, b) => b.e.at.getTime() - a.e.at.getTime() || a.i - b.i).map(({ e }) => e);
}
