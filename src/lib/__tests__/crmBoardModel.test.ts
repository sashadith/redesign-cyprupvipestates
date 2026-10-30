import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBoard, buildSide, toCard, isBoardFilter, onlyUrgent, urgencyCounts, type BoardLeadInput } from "@/lib/crm/boardModel";

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

// ── Urgency marks (2026-10-30) ──────────────────────────────────────────────
// now = 2026-10-18 12:00 UTC = 15:00 Cyprus (UTC+3 until the 25th).

const contacted = { ...base, status: "CONTACTED", lastContactAt: new Date("2026-10-17T09:00:00Z") };
const u = (over: Partial<BoardLeadInput>) => toCard({ ...contacted, ...over }, now).urgency;

test("urgency: follow-up due today is yellow, an earlier day is red with the days late", () => {
  assert.deepEqual(u({ nextFollowUpAt: new Date("2026-10-18T06:00:00Z") }), { level: "now", days: 0, label: "Act now", reason: "Follow-up due today" });
  const late = u({ nextFollowUpAt: new Date("2026-10-15T09:00:00Z") });
  assert.equal(late?.level, "overdue");
  assert.equal(late?.days, 3);
  assert.equal(late?.label, "Overdue 3d");
  assert.equal(late?.reason, "Follow-up was due 15 Oct");
  // 23:30 Cyprus on the 17th is still the 17th → 1 day late (Cyprus calendar, not UTC).
  assert.equal(u({ nextFollowUpAt: new Date("2026-10-17T20:30:00Z") })?.days, 1);
  assert.equal(u({ nextFollowUpAt: new Date("2026-10-20T09:00:00Z") }), null, "planned for later");
});

test("urgency: new uncontacted lead — act now on arrival day, overdue afterwards", () => {
  assert.equal(toCard(base, now).urgency?.label, "Act now");
  assert.equal(toCard(base, now).urgency?.reason, "New lead, not contacted yet");
  const old = toCard({ ...base, createdAt: new Date("2026-10-16T08:00:00Z") }, now).urgency;
  assert.equal(old?.label, "Overdue 2d");
  assert.equal(toCard({ ...base, createdAt: new Date("2026-10-16T08:00:00Z"), nextFollowUpAt: new Date("2026-10-19T08:00:00Z") }, now).urgency, null,
    "a planned follow-up means it is handled");
});

test("urgency: no contact for 7 days without a follow-up — due on day 7, overdue after", () => {
  assert.equal(u({ lastContactAt: new Date("2026-10-11T10:00:00Z") })?.label, "Act now");
  const r = u({ lastContactAt: new Date("2026-10-08T10:00:00Z") });
  assert.equal(r?.label, "Overdue 3d");
  assert.equal(r?.reason, "No contact for 10 days");
  assert.equal(u({ lastContactAt: new Date("2026-10-13T10:00:00Z") }), null);
});

test("urgency: viewing today is yellow; a past viewing without follow-up is red from the next day", () => {
  assert.equal(u({ status: "VIEWING_SCHEDULED", viewingScheduledAt: new Date("2026-10-18T14:00:00Z") })?.reason, "Viewing today");
  const after = u({ status: "VIEWING_SCHEDULED", viewingScheduledAt: new Date("2026-10-15T10:00:00Z"), lastContactAt: new Date("2026-10-14T10:00:00Z") });
  assert.equal(after?.label, "Overdue 2d");
  assert.equal(after?.reason, "Viewing on 15 Oct not followed up");
  assert.equal(u({ status: "VIEWING_SCHEDULED", viewingScheduledAt: new Date("2026-10-15T10:00:00Z"), lastContactAt: new Date("2026-10-16T10:00:00Z") }), null,
    "contact logged after the viewing");
});

test("urgency: the most overdue signal wins; closed, keep-contact and lost are never marked", () => {
  // Uncontacted since the 16th (2 days late) and a follow-up set for today: the older signal decides.
  const both = toCard({ ...base, createdAt: new Date("2026-10-16T08:00:00Z"), nextFollowUpAt: new Date("2026-10-18T06:00:00Z") }, now).urgency;
  assert.equal(both?.label, "Overdue 2d");
  assert.equal(both?.reason, "New lead, not contacted yet");
  for (const status of ["CLOSED", "KEEP_CONTACT", "LOST"]) {
    assert.equal(u({ status, nextFollowUpAt: new Date("2026-10-10T06:00:00Z") }), null, status);
  }
});

test("needs-action view and header counts", () => {
  const cols = buildBoard([
    { ...contacted, id: "a", nextFollowUpAt: new Date("2026-10-18T06:00:00Z") },
    { ...contacted, id: "b", nextFollowUpAt: new Date("2026-10-10T06:00:00Z") },
    { ...contacted, id: "c", nextFollowUpAt: new Date("2026-10-16T06:00:00Z") },
    { ...contacted, id: "d", nextFollowUpAt: new Date("2026-10-25T06:00:00Z") },
  ], now);
  assert.deepEqual(urgencyCounts(cols), { now: 1, overdue: 2 });
  const due = onlyUrgent(cols).find((c) => c.status === "CONTACTED")!;
  assert.deepEqual(due.cards.map((c) => c.id), ["b", "c", "a"], "longest overdue first, then act now; unmarked left out");
  assert.equal(isBoardFilter("due"), true);
});
