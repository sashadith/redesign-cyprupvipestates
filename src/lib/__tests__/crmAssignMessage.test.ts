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

test("the owner notification links to the new CRM cockpit, not the old CRM", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/lib/crm/assignLead.ts", "utf8");
  assert.match(src, /process\.env\.NEXT_PUBLIC_SITE_URL \|\| "http:\/\/72\.60\.89\.239"\}\/crm\/leads\/\$\{leadId\}`/);
  assert.doesNotMatch(src, /\/admin\/crm\//);
});
