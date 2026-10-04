import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenWaClient } from "@/lib/openwa/client";
import { ToolError } from "@/lib/mcp/toolWrapper";

const env = {
  OPENWA_BASE_URL: "http://127.0.0.1:2785",
  OPENWA_API_KEY: "owa_k1_abc",
  OPENWA_SESSION_ID: "sess-1",
  OPENWA_DAILY_SEND_CAP: "20",
} as unknown as NodeJS.ProcessEnv;

function stub(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test("fetchThread: calls the history endpoint with the API key header", async () => {
  const { f, calls } = stub(200, [{ body: "hi", type: "text", timestamp: 1787904455, fromMe: true }]);
  const client = createOpenWaClient({ fetch: f, env });
  const msgs = await client.fetchThread("447787597514@c.us", 20);
  assert.equal(msgs.length, 1);
  assert.match(calls[0].url, /\/api\/sessions\/sess-1\/messages\/447787597514@c\.us\/history\?limit=20/);
  assert.equal((calls[0].init?.headers as Record<string, string>)["X-API-Key"], "owa_k1_abc");
});

test("fetchThread: an empty thread is an empty array, not an error", async () => {
  const { f } = stub(200, []);
  assert.deepEqual(await createOpenWaClient({ fetch: f, env }).fetchThread("1@c.us", 5), []);
});

test("sendText: posts chatId and text", async () => {
  const { f, calls } = stub(201, { id: "x" });
  await createOpenWaClient({ fetch: f, env }).sendText("447787597514@c.us", "hello");
  assert.match(calls[0].url, /\/api\/sessions\/sess-1\/messages\/send-text$/);
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { chatId: "447787597514@c.us", text: "hello" });
});

test("a non-2xx response becomes a ToolError and does not leak the body", async () => {
  const { f } = stub(500, { error: "boom", secret: "owa_k1_abc" });
  await assert.rejects(
    () => createOpenWaClient({ fetch: f, env }).sendText("1@c.us", "hi"),
    (e: unknown) => e instanceof ToolError && !(e as Error).message.includes("owa_k1_abc"),
  );
});
