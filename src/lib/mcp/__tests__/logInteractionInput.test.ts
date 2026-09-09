import { test } from "node:test";
import assert from "node:assert/strict";
import { LogInteractionInput, LOGGABLE_TYPES } from "@/lib/mcp/tools/logInteractionInput";

const leadId = "11111111-1111-4111-8111-111111111111";

test("the tool accepts every type the admin's log buttons write, incl. both email directions", () => {
  assert.deepEqual([...LOGGABLE_TYPES], ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN", "EMAIL_OUT", "EMAIL_IN"]);
  for (const type of ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN", "EMAIL_OUT", "EMAIL_IN"]) {
    assert.equal(LogInteractionInput.safeParse({ leadId, type, body: "hello" }).success, true, type);
  }
});

test("an email log may be subject-only, like the admin's '+ Email log' form", () => {
  const r = LogInteractionInput.safeParse({ leadId, type: "EMAIL_OUT", subject: "Re: Villa in Tala" });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.body, undefined);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "EMAIL_IN", subject: "  " }).success, false);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "EMAIL_IN" }).success, false);
});

test("every non-email type still requires a body; subject is ignored there", () => {
  for (const type of ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN"]) {
    assert.equal(LogInteractionInput.safeParse({ leadId, type, subject: "x" }).success, false, type);
    assert.equal(LogInteractionInput.safeParse({ leadId, type, body: "   " }).success, false, `${type} blank`);
  }
});

test("validation message names the missing field", () => {
  const r = LogInteractionInput.safeParse({ leadId, type: "EMAIL_OUT" });
  assert.equal(r.success, false);
  assert.match(r.success ? "" : r.error.issues[0].message, /body or at least a subject/);
});
