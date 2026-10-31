import { test } from "node:test";
import assert from "node:assert/strict";
import { notDueYet } from "@/lib/syncInterval";

const at = (iso: string) => new Date(iso).getTime();

test("a daily cron at a fixed minute runs every day, not every second day", () => {
  // Olias Homes, 2026-10-31: last run finished 04:32:11, cron fires 04:30:03.
  assert.equal(notDueYet("daily", "2026-10-30T04:32:11.203Z", at("2026-10-31T04:30:03Z")), false);
  // Stylianides: finished 02:47 → next 02:45 run is due.
  assert.equal(notDueYet(null, "2026-11-01T02:47:00Z", at("2026-11-02T02:45:02Z")), false);
});

test("a weekly sync runs after 7 days, not 8", () => {
  // Motive Point: 10-23 04:30:27 → the 10-30 04:30:03 run is due.
  assert.equal(notDueYet("weekly", "2026-10-23T04:30:27.768Z", at("2026-10-30T04:30:03Z")), false);
  assert.equal(notDueYet("weekly", "2026-10-23T04:30:27Z", at("2026-10-29T04:30:03Z")), true);
});

test("a run well inside the interval is still skipped", () => {
  // Stylianides' first import (16:03) and the 02:45 run the next night.
  assert.equal(notDueYet("daily", "2026-10-30T16:03:56.660Z", at("2026-10-31T02:45:02Z")), true);
  assert.equal(notDueYet("2day", "2026-10-30T04:32:00Z", at("2026-10-31T04:30:00Z")), true);
  assert.equal(notDueYet("2day", "2026-10-30T04:32:00Z", at("2026-11-01T04:30:00Z")), false);
});

test("off never runs; never synced always runs", () => {
  assert.equal(notDueYet("off", null), true);
  assert.equal(notDueYet("off", "2020-01-01T00:00:00Z"), true);
  assert.equal(notDueYet("daily", null), false);
  assert.equal(notDueYet("weekly", undefined), false);
});
