import { test } from "node:test";
import assert from "node:assert/strict";
import { assignToast } from "@/lib/crm/assignMessage";

const ok = (telegram: boolean, email: boolean, changed = true) => ({ ok: true as const, notified: { telegram, email }, changed });

test("the toast says exactly which notifications went out", () => {
  assert.equal(assignToast("Sophie", ok(true, true)), "Assigned to Sophie. Notified on Telegram and email.");
  assert.equal(assignToast("Sophie", ok(true, false)), "Assigned to Sophie. Notified on Telegram only.");
  assert.equal(assignToast("Sophie", ok(false, true)), "Assigned to Sophie. Notified by email only.");
  assert.equal(assignToast("Sophie", ok(false, false)), "Assigned to Sophie. Notification failed — tell them directly.");
});

test("re-assigning to the current owner says so instead of claiming a notice", () => {
  assert.equal(assignToast("Sophie", ok(false, false, false)), "Already assigned to Sophie.");
});
