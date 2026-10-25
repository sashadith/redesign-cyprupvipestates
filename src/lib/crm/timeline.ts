import { LOST_REASON_LABEL, STATUS_LABEL, isLeadStatus, type LostReasonValue } from "./leadStatus";

// The lead cockpit's timeline (CRM v2, 2026-10-18). Pure: turns LeadInteraction
// rows into display items. Bodies stay plain text — inbound email/WhatsApp text
// is written by the lead and is rendered as text only, never as HTML.

export type TimelineInput = {
  id: string; type: string; direction: string | null; channel: string | null; subject: string | null; body: string | null;
  occurredAt: Date; createdByName: string | null; metadata: unknown;
};

export type TimelineItem = {
  id: string;
  kind: "call" | "note" | "whatsapp" | "email" | "status" | "presentation" | "booking" | "system";
  inbound: boolean;
  title: string;
  text: string | null;
  at: string; // ISO
  by: string | null;
};

export const TIMELINE_TEXT_MAX = 600;

// Cut by code points so an emoji is never split in half.
function cut(s: string | null): string | null {
  const t = s?.trim();
  if (!t) return null;
  const cps = Array.from(t);
  return cps.length > TIMELINE_TEXT_MAX ? cps.slice(0, TIMELINE_TEXT_MAX).join("") + "…" : t;
}

const withSubject = (title: string, subject: string | null) => (subject?.trim() ? `${title} · ${subject.trim()}` : title);

function statusTitle(metadata: unknown, body: string | null): string {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const to = typeof m.toStatus === "string" ? m.toStatus : null;
  if (!to) return cut(body) ?? "Stage changed";
  const label = isLeadStatus(to) ? STATUS_LABEL[to] : to;
  const reason = typeof m.lostReason === "string" ? m.lostReason : null;
  const reasonLabel = reason ? (LOST_REASON_LABEL[reason as LostReasonValue] ?? reason) : null;
  return reasonLabel ? `Moved to ${label} · ${reasonLabel}` : `Moved to ${label}`;
}

function toItem(r: TimelineInput): TimelineItem {
  const base = { id: r.id, at: r.occurredAt.toISOString(), by: r.createdByName, inbound: r.direction === "INBOUND" };
  const text = cut(r.body);
  switch (r.type) {
    case "CALL": return { ...base, kind: "call", title: "Call", text };
    case "NOTE": return { ...base, kind: "note", inbound: false, title: "Note", text };
    case "WHATSAPP_IN": return { ...base, kind: "whatsapp", inbound: true, title: "WhatsApp received", text };
    case "WHATSAPP_OUT": return { ...base, kind: "whatsapp", inbound: false, title: "WhatsApp sent", text };
    case "EMAIL_IN": return { ...base, kind: "email", inbound: true, title: withSubject("Email received", r.subject), text };
    case "EMAIL_OUT": return { ...base, kind: "email", inbound: false, title: withSubject("Email sent", r.subject), text };
    case "STATUS_CHANGE": return { ...base, kind: "status", inbound: false, title: statusTitle(r.metadata, r.body), text: null };
    case "PRESENTATION_EVENT": return { ...base, kind: "presentation", title: text ?? "Presentation", text: null };
    case "BOOKING_EVENT": return { ...base, kind: "booking", title: text ?? "Booking", text: null };
    default: return { ...base, kind: "system", title: text ?? "System event", text: null };
  }
}

// Newest first; rows with the same time keep their input order.
export function toTimeline(rows: TimelineInput[]): TimelineItem[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.occurredAt.getTime() - a.r.occurredAt.getTime() || a.i - b.i)
    .map(({ r }) => toItem(r));
}

// "just now", "12 min ago", "5 h ago", "3 d ago" — the absolute date goes in a title attribute.
export function ago(from: Date | string, now: Date): string {
  const m = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
