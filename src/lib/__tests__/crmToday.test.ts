import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToday, isAssignmentTo, todayGreeting, type TodayLead } from "../crm/today";

// Cyprus is UTC+3 until 25 Oct 2026 and UTC+2 after it; the code derives that via Intl.
const NOW = new Date("2026-10-18T09:00:00Z"); // 12:00 in Cyprus, Sunday 18 Oct

function lead(id: string, over: Partial<TodayLead> = {}): TodayLead {
  return {
    id, name: id, status: "CONTACTED", nextFollowUpAt: null, viewingScheduledAt: null,
    lastContactAt: new Date("2026-10-17T09:00:00Z"), createdAt: new Date("2026-09-01T09:00:00Z"),
    assignedAt: null, projectLabel: null, ...over,
  };
}
const ids = (xs: TodayLead[]) => xs.map((l) => l.id);

test("a follow-up at 22:30Z on the 18th is tomorrow in Cyprus, not today", () => {
  const t = buildToday([lead("a", { nextFollowUpAt: new Date("2026-10-18T22:30:00Z") })], NOW);
  assert.deepEqual(ids(t.dueToday), []);
  assert.deepEqual(ids(t.overdue), []);
});

test("overdue (before today in Cyprus) and due today are split, each sorted ascending", () => {
  const t = buildToday([
    lead("today-late", { nextFollowUpAt: new Date("2026-10-18T15:00:00Z") }),
    lead("today-early", { nextFollowUpAt: new Date("2026-10-17T21:30:00Z") }), // 00:30 on the 18th in Cyprus
    lead("yesterday", { nextFollowUpAt: new Date("2026-10-17T20:30:00Z") }), // 23:30 on the 17th in Cyprus
    lead("older", { nextFollowUpAt: new Date("2026-10-10T09:00:00Z") }),
  ], NOW);
  assert.deepEqual(ids(t.overdue), ["older", "yesterday"]);
  assert.deepEqual(ids(t.dueToday), ["today-early", "today-late"]);
});

test("viewings: today and tomorrow only, any status, sorted by time; across the DST change", () => {
  const t = buildToday([
    lead("tomorrow", { status: "VIEWING_SCHEDULED", viewingScheduledAt: new Date("2026-10-19T10:00:00Z") }),
    lead("today", { status: "RESERVED", viewingScheduledAt: new Date("2026-10-18T14:00:00Z") }),
    lead("day-after", { viewingScheduledAt: new Date("2026-10-20T10:00:00Z") }),
    lead("yesterday", { viewingScheduledAt: new Date("2026-10-17T10:00:00Z") }),
    lead("closed-with-viewing", { status: "CLOSED", viewingScheduledAt: new Date("2026-10-18T16:00:00Z") }),
  ], NOW);
  assert.deepEqual(ids(t.viewings), ["today", "closed-with-viewing", "tomorrow"]);

  // Clocks go back at 01:00Z on Sunday 25 Oct. "Now" is 00:30 on the 25th in Cyprus (UTC+3), so
  // today is the 25th and tomorrow the 26th; later instants fall on the Cyprus date at UTC+2.
  const sat = new Date("2026-10-24T21:30:00Z");
  const t2 = buildToday([
    lead("sun-evening", { viewingScheduledAt: new Date("2026-10-25T21:30:00Z") }), // 23:30 on the 25th
    lead("mon-night", { viewingScheduledAt: new Date("2026-10-25T22:30:00Z") }), // 00:30 on the 26th
    lead("tue", { viewingScheduledAt: new Date("2026-10-26T22:30:00Z") }), // 00:30 on the 27th
  ], sat);
  assert.deepEqual(ids(t2.viewings), ["sun-evening", "mon-night"]);
});

test("fresh: assigned within the last 48 hours, active statuses, oldest assignment first", () => {
  const t = buildToday([
    lead("new-1", { status: "NEW", assignedAt: new Date("2026-10-18T07:00:00Z") }),
    lead("new-2", { status: "NEW", assignedAt: new Date("2026-10-16T10:00:00Z") }),
    lead("too-old", { status: "NEW", assignedAt: new Date("2026-10-16T08:00:00Z") }),
    lead("never", { status: "NEW", assignedAt: null }),
  ], NOW);
  assert.deepEqual(ids(t.fresh), ["new-2", "new-1"]);
});

test("stale: 7+ days without contact, but not when the lead is already overdue or due today", () => {
  const old = new Date("2026-10-01T09:00:00Z");
  const t = buildToday([
    lead("stale", { lastContactAt: old }),
    lead("stale-no-contact", { lastContactAt: null, createdAt: new Date("2026-10-05T09:00:00Z") }),
    lead("stale-but-overdue", { lastContactAt: old, nextFollowUpAt: new Date("2026-10-12T09:00:00Z") }),
    lead("stale-but-today", { lastContactAt: old, nextFollowUpAt: new Date("2026-10-18T12:00:00Z") }),
    lead("recent", { lastContactAt: new Date("2026-10-15T09:00:00Z") }),
    lead("kept", { status: "KEEP_CONTACT", lastContactAt: old }),
  ], NOW);
  assert.deepEqual(ids(t.stale), ["stale", "stale-no-contact"]);
  assert.deepEqual(ids(t.overdue), ["stale-but-overdue"]);
  assert.deepEqual(ids(t.dueToday), ["stale-but-today"]);
});

test("a LOST lead with an overdue follow-up appears nowhere", () => {
  const t = buildToday([
    lead("lost", { status: "LOST", nextFollowUpAt: new Date("2026-10-10T09:00:00Z"), lastContactAt: new Date("2026-09-01T09:00:00Z"), assignedAt: new Date("2026-10-18T08:00:00Z") }),
  ], NOW);
  assert.deepEqual(t, { overdue: [], dueToday: [], viewings: [], fresh: [], stale: [] });
});

test("greeting follows the Cyprus hour and uses the first word of the name", () => {
  assert.equal(todayGreeting(new Date("2026-10-18T06:59:00Z"), "Anna Maria Kyriakou"), "Good morning, Anna"); // 09:59
  assert.equal(todayGreeting(new Date("2026-10-18T09:00:00Z"), "Anna Kyriakou"), "Good afternoon, Anna"); // 12:00
  assert.equal(todayGreeting(new Date("2026-10-18T15:00:00Z"), "Anna"), "Good evening, Anna"); // 18:00
  assert.equal(todayGreeting(new Date("2026-11-02T09:59:00Z"), "Anna"), "Good morning, Anna"); // 11:59 at UTC+2
  assert.equal(todayGreeting(new Date("2026-11-02T10:00:00Z"), "  "), "Good afternoon"); // 12:00 at UTC+2
});

test("isAssignmentTo accepts crm-v2 metadata and legacy name-only rows, rejects others", () => {
  const user = { id: "u1", name: "Anna Kyriakou" };
  assert.equal(isAssignmentTo({ body: "Assigned to Anna Kyriakou", metadata: { assignedToId: "u1", via: "crm-v2" } }, user), true);
  assert.equal(isAssignmentTo({ body: "Assigned to Anna Kyriakou", metadata: null }, user), true); // old admin CRM
  assert.equal(isAssignmentTo({ body: "Assigned to Anna Kyriakou", metadata: {} }, user), true);
  assert.equal(isAssignmentTo({ body: "Assigned to Anna Kyriakou", metadata: { assignedToId: "u2" } }, user), false);
  assert.equal(isAssignmentTo({ body: "Assigned to Bob", metadata: null }, user), false);
});
