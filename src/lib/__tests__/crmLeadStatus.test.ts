import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEAD_STATUSES, FUNNEL_STATUSES, ACTIVE_LEAD_STATUSES, ELEVATED_NO_CONTACT_STATUSES,
  COMMUNICATING_STATUSES, STATUS_LABEL, LOST_REASONS, LOST_REASON_LABEL, isLeadStatus,
} from "@/lib/crm/leadStatus";

test("RESERVED sits between OFFER and KEEP_CONTACT", () => {
  assert.deepEqual([...LEAD_STATUSES], [
    "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT", "CLOSED", "LOST",
  ]);
});

test("the funnel is the kanban order and leaves out the parallel and lost states", () => {
  assert.deepEqual([...FUNNEL_STATUSES], ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"]);
});

test("a reserved lead is active and implies prior contact", () => {
  assert.ok(ACTIVE_LEAD_STATUSES.includes("RESERVED"));
  assert.ok(ELEVATED_NO_CONTACT_STATUSES.includes("RESERVED"));
  assert.deepEqual([...COMMUNICATING_STATUSES], [...ELEVATED_NO_CONTACT_STATUSES]);
  assert.equal(ACTIVE_LEAD_STATUSES.includes("KEEP_CONTACT" as never), false);
});

test("every status and lost reason has a label", () => {
  for (const s of LEAD_STATUSES) assert.ok(STATUS_LABEL[s]);
  for (const r of LOST_REASONS) assert.ok(LOST_REASON_LABEL[r]);
  assert.equal(STATUS_LABEL.RESERVED, "Reserved");
});

test("isLeadStatus guards unknown strings", () => {
  assert.equal(isLeadStatus("RESERVED"), true);
  assert.equal(isLeadStatus("QUALIFIED"), false);
  assert.equal(isLeadStatus(undefined), false);
});
