import { test } from "node:test";
import assert from "node:assert/strict";
import { digitsOf } from "@/lib/mcp/tools/searchLeads";

test("digitsOf strips everything but digits", () => {
  assert.equal(digitsOf("+49 151 / 234-5"), "491512345");
  assert.equal(digitsOf("max@example.com"), "");
});
