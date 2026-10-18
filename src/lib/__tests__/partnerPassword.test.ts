import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem, hashPassword, verifyPassword } from "@/lib/partner/password";

test("password policy edges", () => {
  assert.equal(passwordProblem("a".repeat(9)), "too_short");
  assert.equal(passwordProblem("a".repeat(10)), null);
  assert.equal(passwordProblem("1234567890"), "digits_only");
  assert.equal(passwordProblem("123456789a"), null);
  assert.equal(passwordProblem("a".repeat(200)), null);
  assert.equal(passwordProblem("a".repeat(201)), "too_long");
  assert.equal(passwordProblem("1".repeat(201)), "too_long");
});
test("hash verifies own password and rejects another", async () => {
  const h = await hashPassword("correct horse battery");
  assert.match(h, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong horse battery", h), false);
});
