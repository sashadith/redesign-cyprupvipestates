import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTrashReason, canTrashLead, canRestoreLead, toTrashRow, TRASH_REASON_MAX } from "@/lib/crm/trashView";
import type { CrmUser } from "@/lib/crm/access";

const u = (o: Partial<CrmUser> = {}): CrmUser => ({ id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false, ...o });

test("reason: trimmed, empty becomes null, missing is fine", () => {
  assert.deepEqual(normalizeTrashReason("  duplicate  "), { ok: true, reason: "duplicate" });
  assert.deepEqual(normalizeTrashReason("   "), { ok: true, reason: null });
  assert.deepEqual(normalizeTrashReason(undefined), { ok: true, reason: null });
});

test("reason: 300 chars pass, 301 refused, non-strings refused", () => {
  assert.equal(normalizeTrashReason("a".repeat(TRASH_REASON_MAX)).ok, true);
  assert.equal(normalizeTrashReason("a".repeat(TRASH_REASON_MAX + 1)).ok, false);
  assert.equal(normalizeTrashReason(42).ok, false);
});

test("trash: owner of the lead, managers yes; foreign lead and missing lead no", () => {
  assert.equal(canTrashLead(u(), { assignedToId: "u1" }).allowed, true);
  assert.equal(canTrashLead(u(), { assignedToId: "u2" }).allowed, false);
  assert.equal(canTrashLead(u({ role: "ADMIN" }), { assignedToId: "u2" }).allowed, true);
  assert.equal(canTrashLead(u({ canSeeColleagues: true, canEditColleagues: true }), { assignedToId: null }).allowed, true);
  assert.equal(canTrashLead(u({ isActive: false }), { assignedToId: "u1" }).allowed, false);
  assert.equal(canTrashLead(u(), null).allowed, false);
});

test("restore: managers only", () => {
  assert.equal(canRestoreLead(u()).allowed, false);
  assert.equal(canRestoreLead(u({ canSeeColleagues: true, canEditColleagues: true })).allowed, false);
  assert.equal(canRestoreLead(u({ role: "ADMIN" })).allowed, true);
  assert.equal(canRestoreLead(u({ isOwner: true })).allowed, true);
});

test("trash row mapping", () => {
  const names = new Map([["a", "Anna"]]);
  const r = toTrashRow({ id: "l1", firstName: "Jo", lastName: "Doe", email: null, source: "WEBSITE", status: "NEW", deletedAt: new Date("2026-10-20T10:00:00Z"), deletedById: "a" }, names);
  assert.equal(r.name, "Jo Doe");
  assert.equal(r.trashedAt, "2026-10-20");
  assert.equal(r.trashedBy, "Anna");
  const r2 = toTrashRow({ id: "l2", firstName: "", lastName: "", email: "x@y.z", source: "ZZZ", status: "WEIRD", deletedAt: null, deletedById: "gone" }, names);
  assert.equal(r2.name, "x@y.z");
  assert.equal(r2.source, "ZZZ");
  assert.equal(r2.status, "WEIRD");
  assert.equal(r2.trashedBy, "—");
  assert.equal(r2.trashedAt, "");
});
