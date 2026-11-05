import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditLead, canViewLead, leadEditError, PARTNER_WORKED_READONLY, type CrmUser } from "@/lib/crm/access";
import { EXCLUDE_PARTNER_WORKED } from "@/lib/crm/leadBucket";
import { presentationGuard } from "@/lib/crm/presentations/guard";
import { canTrashLead } from "@/lib/crm/trashView";
import { assertCanEdit } from "@/lib/mcp/leadScope";

// While a partner works his FIX client (Lead.workedByPartner), staff only read it.
const owner: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };
const admin: CrmUser = { ...owner, id: "a1", role: "ADMIN" };
const boss: CrmUser = { ...owner, id: "o1", isOwner: true };
const editAll: CrmUser = { ...owner, id: "u3", canSeeColleagues: true, canEditColleagues: true };

test("the assigned employee cannot edit a partner-worked lead", () => {
  assert.equal(canEditLead(owner, { assignedToId: owner.id, workedByPartner: true }), false);
});

test("admins, the owner and edit-colleagues cannot edit it either", () => {
  for (const u of [admin, boss, editAll]) {
    assert.equal(canEditLead(u, { assignedToId: owner.id, workedByPartner: true }), false);
    assert.equal(canEditLead(u, { assignedToId: null, workedByPartner: true }), false);
  }
});

test("without workedByPartner today's results are unchanged", () => {
  assert.equal(canEditLead(owner, { assignedToId: owner.id, workedByPartner: false }), true);
  assert.equal(canEditLead(owner, { assignedToId: "u2", workedByPartner: false }), false);
  assert.equal(canEditLead(admin, { assignedToId: "u2", workedByPartner: false }), true);
  assert.equal(canEditLead(editAll, { assignedToId: null, workedByPartner: false }), true);
});

test("a partner-worked lead stays visible", () => {
  assert.equal(canViewLead(owner, { assignedToId: owner.id }), true);
  assert.equal(canViewLead(admin, { assignedToId: "u2" }), true);
});

test("work lists exclude partner-worked leads", () => {
  assert.deepEqual(EXCLUDE_PARTNER_WORKED, { workedByPartner: false });
});

test("the read-only message is fixed", () => {
  assert.equal(PARTNER_WORKED_READONLY, "This client is worked by the partner — read only until they hand it over.");
});

test("the refusal names the partner lock only to users who may see the lead", () => {
  assert.equal(leadEditError(owner, { assignedToId: owner.id, workedByPartner: true }), PARTNER_WORKED_READONLY);
  assert.equal(leadEditError(admin, { assignedToId: "u2", workedByPartner: true }), PARTNER_WORKED_READONLY);
  assert.equal(leadEditError(owner, { assignedToId: "u2", workedByPartner: true }), "Lead not found.");
  assert.equal(leadEditError(owner, { assignedToId: owner.id, workedByPartner: false }), null);
  assert.equal(leadEditError(owner, { assignedToId: "u2", workedByPartner: false }, "Nope."), "Nope.");
});

test("presentations, trash and MCP writes refuse a partner-worked lead with the read-only message", () => {
  const lead = { assignedToId: owner.id, workedByPartner: true };
  assert.equal(presentationGuard(boss, lead, "edit"), PARTNER_WORKED_READONLY);
  assert.deepEqual(canTrashLead(admin, lead), { allowed: false, error: PARTNER_WORKED_READONLY });
  assert.throws(() => assertCanEdit(admin, lead), (e: Error) => e.message === PARTNER_WORKED_READONLY);
  assert.doesNotThrow(() => assertCanEdit(admin, { ...lead, workedByPartner: false }));
});
