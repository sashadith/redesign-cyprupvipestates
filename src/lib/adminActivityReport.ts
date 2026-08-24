import { prisma } from "@/lib/prisma";
import { adminDateKey } from "@/lib/adminTime";

// Consecutive pings within this gap belong to the same work session; a
// bigger gap means the beats stopped — the user went idle (the tracker's
// 3-minute dead-tab rule), backgrounded the tab, or closed it — and a new
// session starts on the next ping. The tracker beats every 60s while the
// user is genuinely active (see ActivityTracker.tsx), so 4 min tolerates
// two lost beats (network hiccup, laptop lid) without falsely splitting a
// real session, while still cutting off within minutes of true idleness.
// Note the tracker keeps beating for up to 3 min AFTER the last real input
// (its idle check trails by IDLE_MS) — so a session's counted tail can
// overrun actual work by at most those 3 minutes, never more.
const SESSION_GAP_MS = 4 * 60_000;
// A session built from a single ping (opened the panel, did one thing,
// closed it) would otherwise report ~0 duration — floor it to one beat
// interval so "I was there" always shows as some non-zero time.
const MIN_SESSION_MS = 60_000;

// Display names for the closed module vocabulary produced by moduleFromPath
// (src/lib/adminActivity.ts). Order here is the display order in the report.
export const MODULE_LABELS: Record<string, string> = {
  crm: "CRM",
  website: "Website",
  developments: "Developers",
  analytics: "Analytics",
  dashboard: "Dashboard",
  users: "Users",
  account: "Account",
  other: "Other",
};

export type ActivitySession = { start: Date; end: Date; durationMs: number };
export type UserActivityReport = {
  userId: string;
  name: string;
  email: string;
  role: string;
  sessions: ActivitySession[];
  totalMs: number;
};
// One row per user per Cyprus calendar day with any activity. sessionCount
// doubles as the "interruptions" signal (3 sessions = work resumed twice
// after going idle/away). moduleMinutes: each stored ping represents ~one
// beat interval (1 min) of genuine activity in that module, so counting
// pings per module IS the minutes approximation — kept independent of the
// session-clustered totalMs on purpose (unlabeled pings from old clients
// would otherwise skew a proportional split).
export type DailyActivityRow = {
  dateKey: string; // "2026-08-24", Cyprus calendar day
  userId: string;
  name: string;
  first: Date;
  last: Date;
  totalMs: number;
  sessionCount: number;
  moduleMinutes: { module: string; label: string; minutes: number }[];
};

function clusterPings(pings: Date[]): ActivitySession[] {
  const sessions: ActivitySession[] = [];
  for (const p of pings) {
    const last = sessions[sessions.length - 1];
    if (last && p.getTime() - last.end.getTime() <= SESSION_GAP_MS) {
      last.end = p;
    } else {
      sessions.push({ start: p, end: p, durationMs: 0 });
    }
  }
  for (const s of sessions) s.durationMs = Math.max(s.end.getTime() - s.start.getTime(), MIN_SESSION_MS);
  return sessions;
}

/** from/to are UTC instants (exclusive upper bound). */
export async function getAdminActivityReport(from: Date, to: Date): Promise<{ users: UserActivityReport[]; daily: DailyActivityRow[] }> {
  const dbUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  const pings = await prisma.adminActivityPing.findMany({
    where: { pingAt: { gte: from, lt: to } },
    select: { userId: true, pingAt: true, module: true },
    orderBy: { pingAt: "asc" },
  });

  const byUser = new Map<string, { pingAt: Date; module: string | null }[]>();
  for (const p of pings) {
    const arr = byUser.get(p.userId) ?? [];
    arr.push(p);
    byUser.set(p.userId, arr);
  }

  const users: UserActivityReport[] = [];
  const daily: DailyActivityRow[] = [];

  for (const u of dbUsers) {
    const userPings = byUser.get(u.id) ?? [];
    const sessions = clusterPings(userPings.map((p) => p.pingAt));
    const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
    users.push({ userId: u.id, name: u.name, email: u.email, role: u.role, sessions, totalMs });

    // Per-day rollup. A session is assigned wholly to the Cyprus calendar
    // day it STARTED on — nobody here works across midnight often enough to
    // justify split logic, and a stable rule beats a clever one in a report
    // meant for eyeballing.
    const dayAgg = new Map<string, { first: Date; last: Date; totalMs: number; sessionCount: number }>();
    for (const s of sessions) {
      const key = adminDateKey(s.start);
      const d = dayAgg.get(key);
      if (!d) {
        dayAgg.set(key, { first: s.start, last: s.end, totalMs: s.durationMs, sessionCount: 1 });
      } else {
        if (s.start < d.first) d.first = s.start;
        if (s.end > d.last) d.last = s.end;
        d.totalMs += s.durationMs;
        d.sessionCount += 1;
      }
    }
    // Module minutes bucket by the ping's own day (not the session's start
    // day) — self-consistent for the breakdown column, and unlabeled pings
    // (pre-module data) are simply not counted here.
    const dayModules = new Map<string, Map<string, number>>();
    for (const p of userPings) {
      if (!p.module) continue;
      const key = adminDateKey(p.pingAt);
      const mods = dayModules.get(key) ?? new Map<string, number>();
      mods.set(p.module, (mods.get(p.module) ?? 0) + 1);
      dayModules.set(key, mods);
    }
    dayAgg.forEach((d, dateKey) => {
      const mods = dayModules.get(dateKey);
      const moduleMinutes = Object.keys(MODULE_LABELS)
        .filter((m) => mods?.has(m))
        .map((m) => ({ module: m, label: MODULE_LABELS[m], minutes: mods!.get(m)! }));
      daily.push({ dateKey, userId: u.id, name: u.name, first: d.first, last: d.last, totalMs: d.totalMs, sessionCount: d.sessionCount, moduleMinutes });
    });
  }

  daily.sort((a, b) => (a.dateKey === b.dateKey ? a.name.localeCompare(b.name) : b.dateKey.localeCompare(a.dateKey)));
  return { users, daily };
}

/** "3h 42m" / "0m" — never blank, so an admin with no activity still reads as zero, not missing. */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
