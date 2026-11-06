import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditLead, canViewLead, canViewPartnerLead, type CrmUser } from "@/lib/crm/access";

const editor: CrmUser = { id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false };

test("the partner's manager may view the partner's lead", () => {
  assert.equal(canViewPartnerLead(editor, { partnerManagerId: "u1" }), true);
});

test("another editor, no manager, or no partner: no", () => {
  assert.equal(canViewPartnerLead(editor, { partnerManagerId: "u2" }), false);
  assert.equal(canViewPartnerLead(editor, { partnerManagerId: null }), false);
  assert.equal(canViewPartnerLead(editor, { partnerManagerId: undefined }), false);
});

test("inactive manager: no", () => {
  assert.equal(canViewPartnerLead({ ...editor, isActive: false }, { partnerManagerId: "u1" }), false);
});

test("edit and list rights are unchanged", () => {
  assert.equal(canViewLead(editor, { assignedToId: "u2" }), false);
  assert.equal(canEditLead(editor, { assignedToId: "u2", workedByPartner: true }), false);
  assert.equal(canEditLead(editor, { assignedToId: "u2", workedByPartner: false }), false);
});
