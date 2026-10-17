import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeFor, assertCanEdit } from "@/lib/mcp/leadScope";
import type { CrmUser } from "@/lib/crm/access";

const editor: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };

test("a missing user gets a where-clause that matches nothing", () => {
  assert.deepEqual(scopeFor(null), { id: "__no_access__" });
});

test("a restricted employee is scoped to own leads", () => {
  assert.deepEqual(scopeFor(editor), { assignedToId: "u1" });
});

test("viewing a colleague's lead is fine, changing it is refused", () => {
  const viewer = { ...editor, canSeeColleagues: true };
  assert.deepEqual(scopeFor(viewer), {});
  assert.throws(() => assertCanEdit(viewer, { assignedToId: "u2" }), /view this lead but not change it/);
  assert.doesNotThrow(() => assertCanEdit(viewer, { assignedToId: "u1" }));
});
