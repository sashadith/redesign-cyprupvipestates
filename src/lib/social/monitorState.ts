// The durable half of the Typefully outage rules (socialReminders.ts): one row
// in social_monitor_state, so a pm2 restart or a second worker cannot reset the
// failure count. Every transition is a single conditional UPDATE, so two
// overlapping cron runs cannot both send the alert or the recovery message.
import { prisma } from "@/lib/prisma";
import { outageConfirmed, type MonitorState } from "./socialReminders";

export const MONITOR_STATE_ID = "typefully";
const where = { id: MONITOR_STATE_ID };

async function ensureRow() {
  // The migration inserts it; this only covers a DB that lost it.
  await prisma.socialMonitorState.upsert({ where, create: { id: MONITOR_STATE_ID }, update: {} });
}

const toState = (r: { consecutiveFailures: number; firstFailureAt: Date | null; alertedAt: Date | null; recoveryPending: boolean; upcomingPlannedAt: Date[] }): MonitorState => ({
  consecutiveFailures: r.consecutiveFailures, firstFailureAt: r.firstFailureAt, alertedAt: r.alertedAt,
  recoveryPending: r.recoveryPending, upcomingPlannedAt: r.upcomingPlannedAt ?? [],
});

export async function readMonitorState(): Promise<MonitorState | null> {
  const r = await prisma.socialMonitorState.findUnique({ where });
  return r ? toState(r) : null;
}

export async function recordFailure(now: Date, error: string): Promise<MonitorState> {
  await ensureRow();
  await prisma.socialMonitorState.update({
    where,
    data: { consecutiveFailures: { increment: 1 }, lastFailureAt: now, lastError: error, recoveryPending: false },
  });
  await prisma.socialMonitorState.updateMany({ where: { ...where, firstFailureAt: null }, data: { firstFailureAt: now } });
  return toState(await prisma.socialMonitorState.findUniqueOrThrow({ where }));
}

export async function recordSuccess(_now: Date, upcoming: Date[]): Promise<{ recoveryPending: boolean }> {
  await ensureRow();
  // Alert out → recovery owed, in one statement (alerted_at cleared with it).
  await prisma.socialMonitorState.updateMany({ where: { ...where, alertedAt: { not: null } }, data: { alertedAt: null, recoveryPending: true } });
  const r = await prisma.socialMonitorState.update({
    where,
    data: { consecutiveFailures: 0, firstFailureAt: null, upcomingPlannedAt: upcoming },
  });
  return { recoveryPending: r.recoveryPending };
}

export async function claimAlert(now: Date): Promise<boolean> {
  const { count } = await prisma.socialMonitorState.updateMany({ where: { ...where, alertedAt: null }, data: { alertedAt: now } });
  return count === 1;
}
export async function releaseAlert(): Promise<void> {
  await prisma.socialMonitorState.updateMany({ where, data: { alertedAt: null } });
}
export async function claimRecovery(): Promise<boolean> {
  const { count } = await prisma.socialMonitorState.updateMany({ where: { ...where, recoveryPending: true }, data: { recoveryPending: false } });
  return count === 1;
}
export async function releaseRecovery(): Promise<void> {
  await prisma.socialMonitorState.updateMany({ where, data: { recoveryPending: true } });
}

/** For the Action Center and the digest: true = this outage already earned
 *  its alert, false = only a check or two failed (do not shout), null = the
 *  state could not be read (fall back to showing what the page itself saw). */
export async function outageConfirmedNow(now = new Date()): Promise<boolean | null> {
  try {
    const s = await readMonitorState();
    if (!s) return null;
    return s.alertedAt !== null || outageConfirmed(s, now);
  } catch {
    return null;
  }
}
