import { prisma } from "@/lib/prisma";

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

export type ActivitySession = { start: Date; end: Date; durationMs: number };
export type UserActivityReport = {
  userId: string;
  name: string;
  email: string;
  role: string;
  sessions: ActivitySession[];
  totalMs: number;
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
export async function getAdminActivityReport(from: Date, to: Date): Promise<UserActivityReport[]> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  const pings = await prisma.adminActivityPing.findMany({
    where: { pingAt: { gte: from, lt: to } },
    select: { userId: true, pingAt: true },
    orderBy: { pingAt: "asc" },
  });
  const byUser = new Map<string, Date[]>();
  for (const p of pings) {
    const arr = byUser.get(p.userId) ?? [];
    arr.push(p.pingAt);
    byUser.set(p.userId, arr);
  }
  return users.map((u) => {
    const sessions = clusterPings(byUser.get(u.id) ?? []);
    const totalMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
    return { userId: u.id, name: u.name, email: u.email, role: u.role, sessions, totalMs };
  });
}

/** "3h 42m" / "0m" — never blank, so an admin with no activity still reads as zero, not missing. */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
