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
test("getSession / startSession: status read from the session, start is a POST", async () => {
  const s = stub(200, { id: "sess-1", status: "failed", lastError: "bridge" });
  assert.deepEqual(await createOpenWaClient({ fetch: s.f, env }).getSession(), { status: "failed", lastError: "bridge" });
  assert.match(s.calls[0].url, /\/api\/sessions\/sess-1$/);
  const st = stub(200, {});
  await createOpenWaClient({ fetch: st.f, env }).startSession();
  assert.match(st.calls[0].url, /\/api\/sessions\/sess-1\/start$/);
  assert.equal(st.calls[0].init?.method, "POST");
});

test("listGroups: groups endpoint, keeps only group ids, falls back to the id as name", async () => {
  const { f, calls } = stub(200, [
    { id: "120363427859674423@g.us", name: "Cyprus VIP Estates - Pafilia", participantsCount: 5, isAdmin: false },
    { id: "120363400000000000@g.us", name: "  " },
    { id: "35799111222@c.us", name: "not a group" },
  ]);
  const groups = await createOpenWaClient({ fetch: f, env }).listGroups();
  assert.match(calls[0].url, /\/api\/sessions\/sess-1\/groups\?limit=1000$/);
  assert.deepEqual(groups, [
    { id: "120363427859674423@g.us", name: "Cyprus VIP Estates - Pafilia", participants: 5 },
    { id: "120363400000000000@g.us", name: "120363400000000000@g.us", participants: null },
  ]);
});

test("a rate-limited read waits and retries once; a rate-limited send is never repeated", async () => {
  const statuses = [429, 200];
  const calls: string[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${String(url)}`);
    const status = statuses.shift() ?? 429;
    return new Response(JSON.stringify(status === 200 ? { contactId: "1@lid", phone: "491705583988" } : {}), { status, headers: { "retry-after": "0" } });
  }) as unknown as typeof fetch;
  const client = createOpenWaClient({ fetch: f, env });
  assert.equal(await client.resolvePhone("1@lid"), "491705583988");
  assert.equal(calls.length, 2, "one retry");
  calls.length = 0;
  await assert.rejects(client.sendText("1@c.us", "hi"), /HTTP 429/);
  assert.equal(calls.length, 1, "a send is never retried");
});

/* Next patches the global fetch and, without this option, puts a GET into the
   Data Cache with revalidate 31536000 — one year. On 2026-11-11 the gateway's
   session status was cached as "qr_ready" at 14:45 UTC; the operator re-linked
   WhatsApp at 18:43, curl on the same URL with the same key returned "ready",
   and the health cron was still alerting "needs the phone" at 19:10 from the
   cached copy. Cache a `ready` instead and the watch goes blind to a real
   outage for a year — so this is asserted for EVERY call the client makes, not
   only the status one. */
test("every call is uncached — the gateway's answers are live data", async () => {
  for (const exercise of [
    (c: ReturnType<typeof createOpenWaClient>) => c.getSession(),
    (c: ReturnType<typeof createOpenWaClient>) => c.fetchThread("1@c.us", 5),
    (c: ReturnType<typeof createOpenWaClient>) => c.listGroups(),
    (c: ReturnType<typeof createOpenWaClient>) => c.sendText("1@c.us", "hi"),
    (c: ReturnType<typeof createOpenWaClient>) => c.startSession(),
    (c: ReturnType<typeof createOpenWaClient>) => c.resolvePhone("1@lid"),
  ]) {
    const { f, calls } = stub(200, { status: "ready" });
    await exercise(createOpenWaClient({ fetch: f, env })).catch(() => { /* shape is not the point here */ });
    assert.ok(calls.length > 0, "the client did not call the gateway at all");
    for (const c of calls) {
      assert.equal(c.init?.cache, "no-store", `${c.url} may be served from a cache`);
    }
  }
});

test("the 429 retry is uncached too", async () => {
  // The retry re-issues the same request; a cached second attempt would defeat
  // the retry and, worse, store the rate-limited path's answer.
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let n = 0;
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    n += 1;
    return n === 1
      ? new Response("", { status: 429, headers: { "retry-after": "0" } })
      : new Response(JSON.stringify({ status: "ready", lastError: null }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const got = await createOpenWaClient({ fetch: f, env }).getSession();
  assert.equal(got.status, "ready");
  assert.equal(calls.length, 2, "the 429 should have been retried once");
  assert.equal(calls[1].init?.cache, "no-store");
});
