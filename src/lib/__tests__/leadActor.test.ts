import { test } from "node:test";
import assert from "node:assert/strict";
import { authorColumns, isPartnerActor, type LeadActor } from "@/lib/crm/leadActor";

const staff: LeadActor = { userId: "u", userName: "A" };
const partner: LeadActor = { partnerUserId: "pu", partnerId: "p", userName: "B" };

test("a staff actor authors as the CRM user", () => {
  assert.deepEqual(authorColumns(staff), { createdByUserId: "u", createdByPartnerUserId: null, createdByName: "A" });
});

test("a partner actor authors as the partner user", () => {
  assert.deepEqual(authorColumns(partner), { createdByUserId: null, createdByPartnerUserId: "pu", createdByName: "B" });
});

test("isPartnerActor tells the two apart", () => {
  assert.equal(isPartnerActor(staff), false);
  assert.equal(isPartnerActor(partner), true);
});
