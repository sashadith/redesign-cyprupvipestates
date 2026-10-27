import { test } from "node:test";
import assert from "node:assert/strict";
import { inboxWhere } from "@/lib/crm/inboxWhere";
import { EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER_ENQUIRY } from "@/lib/crm/leadBucket";
import { ACTIVE_LEAD_STATUSES } from "@/lib/crm/leadStatus";

test("the inbox is unassigned, not deleted, active and not a newsletter subscriber", () => {
  const w = inboxWhere() as { AND: unknown[] };
  assert.equal(w.AND.length, 3);
  assert.ok(w.AND.includes(EXCLUDE_NEWSLETTER));
  assert.ok(w.AND.includes(EXCLUDE_PARTNER_ENQUIRY));
  const base = w.AND.find((x) => x !== EXCLUDE_NEWSLETTER && x !== EXCLUDE_PARTNER_ENQUIRY) as { deletedAt: unknown; assignedToId: unknown; status: { in: string[] } };
  assert.equal(base.deletedAt, null);
  assert.equal(base.assignedToId, null);
  assert.deepEqual(base.status.in, [...ACTIVE_LEAD_STATUSES]);
});

test("closed, lost and keep-contact leads never count as inbox work", () => {
  const base = (inboxWhere() as { AND: [unknown, unknown, { status: { in: string[] } }] }).AND[2];
  for (const s of ["CLOSED", "LOST", "KEEP_CONTACT"]) assert.ok(!base.status.in.includes(s));
});

test("each call returns a fresh object, so callers cannot mutate a shared where", () => {
  assert.notEqual(inboxWhere(), inboxWhere());
});
