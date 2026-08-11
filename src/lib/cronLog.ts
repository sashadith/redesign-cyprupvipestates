import { prisma } from "@/lib/prisma";

// Direct write — used both by withCronLog below and for the per-developer
// sub-rows feed-sync/drive-sync log (job namespaced "feed-sync:<dev>" /
// "drive-sync:<developer>") alongside their own whole-run aggregate row.
// Best-effort: a logging failure must never break the cron response itself.
export async function logCronRun(job: string, ok: boolean, message?: string, durationMs?: number) {
  try {
    await prisma.cronRunLog.create({ data: { job, ok, message: message?.slice(0, 500), durationMs } });
  } catch (e) {
    console.error(`CronRunLog write failed for job=${job}:`, e);
  }
}

// Wraps a cron job body so a crash still produces a row (ok=false, message =
// the caught error) — a run that dies before ever returning is exactly the
// case Action Center rule (j) needs to see, so the log write happens in a
// finally block, not just on the success path.
//
// `okFrom` (2026-08-11, Olias Drive-sync incident) — without it, `ok` is
// hardcoded true as soon as `fn()` resolves without throwing, regardless of
// what the result actually says. syncAllDrives()/syncAll() both catch every
// per-developer/per-project error internally and always resolve normally
// (by design — one bad developer must not abort the whole run), so the
// aggregate "drive-sync"/"feed-sync" row logged ok:true for 3 straight weeks
// while every single developer's Drive sync was failing underneath it —
// nothing was ever watching the per-developer sub-rows. Pass `okFrom` to
// derive the aggregate row's `ok` from the actual result instead of just
// "didn't throw"; omit it for jobs with no partial-failure shape (single
// linear pipelines) where "didn't throw" already means "ok".
export async function withCronLog<T>(job: string, fn: () => Promise<T>, summarize?: (result: T) => string, okFrom?: (result: T) => boolean): Promise<T> {
  const start = Date.now();
  let ok = false;
  let message: string | undefined;
  try {
    const result = await fn();
    ok = okFrom ? okFrom(result) : true;
    message = summarize ? summarize(result) : undefined;
    return result;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await logCronRun(job, ok, message, Date.now() - start);
  }
}

// Throttles a recurring failure notification: fires once when a streak of
// failures begins, then at most once every `throttleDays` while it
// continues — never once per run, or a job failing daily (like Olias's Drive
// sync did for 3 weeks) would mean one Telegram/email per day forever. Own
// job-key namespace ("notified:<job>", never colliding with any
// startsWith(job) filter since it doesn't start with `job`) records exactly
// when a notification was last sent for this job, distinct from the job's
// own pass/fail history. A later success resets the streak — an old marker
// from a since-resolved failure never suppresses a genuinely new one.
export async function shouldNotifyFailureStreak(job: string, throttleDays = 7): Promise<boolean> {
  const [lastSuccess, lastNotified] = await Promise.all([
    prisma.cronRunLog.findFirst({ where: { job, ok: true }, orderBy: { ranAt: "desc" } }),
    prisma.cronRunLog.findFirst({ where: { job: `notified:${job}` }, orderBy: { ranAt: "desc" } }),
  ]);
  const streakStillCurrent = lastNotified && (!lastSuccess || lastNotified.ranAt > lastSuccess.ranAt);
  if (!streakStillCurrent) return true; // new streak (or never notified before) — always notify
  return Date.now() - lastNotified!.ranAt.getTime() >= throttleDays * 86_400_000;
}

export async function markFailureStreakNotified(job: string): Promise<void> {
  await logCronRun(`notified:${job}`, true);
}
