import { test } from "node:test";
import assert from "node:assert/strict";
import { safeMailto, waDigits } from "@/lib/crm/contactLinks";

test("mailto only for plain addresses", () => {
  assert.equal(safeMailto("anna.k@example.com"), "mailto:anna.k@example.com");
  assert.equal(safeMailto(" anna@example.de "), "mailto:anna@example.de");
  assert.equal(safeMailto("a@b.com?cc=x@evil.com"), null);
  assert.equal(safeMailto("a@b.com&body=hi"), null);
  assert.equal(safeMailto("a@b.com#x"), null);
  assert.equal(safeMailto("a b@c.com"), null);
  assert.equal(safeMailto("not-an-email"), null);
  assert.equal(safeMailto(null), null);
});

test("wa.me digits drop formatting and a leading 00", () => {
  assert.equal(waDigits("+357 99 123 456"), "35799123456");
  assert.equal(waDigits("0049 (171) 555-1234"), "491715551234");
  assert.equal(waDigits("abc"), null);
  assert.equal(waDigits(null), null);
});
