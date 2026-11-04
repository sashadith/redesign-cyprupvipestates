import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerShareFor } from "@/lib/partner/share";

test("partnerShareFor picks the share by mode", () => {
  assert.equal(partnerShareFor({ mode: "HANDOVER", handoverShare: 10, fixShare: 25 }), 10);
  assert.equal(partnerShareFor({ mode: "FIX", handoverShare: 10, fixShare: 25 }), 25);
});
