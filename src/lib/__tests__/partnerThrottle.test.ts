import { test } from "node:test";
import assert from "node:assert/strict";
import { makeThrottle } from "@/lib/partner/throttle";

test("throttle: allows max, blocks within window, resets after window", () => {
  const t = makeThrottle(3, 1000);
  assert.deepEqual([t.hit("a", 0), t.hit("a", 1), t.hit("a", 2)], [true, true, true]);
  assert.equal(t.hit("a", 3), false);
  assert.equal(t.hit("b", 3), true);
  assert.equal(t.hit("a", 1000), true);
});
test("throttle: refused calls do not extend the window", () => {
  const t = makeThrottle(1, 1000);
  assert.equal(t.hit("a", 0), true);
  assert.equal(t.hit("a", 900), false);
  assert.equal(t.hit("a", 1000), true);
});
test("throttle: reset clears a key", () => {
  const t = makeThrottle(1, 1000);
  t.hit("a", 0);
  assert.equal(t.hit("a", 1), false);
  t.reset("a");
  assert.equal(t.hit("a", 2), true);
});
test("throttle: expired buckets are swept and the hard cap holds", () => {
  const t = makeThrottle(1, 1000);
  for (let i = 0; i < 5001; i++) t.hit("k" + i, 0);
  assert.equal(t.size(), 5001);
  t.hit("fresh", 5000); // sweep: everything older than the window goes
  assert.equal(t.size(), 1);
  const u = makeThrottle(1, 1_000_000);
  for (let i = 0; i < 25000; i++) u.hit("k" + i, i);
  assert.ok(u.size() <= 20000);
  assert.equal(u.hit("k24999", 25000), false); // newest survived
});
