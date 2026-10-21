import { test } from "node:test";
import assert from "node:assert/strict";
import { statusChangeContent, LEAD_STATUSES } from "@/lib/crm/updateLeadStatus";

test("status change wording matches the admin's timeline rows", () => {
  assert.equal(statusChangeContent("VIEWING_SCHEDULED"), "Status changed to VIEWING SCHEDULED");
  assert.equal(statusChangeContent("NEW"), "Status changed to NEW");
});

test("the status list is the CRM's nine statuses in funnel order (RESERVED added by CRM v2)", () => {
  assert.deepEqual([...LEAD_STATUSES], ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT", "CLOSED", "LOST"]);
});
