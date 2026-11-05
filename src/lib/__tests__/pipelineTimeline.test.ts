import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerTimeline, scopeTimeline, type TimelineRow } from "@/lib/partner/pipeline/timeline";

const at = (m: number) => new Date(Date.UTC(2026, 10, 5, 10, m));
const row = (id: string, type: string, m: number, extra: Partial<TimelineRow> = {}): TimelineRow => ({ id, type, occurredAt: at(m), ...extra });

const rows: TimelineRow[] = [
  row("staff-note", "NOTE", 1, { createdByUserId: "u1", createdByName: "Staff Anna", body: "internal" }),
  row("partner-note", "NOTE", 2, { createdByPartnerUserId: "pu1", createdByName: "Partner Paul", body: "called him" }),
  row("status", "STATUS_CHANGE", 3, { createdByUserId: "u1", createdByName: "Staff Anna", body: "Status changed to VIEWING_SCHEDULED by Anna: secret", metadata: { toStatus: "VIEWING_SCHEDULED" } }),
  row("system", "SYSTEM", 4, { body: "owner reassigned to Anna" }),
  row("pres", "PRESENTATION_EVENT", 5, { createdByUserId: "u1", createdByName: "Staff Anna", body: "Presentation created" }),
  row("staff-call", "CALL", 6, { createdByUserId: "u1", body: "spoke" }),
];

test("partnerTimeline keeps partner rows, status, presentation and messages, newest first", () => {
  const out = partnerTimeline(rows, [{ id: "msg", leadId: "l", partnerId: "p", createdAt: at(7), body: "hello partner" }]);
  assert.deepEqual(out.map((e) => e.id), ["msg", "pres", "status", "partner-note"]);
});

test("partnerTimeline never carries staff names or stored status text", () => {
  const out = partnerTimeline(rows, []);
  const status = out.find((e) => e.id === "status")!;
  assert.equal(status.status, "VIEWING_SCHEDULED");
  assert.equal(status.text, null);
  assert.equal(status.by, null);
  assert.equal(out.find((e) => e.id === "pres")!.by, null);
  assert.equal(out.find((e) => e.id === "partner-note")!.by, "Partner Paul");
  assert.ok(!JSON.stringify(out).includes("Anna"));
});

test("partnerTimeline drops a status row without a recognised target status", () => {
  assert.deepEqual(partnerTimeline([row("s", "STATUS_CHANGE", 1, { body: "free staff text" })], []), []);
  assert.deepEqual(partnerTimeline([row("s", "STATUS_CHANGE", 1, { metadata: { toStatus: "NOPE" } })], []), []);
});

test("partnerTimeline keeps the lost reason of a status move and a call outcome", () => {
  const out = partnerTimeline([
    row("lost", "STATUS_CHANGE", 2, { createdByPartnerUserId: "pu1", createdByName: "Paul", metadata: { toStatus: "LOST", lostReason: "NO_RESPONSE" } }),
    row("call", "CALL", 1, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "x", metadata: { callOutcome: "SPOKE" } }),
  ], []);
  assert.equal(out[0].lostReason, "NO_RESPONSE");
  assert.equal(out[0].by, "Paul");
  assert.equal(out[1].callOutcome, "SPOKE");
});

test("partnerTimeline words system rows by kind and date, never by their stored English text", () => {
  const out = partnerTimeline([
    row("fu", "SYSTEM", 3, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "Next follow-up set to Thu 6 Nov", metadata: { kind: "follow_up", nextFollowUpAt: "2026-11-06T08:00:00.000Z", via: "partner" } }),
    row("edit", "SYSTEM", 2, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "Lead details edited: Phone", metadata: { kind: "lead_edit", fields: ["phone"] } }),
    row("fav", "PRESENTATION_EVENT", 1, { body: "Favorited: Sea View 2", metadata: { legacyType: "PRESENTATION_FAVORITE" } }),
    row("view", "PRESENTATION_EVENT", 0, { body: "Presentation viewed again", metadata: { legacyType: "PRESENTATION_VIEWED" } }),
  ], []);
  const byId = new Map(out.map((e) => [e.id, e]));
  assert.equal(byId.get("fu")!.event, "follow_up");
  assert.equal(byId.get("fu")!.eventAt!.toISOString(), "2026-11-06T08:00:00.000Z");
  assert.equal(byId.get("fu")!.text, null);
  assert.equal(byId.get("edit")!.event, "lead_edit");
  assert.equal(byId.get("edit")!.text, null);
  assert.equal(byId.get("fav")!.event, "PRESENTATION_FAVORITE");
  assert.equal(byId.get("fav")!.text, "Sea View 2");
  assert.equal(byId.get("view")!.text, null);
});

test("partnerTimeline drops the auto text of a call logged with an outcome only", () => {
  const out = partnerTimeline([
    row("c1", "CALL", 2, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "No answer", metadata: { callOutcome: "NO_ANSWER" } }),
    row("c2", "CALL", 1, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "talked about Paphos", metadata: { callOutcome: "SPOKE" } }),
  ], []);
  assert.equal(out[0].text, null);
  assert.equal(out[0].callOutcome, "NO_ANSWER");
  assert.equal(out[1].text, "talked about Paphos");
});

test("partnerTimeline carries the partner's handover request and withdrawal by kind, not by text", () => {
  const out = partnerTimeline([
    row("req", "SYSTEM", 2, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "Handover requested by partner Paul", metadata: { kind: "handover_requested", requestId: "r1", downgrade: true } }),
    row("wd", "SYSTEM", 1, { createdByPartnerUserId: "pu1", createdByName: "Paul", body: "Handover request withdrawn by partner Paul", metadata: { kind: "handover_withdrawn", requestId: "r1", downgrade: true } }),
  ], []);
  assert.deepEqual(out.map((e) => [e.id, e.kind, e.event, e.text, e.by]), [
    ["req", "system", "handover_requested", null, "Paul"],
    ["wd", "system", "handover_withdrawn", null, "Paul"],
  ]);
});

test("scopeTimeline: nothing from before the claim became active, presentation events of own presentations only", () => {
  const since = at(10);
  const scoped = scopeTimeline([
    row("old-status", "STATUS_CHANGE", 5, { metadata: { toStatus: "CONTACTED" } }),
    row("new-status", "STATUS_CHANGE", 12, { metadata: { toStatus: "OFFER" } }),
    row("old-pres", "PRESENTATION_EVENT", 6, { body: "Favorited: Old Tower", metadata: { legacyType: "PRESENTATION_FAVORITE", presentationId: "mine" } }),
    row("own-fav", "PRESENTATION_EVENT", 13, { body: "Favorited: Sea View", metadata: { legacyType: "PRESENTATION_FAVORITE", presentationId: "mine" } }),
    row("staff-fav", "PRESENTATION_EVENT", 14, { body: "Favorited: Staff Pick", metadata: { legacyType: "PRESENTATION_FAVORITE", presentationId: "staff" } }),
    row("legacy-fav", "PRESENTATION_EVENT", 15, { body: "Favorited: Unknown Pick", metadata: { legacyType: "PRESENTATION_FAVORITE" } }),
    row("at-since", "STATUS_CHANGE", 10, { metadata: { toStatus: "NEW" } }),
  ], [
    { id: "m-old", leadId: "l", partnerId: "p", createdAt: at(9), body: "earlier claim" },
    { id: "m-new", leadId: "l", partnerId: "p", createdAt: at(11), body: "this claim" },
  ], { since, ownPresentationIds: new Set(["mine"]) });
  assert.deepEqual(scoped.rows.map((r) => r.id), ["new-status", "own-fav", "legacy-fav", "at-since"]);
  assert.deepEqual(scoped.messages.map((m) => m.id), ["m-new"]);
  const out = partnerTimeline(scoped.rows, scoped.messages);
  assert.equal(out.find((e) => e.id === "own-fav")!.text, "Sea View");
  const legacy = out.find((e) => e.id === "legacy-fav")!;
  assert.equal(legacy.event, "PRESENTATION_FAVORITE");
  assert.equal(legacy.text, null, "a row without a presentation reference never shows a project name");
  const json = JSON.stringify(out);
  assert.ok(!json.includes("Staff Pick") && !json.includes("Unknown Pick") && !json.includes("Old Tower") && !json.includes("earlier claim"));
});

test("partnerTimeline words a staff take-over without the staff name", () => {
  const out = partnerTimeline([
    row("take", "SYSTEM", 1, {
      createdByUserId: "u1", createdByName: "Anna", body: "Taken over by Anna: partner can no longer work this client",
      metadata: { kind: "partner_lead_taken_over", reason: "protection_lapsed" },
    }),
  ], []);
  assert.deepEqual(out.map((e) => [e.id, e.event, e.by, e.text]), [["take", "partner_lead_taken_over", null, null]]);
  assert.ok(!JSON.stringify(out).includes("Anna"));
});
