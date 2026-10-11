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
      (job === "meta-leadgen-poll" ? "\nThe Meta lead safety-net poller is down — webhook leads may still arrive, missed ones will not be picked up." : ""),
  );
  await logCronRun(marker, true);
  return "stale-alerted";
}
