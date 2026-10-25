import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeFor, assertCanEdit, withScope } from "@/lib/mcp/leadScope";
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

test("withScope ANDs the scope in, so an OR-shaped scope cannot replace the query's OR", () => {
  const query = { deletedAt: null, OR: [{ firstName: { contains: "max" } }, { email: { contains: "max" } }] };
  const scope = { OR: [{ assignedToId: "u1" }, { partnerId: "p1" }] } as any;
  assert.deepEqual(withScope(query, scope), { deletedAt: null, OR: query.OR, AND: [scope] });
});

test("withScope keeps an existing AND (array or single object) and appends the scope", () => {
  const scope = { assignedToId: "u1" };
  assert.deepEqual(withScope({ AND: [{ status: "NEW" }] }, scope), { AND: [{ status: "NEW" }, scope] });
  assert.deepEqual(withScope({ AND: { status: "NEW" } }, scope), { AND: [{ status: "NEW" }, scope] });
});

test("withScope does not let the scope override the query's own keys", () => {
  const where = withScope({ assignedToId: "me" }, { assignedToId: "u1" });
  assert.deepEqual(where, { assignedToId: "me", AND: [{ assignedToId: "u1" }] });
});
