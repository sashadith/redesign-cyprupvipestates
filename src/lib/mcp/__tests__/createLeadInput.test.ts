import { test } from "node:test";
import assert from "node:assert/strict";
import { CreateLeadInput } from "@/lib/mcp/tools/createLeadInput";

test("first name is the only required field; defaults mirror the admin form", () => {
  const r = CreateLeadInput.safeParse({ firstName: " Anna " });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.firstName, "Anna");
    assert.equal(r.data.status, "NEW");
    assert.equal(r.data.allowDuplicate, false);
  }
  assert.equal(CreateLeadInput.safeParse({ firstName: "" }).success, false);
  assert.equal(CreateLeadInput.safeParse({ lastName: "Doe" }).success, false);
});

test("email is optional but must be valid when given; budgets must be ordered", () => {
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", email: "not-an-email" }).success, false);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", email: "a@b.io" }).success, true);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", budgetMin: 500_000, budgetMax: 300_000 }).success, false);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", budgetMin: 300_000, budgetMax: 500_000 }).success, true);
});

test("enums are the admin's: property types, timeline, financing, language, status", () => {
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", propertyTypeInterest: ["Villa", "Penthouse"] }).success, true);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", propertyTypeInterest: ["Castle"] }).success, false);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", timeline: "ONE_YEAR", financing: "CASH", languagePreference: "de", status: "CONTACTED" }).success, true);
  assert.equal(CreateLeadInput.safeParse({ firstName: "A", status: "DELETED" }).success, false);
});
