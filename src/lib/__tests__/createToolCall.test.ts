// createToolCall stands between every structured AI call and the model.
//
// On 2026-10-10 prod's ANTHROPIC_MODEL was switched to claude-sonnet-5-5 and
// every call that forced a tool came back 400 — CRM drafts, descriptions, PDF
// extraction, SEO meta, all at once. The smoke test before the switch had been
// a plain prompt with no tools, so it passed. These tests pin the request shape
// each model family actually gets, with a fake client: no API key, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { createToolCall } from "../ai/anthropic";

type Reply = { content: any[]; stop_reason: string };

function fakeClient(replies: Reply[]) {
  const sent: any[] = [];
  const client = {
    messages: {
      create: async (req: any) => {
        sent.push(req);
        const r = replies[Math.min(sent.length - 1, replies.length - 1)];
        return { ...r, id: "msg", type: "message", role: "assistant", model: req.model, usage: {} };
      },
    },
  } as unknown as Anthropic;
  return { client, sent };
}

const toolReply: Reply = { content: [{ type: "tool_use", id: "t1", name: "data", input: { ok: true } }], stop_reason: "tool_use" };
const textReply: Reply = { content: [{ type: "text", text: "Here you go: {...}" }], stop_reason: "end_turn" };

const base = (model: string, extra: Record<string, unknown> = {}) => ({
  model,
  max_tokens: 1000,
  tools: [{ name: "data", description: "x", input_schema: { type: "object" as const } }],
  tool_choice: { type: "tool" as const, name: "data" },
  messages: [{ role: "user" as const, content: "hi" }],
  ...extra,
});

test("models that accept a forced tool get the params unchanged", async () => {
  for (const model of ["claude-haiku-5-5", "claude-haiku-4-5-20251001", "claude-sonnet-5"]) {
    const { client, sent } = fakeClient([toolReply]);
    const params = base(model);
    await createToolCall(client, params);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0], params, model);
  }
});

test("Sonnet 5.5 gets auto + between_tools + an instruction, never a forced tool_choice", async () => {
  const { client, sent } = fakeClient([toolReply]);
  await createToolCall(client, base("claude-sonnet-5-5"));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].tool_choice, { type: "auto", disable_parallel_tool_use: true });
  assert.deepEqual(sent[0].thinking, { type: "between_tools" });
  assert.equal(sent[0].max_tokens, 1000, "between_tools does no extended thinking, so the calibrated budget stands");
  assert.equal(sent[0].output_config, undefined);
  assert.match(sent[0].system, /`data` tool exactly once/);
});

test("the instruction is appended after the system blocks, leaving the cached prefix intact", async () => {
  const cached = { type: "text", text: "brief", cache_control: { type: "ephemeral" } };
  const { client, sent } = fakeClient([toolReply]);
  await createToolCall(client, base("claude-sonnet-5-5", { system: [cached] }) as any);
  assert.equal(sent[0].system.length, 2);
  assert.deepEqual(sent[0].system[0], cached);
  assert.match(sent[0].system[1].text, /exactly once/);

  const s = fakeClient([toolReply]);
  await createToolCall(s.client, base("claude-sonnet-5-5", { system: "role" }));
  assert.ok(s.sent[0].system.startsWith("role\n\n"));
  assert.match(s.sent[0].system, /exactly once/);
});

test("Opus 5.5 can't take between_tools: low effort and extra room for thinking instead", async () => {
  const { client, sent } = fakeClient([toolReply]);
  await createToolCall(client, base("claude-opus-5-5"));
  assert.equal(sent[0].thinking, undefined);
  assert.deepEqual(sent[0].output_config, { effort: "low" });
  assert.equal(sent[0].max_tokens, 9000);
});

test("a text-only answer is asked once more; a second miss is handed back to the caller", async () => {
  const retried = fakeClient([textReply, toolReply]);
  const msg = await createToolCall(retried.client, base("claude-sonnet-5-5"));
  assert.equal(retried.sent.length, 2);
  assert.equal(msg.content[0].type, "tool_use");

  const twice = fakeClient([textReply, textReply]);
  const miss = await createToolCall(twice.client, base("claude-sonnet-5-5"));
  assert.equal(twice.sent.length, 2, "one retry, not a loop");
  assert.equal(miss.stop_reason, "end_turn");
});

test("a max_tokens cut or a refusal is not retried — the caller reports it", async () => {
  for (const stop_reason of ["max_tokens", "refusal"]) {
    const { client, sent } = fakeClient([{ content: [], stop_reason }]);
    await createToolCall(client, base("claude-sonnet-5-5"));
    assert.equal(sent.length, 1, stop_reason);
  }
});

test("an unknown model ID gets the steered path, not a forced tool_choice", async () => {
  const { client, sent } = fakeClient([toolReply]);
  await createToolCall(client, base("claude-sonnet-6"));
  assert.equal(sent[0].tool_choice.type, "auto");
  assert.equal(sent[0].thinking, undefined, "between_tools is Sonnet 5.5-only");
});

test("the extra thinking room stays under the SDK's non-streaming ceiling", async () => {
  const { client, sent } = fakeClient([toolReply]);
  await createToolCall(client, base("claude-opus-5-5", { max_tokens: 20000 }));
  assert.equal(sent[0].max_tokens, 21000);
});
