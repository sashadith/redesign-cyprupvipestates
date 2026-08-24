import { prisma } from "@/lib/prisma";

// Consecutive pings within this gap belong to the same work session; a
// bigger gap means the admin stepped away (or closed the tab) and a new
// session starts on the next ping. 15 min gives comfortable headroom over
// the 3 min ping throttle (see src/lib/adminActivity.ts) so normal browsing
// between admin pages never fragments into false session boundaries.
const SESSION_GAP_MS = 15 * 60_000;
// A session built from a single ping (or two pings seconds apart) would
// otherwise report ~0 duration despite the admin clearly having the panel
// open — floor it to the ping throttle window so "I was there" always shows
// as some non-zero time.
const MIN_SESSION_MS = 3 * 60_000;

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
