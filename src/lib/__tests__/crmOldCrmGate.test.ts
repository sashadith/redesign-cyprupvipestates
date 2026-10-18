import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayUseOldCrm } from "@/lib/crm/oldCrmGate";

const base = { id: "u", role: "EDITOR" as const, isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };

test("restricted employees are kept out of the old CRM", () => {
  assert.equal(mayUseOldCrm(base), false);
});

test("employees who see all leads, admins and the owner may use it", () => {
  assert.equal(mayUseOldCrm({ ...base, canSeeColleagues: true }), true);
  assert.equal(mayUseOldCrm({ ...base, role: "ADMIN" }), true);
  assert.equal(mayUseOldCrm({ ...base, isOwner: true }), true);
});

test("no user, no access", () => {
  assert.equal(mayUseOldCrm(null), false);
});

test("the old CRM layout calls the gate and redirects to the new CRM", () => {
  const src = readFileSync("src/app/admin/(panel)/crm/layout.tsx", "utf8");
  assert.match(src, /import \{ mayUseOldCrm \} from "@\/lib\/crm\/oldCrmGate"/);
  assert.match(src, /mayUseOldCrm\(user\)/);
  assert.match(src, /redirect\("\/crm\/pipeline"\)/);
});
