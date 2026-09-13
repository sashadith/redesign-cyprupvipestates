import { test } from "node:test";
import assert from "node:assert/strict";
import { performSend, type SendDeps } from "@/lib/mcp/tools/whatsappSend";
import { ToolError } from "@/lib/mcp/toolWrapper";
import type { RawMessage } from "@/lib/openwa/shapeMessages";

const ACTOR = { userId: "u-1", userName: "Operator" };
const INPUT = { leadId: "11111111-1111-4111-8111-111111111111", text: "Hi there" };
const LEAD = { id: INPUT.leadId, phone: "+357 99 000001" };

// The row the live gateway returns for a number nobody has ever written to:
// body-less, type "unknown", stamped at the moment of the call.
const ARTEFACT: RawMessage = { body: "", type: "unknown", timestamp: 1_757_700_000, fromMe: false };
const REAL_MESSAGE: RawMessage = { body: "Hello, is the villa still available?", type: "text", timestamp: 1_757_600_000, fromMe: false };

type Calls = { sendText: Array<[string, string]>; fetchThread: Array<[string, number]>; logged: Array<[string, unknown]> };

function fakeDeps(over: Partial<SendDeps> = {}): { deps: SendDeps; calls: Calls } {
  const calls: Calls = { sendText: [], fetchThread: [], logged: [] };
  const deps: SendDeps = {
    findLead: async () => LEAD,
    countSentToday: async () => 0,
    fetchThread: async (chatId, limit) => {
      calls.fetchThread.push([chatId, limit]);
      return [REAL_MESSAGE];
    },
    sendText: async (chatId, text) => {
      calls.sendText.push([chatId, text]);
    },
    logInteraction: async (_actor, leadId, input) => {
      calls.logged.push([leadId, input]);
      return { interactionId: "i-1" };
    },
    dailyCap: 20,
    ...over,
  };
  // A fake that records must still record when the test overrides it, so wrap
  // any override of the two outbound calls.
  const overriddenSend = over.sendText;
  if (overriddenSend) {
    deps.sendText = async (chatId, text) => {
      calls.sendText.push([chatId, text]);
      return overriddenSend(chatId, text);
    };
  }
  const overriddenFetch = over.fetchThread;
  if (overriddenFetch) {
    deps.fetchThread = async (chatId, limit) => {
      calls.fetchThread.push([chatId, limit]);
      return overriddenFetch(chatId, limit);
    };
  }
  return { deps, calls };
}

async function expectRefusal(deps: SendDeps): Promise<ToolError> {
  try {
    await performSend(deps, INPUT, ACTOR);
  } catch (e) {
    assert.ok(e instanceof ToolError, `expected a ToolError, got ${String(e)}`);
    return e;
  }
  throw new Error("expected the send to be refused, but it went through");
}

// Keeps an expected console.error out of the test output, and proves it happened.
async function captureErrorLog<T>(fn: () => Promise<T>): Promise<{ result: T; lines: string[] }> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    return { result: await fn(), lines };
  } finally {
    console.error = original;
  }
}

test("a thread of nothing but body-less artefact rows counts as no conversation", async () => {
  const { deps, calls } = fakeDeps({ fetchThread: async () => [ARTEFACT] });
  const err = await expectRefusal(deps);
  assert.equal(err.code, "validation");
  assert.match(err.message, /no existing WhatsApp conversation/i);
  assert.deepEqual(calls.sendText, [], "nothing may be sent to a number with no real thread");
});

test("the thread probe asks for more than one message, so an artefact cannot occupy the only slot", async () => {
  const { deps, calls } = fakeDeps({ fetchThread: async () => [ARTEFACT, REAL_MESSAGE] });
  await performSend(deps, INPUT, ACTOR);
  assert.equal(calls.fetchThread.length, 1);
  assert.equal(calls.fetchThread[0][0], "35799000001@c.us");
  assert.ok(calls.fetchThread[0][1] > 1, `probe limit must be > 1, got ${calls.fetchThread[0][1]}`);
});

test("a thread with one real message is a conversation and may be continued", async () => {
  const { deps, calls } = fakeDeps();
  const r = await performSend(deps, INPUT, ACTOR);
  assert.equal(r.sent, true);
  assert.deepEqual(calls.sendText, [["35799000001@c.us", INPUT.text]]);
});

test("a refused decision never calls sendText — unknown lead", async () => {
  const { deps, calls } = fakeDeps({ findLead: async () => null });
  const err = await expectRefusal(deps);
  assert.equal(err.code, "not_found");
  assert.deepEqual(calls.sendText, []);
});

test("a refused decision never calls sendText — daily cap reached", async () => {
  const { deps, calls } = fakeDeps({ countSentToday: async () => 20 });
  const err = await expectRefusal(deps);
  assert.equal(err.code, "rate_limited");
  assert.deepEqual(calls.sendText, []);
});

test("a gateway failure during the probe refuses the send and says the conversation was unconfirmed", async () => {
  const { deps, calls } = fakeDeps({
    fetchThread: async () => {
      throw new ToolError("internal", "WhatsApp gateway returned HTTP 500.");
    },
  });
  const original = console.error;
  console.error = () => {};
  let err: ToolError;
  try {
    err = await expectRefusal(deps);
  } finally {
    console.error = original;
  }
  assert.match(err.message, /could not confirm/i);
  assert.match(err.message, /nothing was sent/i);
  assert.deepEqual(calls.sendText, []);
});

test("a successful send logs WHATSAPP_OUT with via exactly \"mcp-whatsapp\"", async () => {
  const { deps, calls } = fakeDeps();
  const r = await performSend(deps, INPUT, ACTOR);
  assert.equal(calls.logged.length, 1);
  assert.equal(calls.logged[0][0], LEAD.id);
  assert.deepEqual(calls.logged[0][1], { type: "WHATSAPP_OUT", body: INPUT.text, via: "mcp-whatsapp" });
  assert.equal(r.interactionId, "i-1");
});

test("a failed timeline write still reports sent, warns, logs the error, and never re-sends", async () => {
  const { deps, calls } = fakeDeps({
    logInteraction: async () => {
      throw new Error("Invalid `prisma.leadInteraction.create()` invocation: body = 'secret'");
    },
  });
  const { result, lines } = await captureErrorLog(() => performSend(deps, INPUT, ACTOR));
  assert.equal(result.sent, true);
  assert.equal(result.interactionId, null);
  assert.match(result.warning ?? "", /timeline/i);
  assert.match(result.warning ?? "", /may already be there/i);
  assert.match(result.warning ?? "", /never send the message again/i);
  assert.equal(calls.sendText.length, 1, "a logging failure must never trigger a second send");
  // The failure must be observable, and redacted the way runTool redacts.
  assert.equal(lines.length, 1);
  assert.match(lines[0], /crm_whatsapp_send/);
  assert.match(lines[0], /Error/);
  assert.doesNotMatch(lines[0], /secret/, "the error message body must never be logged");
});

test("both the stored phone and the address actually used are reported", async () => {
  const { deps } = fakeDeps();
  const ok = await performSend(deps, INPUT, ACTOR);
  assert.equal(ok.to, LEAD.phone);
  assert.equal(ok.address, "35799000001@c.us");

  const { deps: failing } = fakeDeps({
    logInteraction: async () => {
      throw new Error("write failed");
    },
  });
  const { result } = await captureErrorLog(() => performSend(failing, INPUT, ACTOR));
  assert.equal(result.to, LEAD.phone);
  assert.equal(result.address, "35799000001@c.us");
});

