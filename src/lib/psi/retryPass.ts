// One retry pass for a batch of independent jobs (2026-10-16, psi-sync).
// On 2026-10-16 PageSpeed's Lighthouse gave up on one page (nginx 499,
// net::ERR_TIMED_OUT) and the whole nightly run was reported as failed,
// although the page answered in ~1 s minutes later. Jobs that fail in the
// first pass are run ONE more time after a pause; only what fails again
// counts as failed. Pure apart from the injected sleep — tested directly.

export type PassResult<T> = { item: T; ok: boolean; error?: string; retried: boolean };

export async function runWithOneRetry<T>(
  items: T[],
  run: (item: T) => Promise<void>,
  opts: { betweenMs?: number; retryAfterMs?: number; sleep?: (ms: number) => Promise<unknown> } = {},
): Promise<{ results: PassResult<T>[]; recoveredOnRetry: number }> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const attempt = async (item: T): Promise<string | null> => {
    try {
      await run(item);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  const results: PassResult<T>[] = [];
  for (const item of items) {
    const error = await attempt(item);
    results.push(error === null ? { item, ok: true, retried: false } : { item, ok: false, error, retried: false });
    if (opts.betweenMs) await sleep(opts.betweenMs);
  }

  const failed = results.filter((r) => !r.ok);
  let recoveredOnRetry = 0;
  if (failed.length) {
    if (opts.retryAfterMs) await sleep(opts.retryAfterMs);
    for (const r of failed) {
      const error = await attempt(r.item);
      r.retried = true;
      if (error === null) {
        r.ok = true;
        r.error = undefined;
        recoveredOnRetry++;
      } else {
        r.error = error;
      }
      if (opts.betweenMs) await sleep(opts.betweenMs);
    }
  }
  return { results, recoveredOnRetry };
}
