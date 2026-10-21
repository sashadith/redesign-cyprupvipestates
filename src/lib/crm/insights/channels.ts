// Channel performance rows (CRM v2 phase 4a, Decision 3). Pure: the server hands in the
// cohort (leads created in the period) plus batched facts about it.
import { LEAD_STATUSES } from "../leadStatus";

export type ChannelLead = {
  id: string;
  source: string; // LeadSource
  partnerMode: string | null; // HANDOVER | FIX, only set on PARTNER leads
  status: string;
  createdAt: Date;
  trashed?: boolean;
};
export type FirstContact = { leadId: string; at: Date }; // first real OUTBOUND contact (CALL / EMAIL_OUT / WHATSAPP_OUT)
export type ChannelDeal = { leadId: string; status: string; ourCommission: number | null };

export type ChannelRow = {
  key: string;
  label: string;
  source: string;
  partnerMode: string | null;
  leads: number;
  contacted: number;
  contactedPct: number | null;
  medianFirstResponseMin: number | null;
  viewings: number;
  reservedOrClosed: number;
  closed: number;
  wonRate: number | null;
  earnedCommission: number;
};

/** Channels left out of the table. */
export const EXCLUDED_CHANNEL_SOURCES = ["NEWSLETTER"] as const;
/** Deal statuses whose ourCommission counts as earned. */
export const EARNED_DEAL_STATUSES = ["EARNED", "DEVELOPER_PAID", "PAID_OUT"] as const;
const VIEWING_OR_LATER = ["VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"] as const satisfies readonly (typeof LEAD_STATUSES)[number][];

/** Even count: mean of the two middle values, rounded. Empty: null. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Percentage 0-100 with one decimal; null when the denominator is empty. */
export function pct1(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function channelOf(l: ChannelLead): { key: string; label: string } {
  if (l.source === "PARTNER") {
    if (l.partnerMode === "HANDOVER") return { key: "PARTNER:HANDOVER", label: "PARTNER · Handover" };
    if (l.partnerMode === "FIX") return { key: "PARTNER:FIX", label: "PARTNER · Fix" };
  }
  return { key: l.source, label: l.source };
}

export function channelRows(input: {
  leads: ChannelLead[];
  firstContacts: FirstContact[];
  viewings: string[]; // lead ids that reached VIEWING_SCHEDULED at any point
  deals: ChannelDeal[];
}): ChannelRow[] {
  const cohort = input.leads.filter((l) => !l.trashed && !(EXCLUDED_CHANNEL_SOURCES as readonly string[]).includes(l.source));
  const byId = new Map(cohort.map((l) => [l.id, l]));
  const viewed = new Set(input.viewings);
  const firstAt = new Map<string, Date>();
  for (const c of input.firstContacts) {
    const prev = firstAt.get(c.leadId);
    if (!prev || c.at < prev) firstAt.set(c.leadId, c.at);
  }
  const earnedByLead = new Map<string, number>();
  for (const d of input.deals) {
    if (!(EARNED_DEAL_STATUSES as readonly string[]).includes(d.status)) continue;
    earnedByLead.set(d.leadId, (earnedByLead.get(d.leadId) ?? 0) + (d.ourCommission ?? 0));
  }

  type Acc = ChannelRow & { response: number[]; earnedRaw: number };
  const acc = new Map<string, Acc>();
  for (const l of cohort) {
    const ch = channelOf(l);
    let a = acc.get(ch.key);
    if (!a) {
      a = {
        key: ch.key, label: ch.label, source: l.source, partnerMode: ch.key.startsWith("PARTNER:") ? l.partnerMode : null,
        leads: 0, contacted: 0, contactedPct: null, medianFirstResponseMin: null, viewings: 0, reservedOrClosed: 0,
        closed: 0, wonRate: null, earnedCommission: 0, response: [], earnedRaw: 0,
      };
      acc.set(ch.key, a);
    }
    a.leads += 1;
    const first = firstAt.get(l.id);
    if (first) {
      a.contacted += 1;
      a.response.push(Math.max(0, Math.round((first.getTime() - l.createdAt.getTime()) / 60_000)));
    }
    if (viewed.has(l.id) || (VIEWING_OR_LATER as readonly string[]).includes(l.status)) a.viewings += 1;
    if (l.status === "RESERVED" || l.status === "CLOSED") a.reservedOrClosed += 1;
    if (l.status === "CLOSED") a.closed += 1;
    a.earnedRaw += earnedByLead.get(l.id) ?? 0;
  }

  return Array.from(acc.values())
    .map(({ response, earnedRaw, ...row }) => ({
      ...row,
      contactedPct: pct1(row.contacted, row.leads),
      medianFirstResponseMin: median(response),
      wonRate: pct1(row.closed, row.leads),
      earnedCommission: Math.round(earnedRaw),
    }))
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
}
