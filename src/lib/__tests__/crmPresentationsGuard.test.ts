import { test } from "node:test";
import assert from "node:assert/strict";
import { presentationGuard } from "../crm/presentations/guard";
import type { CrmUser } from "../crm/access";

const user = (over: Partial<CrmUser> = {}): CrmUser => ({
  id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false, ...over,
});

test("restricted employee on a colleague's lead gets not found", () => {
  assert.equal(presentationGuard(user(), { assignedToId: "u2" }, "edit"), "Lead not found.");
});
test("missing lead gets not found", () => {
  assert.equal(presentationGuard(user(), null, "edit"), "Lead not found.");
});
test("assignee may edit", () => {
  assert.equal(presentationGuard(user(), { assignedToId: "u1" }, "edit"), null);
});
test("assignee may not delete", () => {
  assert.equal(presentationGuard(user(), { assignedToId: "u1" }, "delete"), "Only the owner can delete a selection.");
});
test("owner may delete", () => {
  assert.equal(presentationGuard(user({ isOwner: true }), { assignedToId: "u2" }, "delete"), null);
});
test("inactive user gets not found", () => {
  assert.equal(presentationGuard(user({ isActive: false, isOwner: true }), { assignedToId: "u1" }, "edit"), "Lead not found.");
});
