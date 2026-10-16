import { test } from "node:test";
import assert from "node:assert/strict";
import { runWithOneRetry } from "@/lib/psi/retryPass";

/* psi-sync retries a failed URL once at the end of the run (2026-10-16). */
const noSleep = async () => {};

test("a job that fails once and then succeeds counts as ok — recovered on the retry", async () => {
  const calls: string[] = [];
  let first = true;
  const { results, recoveredOnRetry } = await runWithOneRetry(["/a", "/b", "/c"], async (u) => {
    calls.push(u);
    if (u === "/b" && first) { first = false; throw new Error("ERR_TIMED_OUT"); }
  }, { sleep: noSleep });
  assert.deepEqual(calls, ["/a", "/b", "/c", "/b"], "the retry comes after the whole first pass");
  assert.equal(recoveredOnRetry, 1);
  assert.deepEqual(results.map((r) => [r.item, r.ok, r.retried]), [["/a", true, false], ["/b", true, true], ["/c", true, false]]);
  assert.equal(results[1].error, undefined);
});

test("a job that fails twice stays failed, with the second error", async () => {
  let n = 0;
  const { results, recoveredOnRetry } = await runWithOneRetry(["/x"], async () => { n++; throw new Error(`fail ${n}`); }, { sleep: noSleep });
  assert.equal(n, 2, "exactly one retry, never more");
  assert.equal(recoveredOnRetry, 0);
  assert.deepEqual([results[0].ok, results[0].retried, results[0].error], [false, true, "fail 2"]);
});

test("all ok: no retry pass and no pause before it", async () => {
  const slept: number[] = [];
  const { results, recoveredOnRetry } = await runWithOneRetry(["/a", "/b"], async () => {}, { betweenMs: 5, retryAfterMs: 60_000, sleep: async (ms) => { slept.push(ms); } });
  assert.equal(recoveredOnRetry, 0);
  assert.ok(results.every((r) => r.ok && !r.retried));
  assert.deepEqual(slept, [5, 5], "only the spacing between requests, no 60 s pause");
});

test("with failures the retry waits retryAfterMs first", async () => {
  const slept: number[] = [];
  await runWithOneRetry(["/a"], async () => { throw new Error("x"); }, { retryAfterMs: 60_000, sleep: async (ms) => { slept.push(ms); } });
  assert.deepEqual(slept, [60_000]);
});
