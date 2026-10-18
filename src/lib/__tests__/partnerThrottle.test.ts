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
