import { test } from "node:test";
import assert from "node:assert/strict";
import { UpdateLeadInput, normalizedEmail, unknownFields, unknownFieldsMessage } from "@/lib/mcp/tools/updateLeadInput";

const leadId = "11111111-1111-4111-8111-111111111111";

test("a field the tool does not know survives parsing, so it can be refused instead of silently dropped", () => {
  const r = UpdateLeadInput.safeParse({ leadId, phone: "+44 1234", firstName: "Ann" });
  assert.equal(r.success, true);
  assert.deepEqual(unknownFields(r.success ? r.data : {}), ["firstName", "phone"]);
  const msg = unknownFieldsMessage(["phone"]);
  assert.match(msg, /cannot change phone/);
  assert.match(msg, /email/);
  assert.doesNotMatch(msg, /leadId/);
});

test("email, owner and bucket are supported fields", () => {
  const r = UpdateLeadInput.safeParse({ leadId, email: " ann@example.com ", assignedTo: "Sascha Dith", bucket: "partner" });
  assert.equal(r.success, true);
  assert.deepEqual(unknownFields(r.success ? r.data : {}), []);
});

test("an email without a valid shape is refused; empty and null both remove it", () => {
  assert.equal(UpdateLeadInput.safeParse({ leadId, email: "ann@example" }).success, false);
  assert.equal(UpdateLeadInput.safeParse({ leadId, email: "not an email" }).success, false);
  assert.equal(UpdateLeadInput.safeParse({ leadId, email: "" }).success, true);
  assert.equal(normalizedEmail(" Ann@Example.com "), "Ann@Example.com");
  assert.equal(normalizedEmail(""), null);
  assert.equal(normalizedEmail(null), null);
  assert.equal(normalizedEmail(undefined), undefined);
});

test("only the Leads and Partner buckets can be set", () => {
  assert.equal(UpdateLeadInput.safeParse({ leadId, bucket: "newsletter" }).success, false);
  assert.equal(UpdateLeadInput.safeParse({ leadId, bucket: "leads" }).success, true);
});
