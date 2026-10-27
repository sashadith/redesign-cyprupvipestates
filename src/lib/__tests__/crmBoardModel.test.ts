import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, buildSide, toCard, isBoardFilter, type BoardLeadInput } from "@/lib/crm/boardModel";

const now = new Date("2026-10-18T12:00:00Z");
const base: BoardLeadInput = {
  id: "l1", firstName: "Markus", lastName: "Brenner", status: "NEW", source: "CONTACT_FORM",
  languagePreference: "de", assignedTo: { id: "u1", name: "Sophie Keller" }, projectLabel: "Eden Coast",
  lastContactAt: null, createdAt: new Date("2026-10-18T10:00:00Z"), deals: [], canEdit: true,
};

test("columns follow the funnel and leave out keep-contact and lost", () => {
  const cols = buildBoard([base, { ...base, id: "l2", status: "LOST" }, { ...base, id: "l3", status: "KEEP_CONTACT" }], now);
  assert.deepEqual(cols.map((c) => c.status), ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"]);
  assert.equal(cols[0].cards.length, 1);
  assert.equal(cols.reduce((n, c) => n + c.cards.length, 0), 1);
});

test("a card shows name, owner initials and a recent age", () => {
  const c = toCard(base, now);
  assert.equal(c.name, "Markus Brenner");
  assert.equal(c.ownerInitials, "SK");
  assert.equal(c.ageLabel, "2h");
  assert.equal(c.stale, false);
  assert.equal(c.lang, "DE");
});

test("a lead without contact for 7+ days is stale, counted from the last contact", () => {
  const old = { ...base, createdAt: new Date("2026-09-01T00:00:00Z"), lastContactAt: new Date("2026-10-10T12:00:00Z") };
  const c = toCard(old, now);
  assert.equal(c.ageLabel, "8d");
  assert.equal(c.stale, true);
});

test("partner leads are flagged and labelled", () => {
  const c = toCard({ ...base, source: "PARTNER" }, now);
  assert.equal(c.isPartner, true);
  assert.equal(c.sourceLabel, "Partner");
});

test("open deals add up per card and per column; cancelled deals do not count", () => {
  const lead = { ...base, status: "RESERVED", deals: [
    { price: 400_000, ourCommission: 20_000, commissionStatus: "EXPECTED" },
    { price: 300_000, ourCommission: 15_000, commissionStatus: "CANCELLED" },
  ] };
  const c = toCard(lead, now);
  assert.equal(c.dealValue, 400_000);
  assert.equal(c.dealCommission, 20_000);
  const col = buildBoard([lead], now).find((x) => x.status === "RESERVED")!;
  assert.equal(col.total, 400_000);
});

test("filters are validated", () => {
  assert.equal(isBoardFilter("mine"), true);
  assert.equal(isBoardFilter("everything"), false);
});

test("the per-card edit right is carried from the server onto the card", () => {
  assert.equal(toCard(base, now).canEdit, true);
  assert.equal(toCard({ ...base, canEdit: false }, now).canEdit, false);
});

test("an unassigned lead has no owner on its card", () => {
  const c = toCard({ ...base, assignedTo: null }, now);
  assert.equal(c.ownerInitials, null);
  assert.equal(c.ownerName, null);
});

test("side lists hold Keep contact then Lost, and parked leads are never stale", () => {
  const old = { createdAt: new Date("2026-08-01T00:00:00Z") };
  const side = buildSide([base, { ...base, ...old, id: "l2", status: "LOST" }, { ...base, ...old, id: "l3", status: "KEEP_CONTACT" }], now);
  assert.deepEqual(side.map((c) => c.status), ["KEEP_CONTACT", "LOST"]);
  assert.deepEqual(side.map((c) => c.cards.map((x) => x.id)), [["l3"], ["l2"]]);
  assert.ok(side.every((c) => c.cards.every((x) => !x.stale)));
});
