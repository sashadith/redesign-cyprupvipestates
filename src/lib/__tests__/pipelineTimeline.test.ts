import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerTimeline, type TimelineRow } from "@/lib/partner/pipeline/timeline";

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
