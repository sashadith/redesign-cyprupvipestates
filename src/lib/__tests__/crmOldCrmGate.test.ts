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

test("the old CRM layout sends visitors without a session to the login before the gate", () => {
  const src = readFileSync("src/app/admin/(panel)/crm/layout.tsx", "utf8");
  const login = src.indexOf('redirect("/admin/login")');
  assert.ok(login > -1, "layout redirects to /admin/login");
  assert.ok(login < src.indexOf("mayUseOldCrm(user)"), "login redirect comes before the gate");
});

test("the old CRM CSV export applies the same gate and answers 403", () => {
  const src = readFileSync("src/app/admin/(panel)/crm/export/route.ts", "utf8");
  assert.match(src, /import \{ mayUseOldCrm \} from "@\/lib\/crm\/oldCrmGate"/);
  assert.match(src, /import \{ loadCrmUser \} from "@\/lib\/crm\/accessUser"/);
  assert.match(src, /if \(!mayUseOldCrm\(crmUser\)\) return new Response\("Forbidden", \{ status: 403 \}\)/);
});
