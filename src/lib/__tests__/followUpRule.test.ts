import { test } from "node:test";
import assert from "node:assert/strict";
import { keepsManualFollowUp, manualFollowUpData } from "@/lib/crm/followUpRule";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";

const now = new Date("2026-11-04T10:00:00Z");

test("a manual follow-up date still ahead is kept; a passed one, or an automatic one, is not", () => {
  assert.equal(keepsManualFollowUp({ followUpManual: true, nextFollowUpAt: new Date("2026-11-20T09:00:00Z") }, now), true);
  assert.equal(keepsManualFollowUp({ followUpManual: true, nextFollowUpAt: new Date("2026-11-03T09:00:00Z") }, now), false);
  assert.equal(keepsManualFollowUp({ followUpManual: false, nextFollowUpAt: new Date("2026-11-20T09:00:00Z") }, now), false);
  assert.equal(keepsManualFollowUp({ followUpManual: true, nextFollowUpAt: null }, now), false);
});

test("setting a date by hand flags it manual; clearing it clears the flag", () => {
  const at = new Date("2026-11-20T09:00:00Z");
  assert.deepEqual(manualFollowUpData(at), { nextFollowUpAt: at, followUpManual: true });
  assert.deepEqual(manualFollowUpData(null), { nextFollowUpAt: null, followUpManual: false });
});

test("crm_log_interaction takes an optional followUpAt (ISO date or null)", () => {
  const leadId = "11111111-1111-4111-8111-111111111111";
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL", body: "x", followUpAt: "2026-11-20T09:00:00+02:00" }).success, true);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL", body: "x", followUpAt: null }).success, true);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL", body: "x", followUpAt: "next week" }).success, false);
});
