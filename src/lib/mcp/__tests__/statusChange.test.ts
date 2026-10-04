import { test } from "node:test";
import assert from "node:assert/strict";
import { statusChangeContent, LEAD_STATUSES } from "@/lib/crm/updateLeadStatus";

test("status change wording matches the admin's timeline rows", () => {
  assert.equal(statusChangeContent("VIEWING_SCHEDULED"), "Status changed to VIEWING SCHEDULED");
  assert.equal(statusChangeContent("NEW"), "Status changed to NEW");
});

test("the status list is the CRM's eight statuses in funnel order", () => {
  assert.deepEqual([...LEAD_STATUSES], ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"]);
});
