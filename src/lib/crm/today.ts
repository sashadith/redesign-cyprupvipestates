import { ACTIVE_LEAD_STATUSES } from "./leadStatus";

// The personal Today page (CRM v2 Phase 2c). Pure: the page loads the rows, this
// sorts them into five lists. Day boundaries are Cyprus calendar days, derived
// with Intl so the October clock change needs no hard-coded offsets.

export type TodayLead = {
  id: string; name: string; status: string;
  nextFollowUpAt: Date | null; viewingScheduledAt: Date | null;
  lastContactAt: Date | null; createdAt: Date; assignedAt: Date | null;
  projectLabel: string | null;
  temperature?: { level: "hot" | "warm" | "cold"; reasons: string[] } | null;
};
export type TodaySections = { overdue: TodayLead[]; dueToday: TodayLead[]; viewings: TodayLead[]; fresh: TodayLead[]; stale: TodayLead[] };

export const CRM_TZ = "Asia/Nicosia";
const DAY_MS = 86_400_000;
const FRESH_MS = 48 * 3_600_000;
const STALE_MS = 7 * DAY_MS;
const ACTIVE = new Set<string>(ACTIVE_LEAD_STATUSES);

// "YYYY-MM-DD" of the calendar day `d` falls on in `tz` (en-CA formats ISO-style).
export function dayKey(d: Date, tz = CRM_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + DAY_MS).toISOString().slice(0, 10);
}

const byDate = (key: (l: TodayLead) => Date) => (a: TodayLead, b: TodayLead) => key(a).getTime() - key(b).getTime();

export function buildToday(leads: TodayLead[], now: Date, tz = CRM_TZ): TodaySections {
  const today = dayKey(now, tz);
  const tomorrow = nextDayKey(today);
  const nowMs = now.getTime();

  const overdue: TodayLead[] = [];
  const dueToday: TodayLead[] = [];
  const viewings: TodayLead[] = [];
  const fresh: TodayLead[] = [];
  const stale: TodayLead[] = [];

  for (const l of leads) {
    const active = ACTIVE.has(l.status);
    if (l.viewingScheduledAt) {
      const k = dayKey(l.viewingScheduledAt, tz);
      if (k === today || k === tomorrow) viewings.push(l);
    }
    if (!active) continue; // CLOSED / LOST / KEEP_CONTACT only ever show up as a viewing

    let due = false;
    if (l.nextFollowUpAt) {
      const k = dayKey(l.nextFollowUpAt, tz);
      if (k < today) { overdue.push(l); due = true; }
      else if (k === today) { dueToday.push(l); due = true; }
    }
    if (l.assignedAt) {
      const age = nowMs - l.assignedAt.getTime();
      if (age >= 0 && age <= FRESH_MS) fresh.push(l);
    }
    if (!due && nowMs - (l.lastContactAt ?? l.createdAt).getTime() > STALE_MS) stale.push(l);
  }

  overdue.sort(byDate((l) => l.nextFollowUpAt!));
  dueToday.sort(byDate((l) => l.nextFollowUpAt!));
  viewings.sort(byDate((l) => l.viewingScheduledAt!));
  fresh.sort(byDate((l) => l.assignedAt!));
  stale.sort(byDate((l) => l.lastContactAt ?? l.createdAt));
  return { overdue, dueToday, viewings, fresh, stale };
}

export function todayGreeting(now: Date, fullName: string, tz = CRM_TZ): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(now));
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const first = fullName.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

// Did this SYSTEM "Assigned to ..." row assign the lead to `user`? crm-v2 rows carry
// metadata.assignedToId; rows written by the old admin CRM have no metadata, only the name in the body.
export function isAssignmentTo(row: { body: string | null; metadata: unknown }, user: { id: string; name: string }): boolean {
  const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as { assignedToId?: unknown }) : null;
  if (meta && meta.assignedToId !== undefined && meta.assignedToId !== null) return meta.assignedToId === user.id;
  return row.body === `Assigned to ${user.name}`;
}
