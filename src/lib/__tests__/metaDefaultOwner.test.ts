import { test } from "node:test";
import assert from "node:assert/strict";
import { metaOwnerSetting } from "@/lib/metaLeadgen/defaultOwner";

test("META_LEAD_DEFAULT_OWNER: unset means the account owner, 'off' disables, anything else names someone", () => {
  assert.deepEqual(metaOwnerSetting(undefined), { mode: "owner" });
  assert.deepEqual(metaOwnerSetting("  "), { mode: "owner" });
  assert.deepEqual(metaOwnerSetting("OWNER"), { mode: "owner" });
  assert.deepEqual(metaOwnerSetting("off"), { mode: "off" });
  assert.deepEqual(metaOwnerSetting(" Sascha Dith "), { mode: "named", value: "Sascha Dith" });
});
