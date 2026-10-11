// "A cron that stopped firing writes no row at all" — the Action Center only
// surfaces that in the once-a-day digest, too slow for the lead importer. So
// two frequent crons watch each other: meta-leadgen-poll checks email-inbound,
// email-inbound checks meta-leadgen-poll. If the whole crontab dies, the daily
// digest's cron-health rule remains the backstop.
import { prisma } from "@/lib/prisma";
import { logCronRun } from "@/lib/cronLog";
import { alertBoth } from "./notify";

const REALERT_MS = 24 * 3_600_000;

/** Alerts (Telegram + email) when `job`'s newest log row is older than
 *  `maxAgeMs` — once per outage, repeated daily while it lasts. A job that has
 *  never logged a row is left to the Action Center (not installed yet ≠ died). */
export async function checkCronFreshness(job: string, maxAgeMs: number): Promise<"fresh" | "stale-alerted" | "stale-quiet" | "never-ran"> {
  const latest = await prisma.cronRunLog.findFirst({ where: { job }, orderBy: { ranAt: "desc" }, select: { ranAt: true } });
  if (!latest) return "never-ran";
  const age = Date.now() - latest.ranAt.getTime();
  if (age <= maxAgeMs) return "fresh";
  const marker = `notified:stale:${job}`;
  const lastAlert = await prisma.cronRunLog.findFirst({ where: { job: marker }, orderBy: { ranAt: "desc" }, select: { ranAt: true } });
  if (lastAlert && lastAlert.ranAt > latest.ranAt && Date.now() - lastAlert.ranAt.getTime() < REALERT_MS) return "stale-quiet";
  const minutes = Math.round(age / 60_000);
  await alertBoth(
    `${job} has not run for ${minutes} min`,
    `⚠️ ${job} has not run for ${minutes} minutes (last run ${latest.ranAt.toISOString()}). Check the crontab and pm2 on the VPS.` +
      (job === "meta-leadgen-poll" ? "\nThe Meta lead safety-net poller is down — webhook leads still arrive; once it runs again it automatically looks back to its last successful run." : ""),
  );
  await logCronRun(marker, true);
  return "stale-alerted";
}

const POLL_JOB = "meta-leadgen-poll";
const TOKEN_MARKER = "notified:meta-leadgen-token";

/** The token alert's own throttle — deliberately NOT the poll job's failure
 *  streak, which a single stuck lead or a form-listing error keeps open and
 *  would then hold this alert back for a day. Due when the token broke since
 *  the last alert (a poll run that wasn't a token failure happened after it),
 *  else once a day while it stays broken. */
export async function tokenAlertDue(): Promise<boolean> {
  const [lastAlert, lastTokenOk] = await Promise.all([
    prisma.cronRunLog.findFirst({ where: { job: TOKEN_MARKER }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
    prisma.cronRunLog.findFirst({ where: { job: POLL_JOB, NOT: { message: { startsWith: "token invalid" } } }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
  ]);
  if (!lastAlert) return true;
  if (lastTokenOk && lastTokenOk.ranAt > lastAlert.ranAt) return true;
  return Date.now() - lastAlert.ranAt.getTime() >= REALERT_MS;
}

export const markTokenAlerted = () => logCronRun(TOKEN_MARKER, true);

/** Look-back for a regular run: 48 h, or — after an outage (token broken,
 *  crontab down) — back to 1 h before the last run that actually listed the
 *  forms, so the gap is caught up automatically. "Listed" = the run wrote its
 *  normal summary ("N form(s), …"), even if single leads failed: those are
 *  retried by id anyway (unfinishedLeadgenIds), so they must not drag the
 *  window open to 90 days. Capped at Meta's 90-day retention. */
export async function autoSinceHours(defaultHours: number): Promise<number> {
  const lastOk = await prisma.cronRunLog.findFirst({ where: { job: POLL_JOB, message: { contains: " form(s), " } }, orderBy: { ranAt: "desc" }, select: { ranAt: true } });
  if (!lastOk) return defaultHours;
  const gapHours = Math.ceil((Date.now() - lastOk.ranAt.getTime()) / 3_600_000) + 1;
  return Math.min(Math.max(defaultHours, gapHours), 90 * 24);
}
