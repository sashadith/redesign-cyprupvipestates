import { test } from "node:test";
import assert from "node:assert/strict";
import { HINT_TEMPLATES, managerDigest, mayHintPartner } from "@/lib/crm/partnerPipelineDigest";

const editor = { id: "u1", isOwner: false, role: "EDITOR" };

test("mayHintPartner: the manager and admins, not another editor", () => {
  assert.equal(mayHintPartner(editor, { managerUserId: "u1" }), true);
  assert.equal(mayHintPartner({ id: "u2", isOwner: false, role: "ADMIN" }, { managerUserId: "u1" }), true);
  assert.equal(mayHintPartner({ id: "u3", isOwner: true, role: "EDITOR" }, { managerUserId: null }), true);
  assert.equal(mayHintPartner({ id: "u4", isOwner: false, role: "EDITOR" }, { managerUserId: "u1" }), false);
  assert.equal(mayHintPartner({ id: "u4", isOwner: false, role: "EDITOR" }, { managerUserId: null }), false);
  assert.equal(mayHintPartner({ ...editor, isActive: false }, { managerUserId: "u1" }), false);
});

test("hint templates are the agreed texts", () => {
  assert.deepEqual([...HINT_TEMPLATES], [
    "Your follow-up with this client is overdue.",
    "The client opened your selection — a good moment to call.",
  ]);
});

const card = (partnerName: string, o: Partial<{ light: "green" | "amber" | "red"; handedOverThisWeek: boolean; newThisWeek: boolean; overdue: boolean }> = {}) =>
  ({ partnerName, light: "green" as const, handedOverThisWeek: false, newThisWeek: false, ...o });

test("managerDigest: one line per partner with all three counts", () => {
  const out = managerDigest([
    card("Anna Muster", { light: "red" }), card("Anna Muster", { light: "red" }), card("Anna Muster", { overdue: true }),
    card("Anna Muster", { handedOverThisWeek: true }), card("Anna Muster", { newThisWeek: true }), card("Anna Muster", { newThisWeek: true }),
    card("Ben Beispiel", { newThisWeek: true }), card("Calm Partner"),
  ]);
  assert.equal(out, "Anna Muster: 3 overdue · 1 handed over · 2 new\nBen Beispiel: 0 overdue · 0 handed over · 1 new");
});

test("managerDigest: null when everything is green with no events", () => {
  assert.equal(managerDigest([card("A"), card("B", { light: "amber" })]), null);
  assert.equal(managerDigest([]), null);
});
