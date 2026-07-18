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
export async function withCronLog<T>(job: string, fn: () => Promise<T>, summarize?: (result: T) => string): Promise<T> {
  const start = Date.now();
  let ok = false;
  let message: string | undefined;
  try {
    const result = await fn();
    ok = true;
    message = summarize ? summarize(result) : undefined;
    return result;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await logCronRun(job, ok, message, Date.now() - start);
  }
}
