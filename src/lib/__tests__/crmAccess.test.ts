import { test } from "node:test";
import assert from "node:assert/strict";
import { leadAccessWhere, canViewLead, canEditLead, canAssignLeads, seesAllLeads, type CrmUser } from "@/lib/crm/access";

const base: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
const own = { assignedToId: "u1" };
const colleague = { assignedToId: "u2" };
const unassigned = { assignedToId: null };

test("an employee without rights sees and edits only own leads", () => {
  assert.deepEqual(leadAccessWhere(base), { assignedToId: "u1" });
  assert.equal(canViewLead(base, own), true);
  assert.equal(canViewLead(base, colleague), false);
  assert.equal(canViewLead(base, unassigned), false);
  assert.equal(canEditLead(base, own), true);
  assert.equal(canEditLead(base, colleague), false);
  assert.equal(canAssignLeads(base), false);
});

test("see-colleagues grants viewing but not editing", () => {
  const u = { ...base, canSeeColleagues: true };
  assert.deepEqual(leadAccessWhere(u), {});
  assert.equal(canViewLead(u, colleague), true);
  assert.equal(canEditLead(u, colleague), false);
});

test("edit-colleagues without see-colleagues grants nothing extra", () => {
  const u = { ...base, canEditColleagues: true };
  assert.equal(canEditLead(u, colleague), false);
  assert.equal(seesAllLeads(u), false);
});

test("see + edit colleagues edits everyone's leads", () => {
  const u = { ...base, canSeeColleagues: true, canEditColleagues: true };
  assert.equal(canEditLead(u, colleague), true);
  assert.equal(canEditLead(u, unassigned), true);
});

test("admins and the owner see, edit and assign everything", () => {
  for (const u of [{ ...base, role: "ADMIN" as const }, { ...base, isOwner: true }]) {
    assert.deepEqual(leadAccessWhere(u), {});
    assert.equal(canEditLead(u, colleague), true);
    assert.equal(canAssignLeads(u), true);
  }
});

test("a deactivated user sees nothing", () => {
  const u = { ...base, role: "ADMIN" as const, isActive: false };
  assert.deepEqual(leadAccessWhere(u), { id: "__no_access__" });
  assert.equal(canViewLead(u, own), false);
  assert.equal(canEditLead(u, own), false);
});
