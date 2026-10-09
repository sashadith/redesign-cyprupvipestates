import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ToolError } from "@/lib/mcp/toolWrapper";
import { performNotify, NotifyInput, NOTIFY_MAX_CHARS, NOTIFY_PER_HOUR, type NotifyDeps, type NotifyDetail } from "@/lib/mcp/tools/notifyOwnerTelegram";

/* notify_owner_telegram (2026-10-09). Telegram and the audit count are fakes:
   no test here can send a real message. */

function fakeDeps(sentInLastHour = 0) {
  const sent: string[] = [];
  let count = sentInLastHour;
  const deps: NotifyDeps = {
    countSentSince: async () => count,
    send: async (text) => { sent.push(text); count++; return 4242; },
    now: () => new Date("2026-10-13T06:00:00Z"),
  };
  return { deps, sent };
}
const detail = (): NotifyDetail => ({ length: 0 });

async function refused(p: Promise<unknown>, code: string, pattern: RegExp) {
  await assert.rejects(p, (e: unknown) => e instanceof ToolError && e.code === code && pattern.test(e.message));
}

test("sends plain text and returns the Telegram message id; detail records length and id", async () => {
  const { deps, sent } = fakeDeps();
  const d = detail();
  const r = await performNotify(deps, { text: "  CVE notify test  " }, d);
  assert.deepEqual(sent, ["CVE notify test"]);
  assert.equal(r.sent, true);
  assert.equal(r.telegramMessageId, 4242);
  assert.deepEqual(d, { length: 15, telegramMessageId: 4242 });
});

test("a recipient parameter is refused, never ignored — and nothing is sent", async () => {
  for (const extra of [{ chat_id: "-100123" }, { chatId: 1 }, { recipient: "x" }, { to: "y" }]) {
    const { deps, sent } = fakeDeps();
    await refused(performNotify(deps, { text: "hi", ...extra }, detail()), "validation", /recipient is fixed server-side/);
    assert.deepEqual(sent, []);
  }
});

test("the advertised schema itself forbids extra keys (the MCP layer rejects before the handler)", () => {
  assert.equal(NotifyInput.safeParse({ text: "hi", chat_id: "1" }).success, false);
  const json = z.toJSONSchema(NotifyInput) as { additionalProperties?: unknown; properties: Record<string, unknown>; required: string[] };
  assert.equal(json.additionalProperties, false);
  assert.deepEqual(Object.keys(json.properties), ["text"]);
  assert.deepEqual(json.required, ["text"]);
});

test(`text over ${NOTIFY_MAX_CHARS} characters is refused; exactly ${NOTIFY_MAX_CHARS} is sent`, async () => {
  const { deps, sent } = fakeDeps();
  await refused(performNotify(deps, { text: "x".repeat(NOTIFY_MAX_CHARS + 1) }, detail()), "validation", /longer than 3500/);
  assert.deepEqual(sent, []);
  await performNotify(deps, { text: "x".repeat(NOTIFY_MAX_CHARS) }, detail());
  assert.equal(sent.length, 1);
});

test("empty or whitespace-only text is refused", async () => {
  const { deps, sent } = fakeDeps();
  await refused(performNotify(deps, { text: "   " }, detail()), "validation", /Nothing was sent/);
  await refused(performNotify(deps, {}, detail()), "validation", /Nothing was sent/);
  assert.deepEqual(sent, []);
});

test(`the ${NOTIFY_PER_HOUR + 1}th call within an hour is refused and sends nothing`, async () => {
  const { deps, sent } = fakeDeps(0);
  for (let i = 0; i < NOTIFY_PER_HOUR; i++) await performNotify(deps, { text: `m${i}` }, detail());
  assert.equal(sent.length, 10);
  await refused(performNotify(deps, { text: "eleventh" }, detail()), "rate_limited", /10 messages per hour/);
  assert.equal(sent.length, 10);
});

test("the hour is counted from now backwards, across all callers (count comes from the audit table)", async () => {
  let since: Date | null = null;
  const deps: NotifyDeps = {
    countSentSince: async (s) => { since = s; return 3; },
    send: async () => 1,
    now: () => new Date("2026-10-13T06:00:00Z"),
  };
  await performNotify(deps, { text: "hi" }, detail());
  assert.deepEqual(since, new Date("2026-10-13T05:00:00Z"));
});

test("Telegram not configured → 'config' error, never a claimed send", async () => {
  const deps: NotifyDeps = { countSentSince: async () => 0, send: async () => null, now: () => new Date() };
  await refused(performNotify(deps, { text: "hi" }, detail()), "config", /not configured/);
});

test("Telegram failure → error, never a claimed send", async () => {
  const deps: NotifyDeps = { countSentSince: async () => 0, send: async () => { throw new Error("Telegram request failed"); }, now: () => new Date() };
  const d = detail();
  await refused(performNotify(deps, { text: "hi" }, d), "internal", /Nothing was sent/);
  assert.equal(d.telegramMessageId, undefined);
});
