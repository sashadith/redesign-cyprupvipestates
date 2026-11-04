import { test } from "node:test";
import assert from "node:assert/strict";
import { ago, toTimeline, type TimelineInput } from "@/lib/crm/timeline";
const row = (o: Partial<TimelineInput>): TimelineInput => ({ id: "i", type: "NOTE", direction: null, channel: null, subject: null, body: "x", occurredAt: new Date("2026-10-18T10:00:00Z"), createdByName: "Sophie", metadata: null, ...o });
test("newest first, with readable titles", () => {
  const t = toTimeline([row({ id: "a", type: "CALL", occurredAt: new Date("2026-10-17T10:00:00Z") }), row({ id: "b", type: "EMAIL_IN", subject: "Re: Eden Coast" })]);
  assert.deepEqual(t.map((x) => x.id), ["b", "a"]);
  assert.equal(t[0].title, "Email received · Re: Eden Coast");
  assert.equal(t[0].inbound, true);
  assert.equal(t[1].kind, "call");
});
test("status changes name the stage and the lost reason", () => {
  const t = toTimeline([row({ type: "STATUS_CHANGE", body: "Status changed to LOST", metadata: { toStatus: "LOST", lostReason: "BUDGET" } })]);
  assert.equal(t[0].kind, "status");
  assert.equal(t[0].title, "Moved to Lost · Budget does not fit");
});
test("long texts are cut at 600 characters", () => {
  const t = toTimeline([row({ body: "y".repeat(700) })]);
  assert.equal(t[0].text!.length, 601);
  assert.ok(t[0].text!.endsWith("…"));
});
test("WhatsApp direction comes from the type", () => {
  const t = toTimeline([row({ type: "WHATSAPP_OUT" }), row({ id: "j", type: "WHATSAPP_IN", occurredAt: new Date("2026-10-19T00:00:00Z") })]);
  assert.equal(t[0].title, "WhatsApp received");
  assert.equal(t[1].title, "WhatsApp sent");
});
test("unknown stages fall back to the raw value; emails without subject keep the bare title", () => {
  const t = toTimeline([
    row({ id: "s", type: "STATUS_CHANGE", metadata: { toStatus: "ARCHIVED" }, occurredAt: new Date("2026-10-18T12:00:00Z") }),
    row({ id: "e", type: "EMAIL_OUT", subject: "  " }),
  ]);
  assert.equal(t[0].title, "Moved to ARCHIVED");
  assert.equal(t[0].text, null);
  assert.equal(t[1].title, "Email sent");
  assert.equal(t[1].inbound, false);
});
test("events use their body as the title", () => {
  const t = toTimeline([row({ type: "PRESENTATION_EVENT", body: "Presentation viewed" }), row({ id: "z", type: "SYSTEM", body: null, occurredAt: new Date("2026-10-01T00:00:00Z") })]);
  assert.equal(t[0].kind, "presentation");
  assert.equal(t[0].title, "Presentation viewed");
  assert.equal(t[1].title, "System event");
});
test("relative ages", () => {
  const now = new Date("2026-10-18T10:00:00Z");
  assert.equal(ago(new Date("2026-10-18T09:59:30Z"), now), "just now");
  assert.equal(ago(new Date("2026-10-18T09:48:00Z"), now), "12 min ago");
  assert.equal(ago("2026-10-18T05:00:00Z", now), "5 h ago");
  assert.equal(ago(new Date("2026-10-15T09:00:00Z"), now), "3 d ago");
  assert.equal(ago(new Date("2026-10-19T00:00:00Z"), now), "just now");
});
