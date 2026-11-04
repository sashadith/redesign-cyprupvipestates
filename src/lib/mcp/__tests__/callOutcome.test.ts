import { test } from "node:test";
import assert from "node:assert/strict";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";
import { bodyRequirement } from "@/lib/crm/logRule";
import { callAttempts } from "@/lib/mcp/leadDetail";
import { toTimeline } from "@/lib/crm/timeline";

const leadId = "11111111-1111-4111-8111-111111111111";

test("a CALL with an outcome needs no text; the outcome is only for calls", () => {
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL", callOutcome: "NO_ANSWER" }).success, true);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL" }).success, false);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "NOTE", body: "x", callOutcome: "SPOKE" }).success, false);
  assert.equal(LogInteractionInput.safeParse({ leadId, type: "CALL", callOutcome: "BUSY" }).success, false);
  assert.equal(bodyRequirement("CALL", "", null, "VOICEMAIL").content, "Voicemail");
  assert.equal(bodyRequirement("CALL", "Asked for prices", null, "SPOKE").content, "Asked for prices");
});

test("call attempts: totals per outcome and unanswered tries since the last conversation", () => {
  const at = (d: string) => new Date(`2026-11-0${d}T10:00:00Z`);
  const r = callAttempts([
    { occurredAt: at("4"), metadata: { callOutcome: "NO_ANSWER" } },
    { occurredAt: at("3"), metadata: { callOutcome: "VOICEMAIL" } },
    { occurredAt: at("2"), metadata: { callOutcome: "SPOKE" } },
    { occurredAt: at("1"), metadata: { callOutcome: "NO_ANSWER" } },
    { occurredAt: at("1"), metadata: null },
  ]);
  assert.equal(r.total, 5);
  assert.equal(r.unansweredSinceSpoke, 2);
  assert.equal(r.lastOutcome, "NO_ANSWER");
  assert.deepEqual(r.byOutcome, { NO_ANSWER: 2, VOICEMAIL: 1, SPOKE: 1, WRONG_NUMBER: 0, UNKNOWN: 1 });
  assert.equal(callAttempts([]).lastOutcome, null);
});

test("the cockpit timeline titles a call with its outcome and does not repeat the label as text", () => {
  const row = (body: string | null, metadata: unknown) => ({ id: "x", type: "CALL", direction: "OUTBOUND", channel: "PHONE", subject: null, body, occurredAt: new Date(), createdByName: "Sascha Dith", metadata });
  const [a, b, c] = toTimeline([row("No answer", { callOutcome: "NO_ANSWER" }), row("Asked for prices", { callOutcome: "SPOKE" }), row("old call", null)]);
  assert.equal(a.title, "Call · No answer");
  assert.equal(a.text, null);
  assert.equal(b.title, "Call · Spoke");
  assert.equal(b.text, "Asked for prices");
  assert.equal(c.title, "Call");
});
