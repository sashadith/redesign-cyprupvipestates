import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_KEYS, TOOL_LABEL, isToolKey } from "@/lib/toolSwitches";

test("exactly the two switchable tools, each with a label", () => {
  assert.deepEqual([...TOOL_KEYS], ["seo_advisor", "page_power"]);
  for (const k of TOOL_KEYS) assert.ok(TOOL_LABEL[k]);
});

test("isToolKey rejects anything else", () => {
  assert.equal(isToolKey("page_power"), true);
  assert.equal(isToolKey("seo_advisor"), true);
  assert.equal(isToolKey("Page_Power"), false);
  assert.equal(isToolKey(""), false);
  assert.equal(isToolKey("__proto__"), false);
});
