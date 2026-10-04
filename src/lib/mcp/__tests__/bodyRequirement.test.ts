import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyRequirement } from "@/lib/crm/logInteraction";

test("bodyRequirement: every type needs content, except an email log with a subject", () => {
  assert.deepEqual(bodyRequirement("NOTE", "", undefined), { content: null, subject: null, ok: false });
  assert.deepEqual(bodyRequirement("CALL", "  ", undefined), { content: null, subject: null, ok: false });
  assert.deepEqual(bodyRequirement("EMAIL_OUT", "", "Re: villa"), { content: null, subject: "Re: villa", ok: true });
  assert.deepEqual(bodyRequirement("EMAIL_IN", "", ""), { content: null, subject: null, ok: false });
  assert.deepEqual(bodyRequirement("WHATSAPP_OUT", "hi", undefined), { content: "hi", subject: null, ok: true });
});
