import { test } from "node:test";
import assert from "node:assert/strict";
import { cyprusTime, dayPlus, resolveFollowUp } from "@/lib/crm/followUp";
import { dayKey } from "@/lib/crm/today";

const NOW = new Date("2026-11-01T13:00:00Z"); // 15:00 Sunday 1 Nov in Cyprus (UTC+2)

test("a follow-up is stored at 09:00 Cyprus time on the chosen day, either side of the clock change", () => {
  assert.equal(cyprusTime("2026-11-04").toISOString(), "2026-11-04T07:00:00.000Z");
  assert.equal(cyprusTime("2026-10-20").toISOString(), "2026-10-20T06:00:00.000Z");
  assert.equal(dayKey(cyprusTime("2026-12-31")), "2026-12-31");
});

test("free date, shortcuts and clear", () => {
  const free = resolveFollowUp({ day: "2026-11-20" }, NOW);
  assert.ok(free.ok && free.day === "2026-11-20" && free.at?.toISOString() === "2026-11-20T07:00:00.000Z");
  const quick = resolveFollowUp({ days: 3 }, NOW);
  assert.ok(quick.ok && quick.day === "2026-11-04");
  assert.equal(dayPlus(NOW, 7), "2026-11-08");
  const today = resolveFollowUp({ day: "2026-11-01" }, NOW);
  assert.ok(today.ok && today.day === "2026-11-01");
  assert.deepEqual(resolveFollowUp({ clear: true }, NOW), { ok: true, at: null, day: null });
});

test("refuses past days, impossible dates, far-off dates, unknown shortcuts and empty input", () => {
  for (const input of [{ day: "2026-10-31" }, { day: "2026-02-30" }, { day: "2029-01-01" }, { day: "01.12.2026" }, { days: 2 }, { days: "3" }, {}]) {
    assert.equal(resolveFollowUp(input, NOW).ok, false, JSON.stringify(input));
  }
});
