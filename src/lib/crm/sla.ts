import { ACTIVE_LEAD_STATUSES } from "./leadStatus";
import { isAssignmentTo } from "./today";

// SLA reminders (CRM v2 Phase 2c). Pure: the cron route loads the rows, this
// decides which notices are due and renders their text. Idempotency lives in
// the data: every sent notice leaves a SYSTEM row with metadata.sla, and a rule
// never fires again while such a row covers it.

export type SlaRule = "UNASSIGNED" | "UNCONTACTED" | "ESCALATE";
export const SLA_RULES: readonly SlaRule[] = ["UNASSIGNED", "UNCONTACTED", "ESCALATE"];

export type SlaLead = {
  id: string; name: string; status: string; createdAt: Date;
  assignedToId: string | null; ownerName: string | null; ownerEmail: string | null;
  assignedAt: Date | null; lastOutboundContactAt: Date | null;
  notified: { rule: SlaRule; at: Date }[];
};
export type SlaThresholds = { unassignedMin: number; uncontactedMin: number; escalateMin: number };
export const DEFAULT_SLA: SlaThresholds = { unassignedMin: 30, uncontactedMin: 120, escalateMin: 240 };

// Real outbound contact: what clears the owner rules.
export const SLA_OUTBOUND_TYPES = ["CALL", "EMAIL_OUT", "WHATSAPP_OUT"] as const;

const MIN = 60_000;
const ACTIVE = new Set<string>(ACTIVE_LEAD_STATUSES);
const isRule = (v: unknown): v is SlaRule => typeof v === "string" && (SLA_RULES as readonly string[]).includes(v);

function minutes(raw: string | undefined, fallback: number): number {
  const s = raw?.trim() ?? "";
  if (!/^\d+$/.test(s)) return fallback;
  const n = Number(s);
  return n > 0 && Number.isSafeInteger(n) ? n : fallback;
}

export function slaThresholdsFromEnv(env: Record<string, string | undefined>): SlaThresholds {
  return {
    unassignedMin: minutes(env.CRM_SLA_UNASSIGNED_MIN, DEFAULT_SLA.unassignedMin),
    uncontactedMin: minutes(env.CRM_SLA_UNCONTACTED_MIN, DEFAULT_SLA.uncontactedMin),
    escalateMin: minutes(env.CRM_SLA_ESCALATE_MIN, DEFAULT_SLA.escalateMin),
  };
}

// CRM_SLA_START is required: without it the job does nothing, so the first run
// can never sweep up the whole backlog. Only an ISO date/time is accepted.
export function slaStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.CRM_SLA_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

type Row = { body: string | null; metadata: unknown; occurredAt: Date };

// Notices already sent, read back from SYSTEM rows. Only metadata.sla counts;
// the body is for humans.
export function slaNoticesFromRows(rows: Row[]): { rule: SlaRule; at: Date }[] {
  const out: { rule: SlaRule; at: Date }[] = [];
  for (const r of rows) {
    const sla = r.metadata && typeof r.metadata === "object" ? (r.metadata as { sla?: unknown }).sla : undefined;
    if (isRule(sla)) out.push({ rule: sla, at: r.occurredAt });
  }
  return out;
}

// When the current owner got the lead: the newest "Assigned to ..." row, and
// only if that row names the current owner. Anything else (no row, or the
// newest row names someone else) is null — the owner rules then stay silent
// rather than guess from an older assignment.
export function latestAssignedAt(rows: Row[], owner: { id: string; name: string }): Date | null {
  let latest: Row | null = null;
  for (const r of rows) {
    if (!r.body?.startsWith("Assigned to")) continue;
    if (!latest || r.occurredAt.getTime() > latest.occurredAt.getTime()) latest = r;
  }
  return latest && isAssignmentTo(latest, owner) ? latest.occurredAt : null;
}

export function dueSlaNotices(leads: SlaLead[], now: Date, start: Date, t: SlaThresholds): { rule: SlaRule; lead: SlaLead }[] {
  const out: { rule: SlaRule; lead: SlaLead }[] = [];
  const nowMs = now.getTime();
  for (const lead of leads) {
    if (lead.createdAt.getTime() < start.getTime() || !ACTIVE.has(lead.status)) continue;
    const sent = (rule: SlaRule, since = -Infinity) => lead.notified.some((n) => n.rule === rule && n.at.getTime() >= since);

    if (!lead.assignedToId) {
      if (lead.createdAt.getTime() + t.unassignedMin * MIN <= nowMs && !sent("UNASSIGNED")) out.push({ rule: "UNASSIGNED", lead });
      continue;
    }
    if (!lead.assignedAt) continue;
    const assignedMs = lead.assignedAt.getTime();
    if (lead.lastOutboundContactAt && lead.lastOutboundContactAt.getTime() >= assignedMs) continue;
    // A notice from an earlier assignment does not count: reassignment re-arms both rules.
    if (assignedMs + t.uncontactedMin * MIN <= nowMs && !sent("UNCONTACTED", assignedMs)) out.push({ rule: "UNCONTACTED", lead });
    if (assignedMs + t.escalateMin * MIN <= nowMs && !sent("ESCALATE", assignedMs)) out.push({ rule: "ESCALATE", lead });
  }
  return out;
}

// ---- message text (admin-facing, English) ----

export const SLA_TELEGRAM_LIST_MAX = 10;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
const cut = (s: string) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);
const hoursSince = (d: Date, now: Date) => Math.max(1, Math.floor((now.getTime() - d.getTime()) / 3_600_000));
export const slaLeadUrl = (base: string, id: string) => `${base}/crm/leads/${id}`;

export function unassignedTelegram(leads: SlaLead[], base: string): string {
  const shown = leads.slice(0, SLA_TELEGRAM_LIST_MAX);
  const lines = [
    `⏰ <b>${leads.length} new lead${leads.length === 1 ? "" : "s"} still unassigned</b>`,
    ...shown.map((l) => `• ${esc(cut(l.name || "(no name)"))}`),
  ];
  if (leads.length > shown.length) lines.push(`and ${leads.length - shown.length} more`);
  lines.push(esc(`${base}/crm/inbox`));
  return lines.join("\n");
}

// The caller passes at most SLA_TELEGRAM_LIST_MAX leads (the rest wait for the next run).
export function escalateTelegram(leads: SlaLead[], now: Date, base: string): string {
  const lines = [`🚨 <b>${leads.length} assigned lead${leads.length === 1 ? "" : "s"} not contacted</b>`];
  for (const l of leads) {
    const owner = esc(cut(l.ownerName || "(unknown)"));
    const name = esc(cut(l.name || "(no name)"));
    const h = l.assignedAt ? `, assigned ${hoursSince(l.assignedAt, now)} h ago` : "";
    lines.push(`• <b>${owner}</b> — ${name}${h}\n${esc(slaLeadUrl(base, l.id))}`);
  }
  return lines.join("\n");
}

export function uncontactedEmail(lead: SlaLead, now: Date, base: string): { subject: string; text: string } {
  const h = lead.assignedAt ? hoursSince(lead.assignedAt, now) : 0;
  const name = lead.name || "(no name)";
  return {
    subject: `Please contact ${name} — assigned ${h} h ago`,
    text: [
      `Hi ${lead.ownerName ?? ""},`.replace(" ,", ","),
      "",
      `${name} was assigned to you ${h} h ago and has not been contacted yet (no call, email or WhatsApp logged).`,
      "",
      `Open the lead: ${slaLeadUrl(base, lead.id)}`,
    ].join("\n"),
  };
}
