import { test } from "node:test";
import assert from "node:assert/strict";
import { isRtlDoc } from "@/app/components/useIsRtl";

test("isRtlDoc: undefined document is not RTL", () => {
  assert.equal(isRtlDoc(undefined), false);
});

test('isRtlDoc: documentElement.dir === "rtl" is RTL', () => {
  assert.equal(isRtlDoc({ documentElement: { dir: "rtl" } }), true);
});

test('isRtlDoc: dir "ltr" or missing is not RTL', () => {
  assert.equal(isRtlDoc({ documentElement: { dir: "ltr" } }), false);
  assert.equal(isRtlDoc({ documentElement: {} }), false);
  assert.equal(isRtlDoc({}), false);
});
