# WhatsApp tools in the CRM MCP connector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the already-authorised CRM connector two lead-bound WhatsApp tools — read one lead's thread, send one text to one lead — so the claude.ai project can work WhatsApp conversations without a second connector or an OAuth shim.

**Architecture:** One module (`src/lib/openwa/client.ts`) holds the OpenWA API key and speaks HTTP to `http://127.0.0.1:2785` on the same VPS. Everything decidable without I/O — phone formatting, message shaping, send guards, the daily-cap boundary — lives in pure modules with their own tests. Two thin tool files wire those together through the existing `runTool` wrapper.

**Tech Stack:** TypeScript, Next.js App Router, Prisma, zod, `@modelcontextprotocol/server`, Node's built-in test runner via tsx.

**Spec:** `docs/superpowers/specs/2026-09-13-whatsapp-tools-crm-connector-design.md`

## Global Constraints

- Tests run with `npm test` → `node --import tsx --test src/lib/mcp/__tests__/*.test.ts`. New tests go in `src/lib/mcp/__tests__/` and end in `.test.ts`, or they are not run at all.
- Tests never open a DB connection and never make a network call. Anything needing I/O takes it as an injected parameter.
- Admin-facing copy (tool descriptions, error messages, logged bodies) is **English** — project convention in `CLAUDE.md`.
- Lead-authored text goes through `untrusted(...)` from `src/lib/mcp/format.ts`. Never inline raw inbound text.
- Dates returned to the model go through `fmtDate(...)` — `{iso, local, relative}`.
- Tool handlers always run inside `runTool(name, contextFromAuthInfo(ctx.http?.authInfo), leadId, fn)`; refusals are `throw new ToolError(code, message)`.
- Chat ids are built as `<msisdn>@c.us`. The reconciliation's last-9-digit fuzzy matching must not appear in this code.
- No deploy. The work ends at "tests green"; the operator decides deployment.

---

### Task 1: Phone number → WhatsApp chat id

**Files:**
- Create: `src/lib/openwa/phoneMatch.ts`
- Test: `src/lib/mcp/__tests__/openwaPhone.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toMsisdn(phone: string | null | undefined): string | null`, `chatIdFor(phone: string | null | undefined): string | null` (returns `"447787597514@c.us"`).

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMsisdn, chatIdFor } from "@/lib/openwa/phoneMatch";

test("toMsisdn: CRM phone formats collapse to one MSISDN", () => {
  assert.equal(toMsisdn("+44 7787 597514"), "447787597514");
  assert.equal(toMsisdn("447787597514"), "447787597514");
  assert.equal(toMsisdn("00447787597514"), "447787597514");
  assert.equal(toMsisdn("+357 99 278285"), "35799278285");
});

test("toMsisdn: unusable input is rejected, never guessed at", () => {
  assert.equal(toMsisdn(null), null);
  assert.equal(toMsisdn(""), null);
  assert.equal(toMsisdn("   "), null);
  assert.equal(toMsisdn("ask Irina"), null);
  assert.equal(toMsisdn("+49 170"), null); // too short to be a real MSISDN
});

test("chatIdFor: builds the c.us form OpenWA resolves itself", () => {
  assert.equal(chatIdFor("+44 7787 597514"), "447787597514@c.us");
  assert.equal(chatIdFor("nonsense"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/openwa/phoneMatch`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Turns a CRM-stored phone number into the MSISDN WhatsApp addresses.
// Deliberately NOT the reconciliation's last-9-digit comparison: there is no
// join here, the number comes from the lead record the caller named, so this
// only reformats. Reintroducing fuzzy matching would let a wrong lead be
// addressed — see the design doc.
const MIN_MSISDN_DIGITS = 8;
const MAX_MSISDN_DIGITS = 15; // E.164

export function toMsisdn(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < MIN_MSISDN_DIGITS || digits.length > MAX_MSISDN_DIGITS) return null;
  return digits;
}

export function chatIdFor(phone: string | null | undefined): string | null {
  const msisdn = toMsisdn(phone);
  return msisdn ? `${msisdn}@c.us` : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openwa/phoneMatch.ts src/lib/mcp/__tests__/openwaPhone.test.ts
git commit -m "feat(openwa): phone number to WhatsApp chat id"
```

---

### Task 2: OpenWA configuration

**Files:**
- Create: `src/lib/openwa/config.ts`
- Test: `src/lib/mcp/__tests__/openwaConfig.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `readOpenWaConfig(env: NodeJS.ProcessEnv): OpenWaConfig` where `OpenWaConfig = { baseUrl: string; apiKey: string; sessionId: string; dailySendCap: number }`; throws `McpConfigError` (reused from `@/lib/mcp/publicOrigin`, which `runTool` already maps to a `config` error).

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { McpConfigError } from "@/lib/mcp/publicOrigin";

const ok = {
  OPENWA_BASE_URL: "http://127.0.0.1:2785",
  OPENWA_API_KEY: "owa_k1_abc",
  OPENWA_SESSION_ID: "942ae236-9ca9-4b07-9f41-e3c9d4dfb7bb",
  OPENWA_DAILY_SEND_CAP: "20",
};

test("readOpenWaConfig: a complete environment parses", () => {
  const c = readOpenWaConfig(ok as NodeJS.ProcessEnv);
  assert.equal(c.baseUrl, "http://127.0.0.1:2785");
  assert.equal(c.apiKey, "owa_k1_abc");
  assert.equal(c.dailySendCap, 20);
});

test("readOpenWaConfig: each missing variable is named in the error", () => {
  for (const key of Object.keys(ok)) {
    const env = { ...ok } as Record<string, string>;
    delete env[key];
    assert.throws(
      () => readOpenWaConfig(env as NodeJS.ProcessEnv),
      (e: unknown) => e instanceof McpConfigError && (e as Error).message.includes(key),
      `${key} missing should name ${key}`,
    );
  }
});

test("readOpenWaConfig: a non-numeric or zero cap is refused", () => {
  assert.throws(() => readOpenWaConfig({ ...ok, OPENWA_DAILY_SEND_CAP: "many" } as NodeJS.ProcessEnv), McpConfigError);
  assert.throws(() => readOpenWaConfig({ ...ok, OPENWA_DAILY_SEND_CAP: "0" } as NodeJS.ProcessEnv), McpConfigError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/openwa/config`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { McpConfigError } from "@/lib/mcp/publicOrigin";

export type OpenWaConfig = { baseUrl: string; apiKey: string; sessionId: string; dailySendCap: number };

// Fail loud and name the variable: a half-configured connector that silently
// does nothing is worse than one that says which line is missing.
function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new McpConfigError(`${key} is not set.`);
  return v;
}

export function readOpenWaConfig(env: NodeJS.ProcessEnv = process.env): OpenWaConfig {
  const raw = required(env, "OPENWA_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpConfigError(`OPENWA_BASE_URL is not an absolute URL: ${raw}`);
  }
  const capRaw = required(env, "OPENWA_DAILY_SEND_CAP");
  const dailySendCap = Number(capRaw);
  if (!Number.isInteger(dailySendCap) || dailySendCap < 1) {
    throw new McpConfigError(`OPENWA_DAILY_SEND_CAP must be a positive integer, got: ${capRaw}`);
  }
  return {
    baseUrl: url.origin,
    apiKey: required(env, "OPENWA_API_KEY"),
    sessionId: required(env, "OPENWA_SESSION_ID"),
    dailySendCap,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openwa/config.ts src/lib/mcp/__tests__/openwaConfig.test.ts
git commit -m "feat(openwa): fail-loud configuration reader"
```

---

### Task 3: Shaping OpenWA messages for the model

**Files:**
- Create: `src/lib/openwa/shapeMessages.ts`
- Test: `src/lib/mcp/__tests__/openwaShape.test.ts`

**Interfaces:**
- Consumes: `untrusted`, `fmtDate` from `@/lib/mcp/format`.
- Produces: `type RawMessage = { body?: string | null; type?: string | null; timestamp?: number | null; fromMe?: boolean | null; metadata?: { media?: { mimetype?: string; sizeBytes?: number } } | null }` and `shapeThread(raw: RawMessage[]): ShapedMessage[]`, oldest first.

Two behaviours carry real consequences and are why this is its own tested module:

1. **Empty `unknown` rows are dropped.** OpenWA emits body-less `unknown` entries at session-sync time. During the 2026-09-13 reconciliation one of them, timestamped the moment the gateway connected, was about to be written to a lead's timeline as a contact that never happened.
2. **Media is a marker, never bytes.** A single document turned a five-message read into an 11.1 MB response.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeThread } from "@/lib/openwa/shapeMessages";

const at = 1787904455; // 2026-08-28

test("shapeThread: drops the empty 'unknown' sync artefacts", () => {
  const out = shapeThread([
    { body: "real message", type: "text", timestamp: at, fromMe: false },
    { body: "", type: "unknown", timestamp: at + 10, fromMe: false },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].text?.untrusted_content, "real message");
});

test("shapeThread: keeps an 'unknown' row that actually carries text", () => {
  const out = shapeThread([{ body: "hello", type: "unknown", timestamp: at, fromMe: true }]);
  assert.equal(out.length, 1);
});

test("shapeThread: media becomes a marker, never bytes", () => {
  const out = shapeThread([
    { body: "", type: "image", timestamp: at, fromMe: false, metadata: { media: { mimetype: "image/jpeg", sizeBytes: 153_000 } } },
  ]);
  assert.deepEqual(out[0].media, { type: "image", mimetype: "image/jpeg", sizeBytes: 153_000 });
  assert.equal(out[0].text, null);
});

test("shapeThread: outbound text is not wrapped as untrusted, inbound is", () => {
  const out = shapeThread([
    { body: "from them", type: "text", timestamp: at, fromMe: false },
    { body: "from us", type: "text", timestamp: at + 1, fromMe: true },
  ]);
  assert.equal(out[0].direction, "IN");
  assert.ok(out[0].text && "untrusted_content" in out[0].text);
  assert.equal(out[1].direction, "OUT");
  assert.equal(out[1].text, "from us");
});

test("shapeThread: returns oldest first regardless of input order", () => {
  const out = shapeThread([
    { body: "second", type: "text", timestamp: at + 100, fromMe: true },
    { body: "first", type: "text", timestamp: at, fromMe: true },
  ]);
  assert.deepEqual(out.map((m) => m.text), ["first", "second"]);
});

test("shapeThread: a row without a timestamp is dropped rather than dated now", () => {
  assert.equal(shapeThread([{ body: "x", type: "text", timestamp: null, fromMe: true }]).length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/openwa/shapeMessages`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { fmtDate, untrusted } from "@/lib/mcp/format";

export type RawMessage = {
  body?: string | null;
  type?: string | null;
  timestamp?: number | null;
  fromMe?: boolean | null;
  metadata?: { media?: { mimetype?: string; sizeBytes?: number } | null } | null;
};

export type ShapedMessage = {
  direction: "IN" | "OUT";
  at: ReturnType<typeof fmtDate>;
  type: string;
  text: string | ReturnType<typeof untrusted> | null;
  media: { type: string; mimetype: string | null; sizeBytes: number | null } | null;
};

// A body-less `unknown` row is a gateway protocol artefact, not a message.
// One of them, stamped at session-connect time, nearly became a lead's
// "last contact" during the 2026-09-13 reconciliation.
function isRealMessage(m: RawMessage): boolean {
  if (typeof m.timestamp !== "number") return false;
  const hasBody = !!m.body?.trim();
  return hasBody || (m.type ?? "unknown") !== "unknown";
}

export function shapeThread(raw: RawMessage[]): ShapedMessage[] {
  return raw
    .filter(isRealMessage)
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
    .map((m) => {
      const body = m.body?.trim() || null;
      const media = m.metadata?.media;
      const fromMe = !!m.fromMe;
      return {
        direction: fromMe ? ("OUT" as const) : ("IN" as const),
        at: fmtDate(new Date((m.timestamp as number) * 1000)),
        type: m.type ?? "text",
        // Their words are data, ours are not — same rule as every CRM tool.
        text: body === null ? null : fromMe ? body : untrusted(body),
        media: media ? { type: m.type ?? "media", mimetype: media.mimetype ?? null, sizeBytes: media.sizeBytes ?? null } : null,
      };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openwa/shapeMessages.ts src/lib/mcp/__tests__/openwaShape.test.ts
git commit -m "feat(openwa): shape threads, drop sync artefacts, never inline media"
```

---

### Task 4: The OpenWA HTTP client

**Files:**
- Create: `src/lib/openwa/client.ts`
- Test: `src/lib/mcp/__tests__/openwaClient.test.ts`

**Interfaces:**
- Consumes: `readOpenWaConfig` (Task 2), `RawMessage` (Task 3).
- Produces: `createOpenWaClient(deps?: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv }): OpenWaClient` with `fetchThread(chatId: string, limit: number): Promise<RawMessage[]>` and `sendText(chatId: string, text: string): Promise<void>`. Both throw `ToolError("internal", …)` on a non-2xx response.

The client takes `fetch` as an injected dependency so the test drives it without a network or a running OpenWA.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenWaClient } from "@/lib/openwa/client";
import { ToolError } from "@/lib/mcp/toolWrapper";

const env = {
  OPENWA_BASE_URL: "http://127.0.0.1:2785",
  OPENWA_API_KEY: "owa_k1_abc",
  OPENWA_SESSION_ID: "sess-1",
  OPENWA_DAILY_SEND_CAP: "20",
} as NodeJS.ProcessEnv;

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/openwa/client`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { ToolError } from "@/lib/mcp/toolWrapper";
import { readOpenWaConfig } from "./config";
import type { RawMessage } from "./shapeMessages";

export type OpenWaClient = {
  fetchThread(chatId: string, limit: number): Promise<RawMessage[]>;
  sendText(chatId: string, text: string): Promise<void>;
};

// The only module that knows the OpenWA API key. Runs against 127.0.0.1 on the
// same VPS, so no TLS and no public hop; the /mcp nginx gate is irrelevant here.
export function createOpenWaClient(deps: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv } = {}): OpenWaClient {
  const cfg = readOpenWaConfig(deps.env ?? process.env);
  const doFetch = deps.fetch ?? fetch;
  const base = `${cfg.baseUrl}/api/sessions/${encodeURIComponent(cfg.sessionId)}`;
  const headers = { "X-API-Key": cfg.apiKey, "Content-Type": "application/json" };

  // The response body can echo request data; only the status is surfaced.
  async function call(url: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers });
    } catch {
      throw new ToolError("internal", "WhatsApp gateway unreachable.");
    }
    if (!res.ok) throw new ToolError("internal", `WhatsApp gateway returned HTTP ${res.status}.`);
    return res.json().catch(() => null);
  }

  return {
    async fetchThread(chatId, limit) {
      const body = await call(`${base}/messages/${chatId}/history?limit=${limit}&deep=true`);
      return Array.isArray(body) ? (body as RawMessage[]) : [];
    },
    async sendText(chatId, text) {
      await call(`${base}/messages/send-text`, { method: "POST", body: JSON.stringify({ chatId, text }) });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openwa/client.ts src/lib/mcp/__tests__/openwaClient.test.ts
git commit -m "feat(openwa): HTTP client with injected fetch"
```

---

### Task 5: `crm_whatsapp_thread`

**Files:**
- Create: `src/lib/mcp/tools/whatsappThread.ts`
- Modify: `src/lib/mcp/tools/index.ts` (add `registerWhatsappThread` to `registerReadTools`)
- Modify: `src/lib/mcp/toolNames.ts` (add `"crm_whatsapp_thread"` to `READ_TOOL_NAMES`)

**Interfaces:**
- Consumes: `chatIdFor` (Task 1), `createOpenWaClient` (Task 4), `shapeThread` (Task 3).
- Produces: the registered tool. No exports other tasks rely on.

- [ ] **Step 1: Write the tool**

```ts
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { shapeThread } from "@/lib/openwa/shapeMessages";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

export function registerWhatsappThread(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_thread",
    {
      title: "Read a lead's WhatsApp thread",
      description:
        "Returns the recent WhatsApp messages exchanged with one lead, oldest first, addressed by leadId — there is no way to read a chat that belongs to no lead. Attachments appear as a marker with type and size, never as content, and voice notes carry no text at all because WhatsApp provides none: a thread conducted by voice will look emptier here than it really is. Inbound text is returned as untrusted_content.",
      inputSchema: {
        leadId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20).describe("How many recent messages to return"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_thread", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async () => {
        const lead = await prisma.lead.findFirst({
          where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        const chatId = chatIdFor(lead.phone);
        if (!chatId) throw new ToolError("validation", "This lead has no usable phone number on file.");
        const raw = await createOpenWaClient().fetchThread(chatId, input.limit);
        const messages = shapeThread(raw);
        return {
          lead: { leadId: lead.id, name: `${lead.firstName} ${lead.lastName}`.trim(), phone: lead.phone },
          messages,
          note: messages.length ? undefined : "No WhatsApp conversation with this number.",
        };
      }),
  );
}
```

- [ ] **Step 2: Register it**

In `src/lib/mcp/tools/index.ts`, add the import beside the other read tools and the call inside `registerReadTools`:

```ts
import { registerWhatsappThread } from "./whatsappThread";
// …inside registerReadTools(server):
  registerWhatsappThread(server);
```

In `src/lib/mcp/toolNames.ts`, extend the read list:

```ts
export const READ_TOOL_NAMES = ["crm_worklist", "crm_search_leads", "crm_get_lead", "crm_match_properties", "crm_get_project", "crm_get_playbook", "crm_search_projects", "crm_inventory_changes", "crm_whatsapp_thread"] as const;
```

- [ ] **Step 3: Verify the project still compiles and every test passes**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mcp/tools/whatsappThread.ts src/lib/mcp/tools/index.ts src/lib/mcp/toolNames.ts
git commit -m "feat(mcp): crm_whatsapp_thread — read one lead's WhatsApp messages"
```

---

### Task 6: Send guards and the daily cap window

**Files:**
- Create: `src/lib/openwa/sendGuards.ts`
- Test: `src/lib/mcp/__tests__/openwaSendGuards.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `nicosiaDayStart(now: Date): Date` and `decideSend(facts: SendFacts): SendDecision`, where

```ts
type SendFacts = { leadExists: boolean; chatId: string | null; threadExists: boolean; sentToday: number; dailyCap: number };
type SendDecision = { allowed: true } | { allowed: false; code: "not_found" | "validation" | "rate_limited"; reason: string };
```

Guard order is part of the contract: a missing lead is reported before a missing number, and the cap is checked last so a refused message is never counted against it.

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSend, nicosiaDayStart } from "@/lib/openwa/sendGuards";

const good = { leadExists: true, chatId: "447787597514@c.us", threadExists: true, sentToday: 0, dailyCap: 20 };

test("decideSend: all four guards satisfied", () => {
  assert.deepEqual(decideSend(good), { allowed: true });
});

test("decideSend: refuses an unknown or deleted lead", () => {
  const d = decideSend({ ...good, leadExists: false });
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.code, "not_found");
});

test("decideSend: refuses a lead with no usable number", () => {
  const d = decideSend({ ...good, chatId: null });
  assert.equal(d.allowed === false && d.code, "validation");
});

test("decideSend: refuses when no thread exists — no cold-starting a conversation", () => {
  const d = decideSend({ ...good, threadExists: false });
  assert.equal(d.allowed === false && d.code, "validation");
  assert.match(d.allowed === false ? d.reason : "", /no existing WhatsApp conversation/i);
});

test("decideSend: the cap boundary — at the limit refuses, one below sends", () => {
  assert.equal(decideSend({ ...good, sentToday: 19, dailyCap: 20 }).allowed, true);
  const d = decideSend({ ...good, sentToday: 20, dailyCap: 20 });
  assert.equal(d.allowed === false && d.code, "rate_limited");
});

test("decideSend: a missing lead is reported before a missing number", () => {
  const d = decideSend({ ...good, leadExists: false, chatId: null });
  assert.equal(d.allowed === false && d.code, "not_found");
});

test("nicosiaDayStart: the window starts at local midnight, not UTC midnight", () => {
  // 2026-08-15 00:30 Nicosia (UTC+3 in summer) is 2026-08-14 21:30 UTC;
  // the day it belongs to must start at 2026-08-14T21:00:00Z.
  assert.equal(nicosiaDayStart(new Date("2026-08-14T21:30:00Z")).toISOString(), "2026-08-14T21:00:00.000Z");
  // Just before that instant, we are still in the previous Nicosia day.
  assert.equal(nicosiaDayStart(new Date("2026-08-14T20:59:00Z")).toISOString(), "2026-08-13T21:00:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `@/lib/openwa/sendGuards`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type SendFacts = { leadExists: boolean; chatId: string | null; threadExists: boolean; sentToday: number; dailyCap: number };
export type SendDecision = { allowed: true } | { allowed: false; code: "not_found" | "validation" | "rate_limited"; reason: string };

// Order matters: identity first, then addressability, then the cap — so a
// message refused for any other reason is never counted against the day.
export function decideSend(f: SendFacts): SendDecision {
  if (!f.leadExists) return { allowed: false, code: "not_found", reason: "Lead not found." };
  if (!f.chatId) return { allowed: false, code: "validation", reason: "This lead has no usable phone number on file." };
  if (!f.threadExists) {
    return {
      allowed: false,
      code: "validation",
      reason: "There is no existing WhatsApp conversation with this number. This tool can only continue a thread that already exists, never start one.",
    };
  }
  if (f.sentToday >= f.dailyCap) {
    return { allowed: false, code: "rate_limited", reason: `Daily WhatsApp limit reached (${f.dailyCap} messages). It resets at midnight Cyprus time.` };
  }
  return { allowed: true };
}

// The cap should reset when the operator's day does, not at 02:00 or 03:00
// local because the rows are stored in UTC. Derived from the zone's own offset
// so DST needs no table.
export function nicosiaDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offsetMs = localMs - Math.floor(now.getTime() / 1000) * 1000;
  const localMidnightMs = Date.UTC(get("year"), get("month") - 1, get("day"));
  return new Date(localMidnightMs - offsetMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. If `nicosiaDayStart` is off by the DST hour, fix the offset derivation — the two assertions pin both sides of the boundary.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openwa/sendGuards.ts src/lib/mcp/__tests__/openwaSendGuards.test.ts
git commit -m "feat(openwa): send guards and the Nicosia-midnight cap window"
```

---

### Task 7: `crm_whatsapp_send`

**Files:**
- Create: `src/lib/mcp/tools/whatsappSend.ts`
- Modify: `src/lib/crm/logInteraction.ts` (widen `via`)
- Modify: `src/lib/mcp/tools/index.ts` (add to `registerWriteTools`)
- Modify: `src/lib/mcp/toolNames.ts` (add to `WRITE_TOOL_NAMES`)

**Interfaces:**
- Consumes: `decideSend`, `nicosiaDayStart` (Task 6), `chatIdFor` (Task 1), `createOpenWaClient` (Task 4), `logLeadInteraction` from `@/lib/crm/logInteraction`.
- Produces: the registered tool.

- [ ] **Step 1: Widen the `via` marker**

In `src/lib/crm/logInteraction.ts`, change the field on `LogInteractionInput`:

```ts
  via?: "mcp" | "mcp-whatsapp";
```

The distinct value is what the daily-cap query counts; `"mcp"` alone would also match interactions the operator logged by hand through `crm_log_interaction`.

- [ ] **Step 2: Write the tool**

```ts
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { chatIdFor } from "@/lib/openwa/phoneMatch";
import { createOpenWaClient } from "@/lib/openwa/client";
import { readOpenWaConfig } from "@/lib/openwa/config";
import { decideSend, nicosiaDayStart } from "@/lib/openwa/sendGuards";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

export function registerWhatsappSend(server: McpServer) {
  server.registerTool(
    "crm_whatsapp_send",
    {
      title: "Send a WhatsApp message to a lead",
      description:
        "Sends one text message over WhatsApp to a lead, and logs it on that lead's timeline as WHATSAPP_OUT. It can only continue a conversation that already exists — a number with no thread is refused rather than messaged, so a wrong number cannot reach a stranger. A daily cap applies. Send only on an explicit instruction from the operator; a WhatsApp message cannot be recalled after a few minutes.",
      inputSchema: {
        leadId: z.string().uuid(),
        text: z.string().trim().min(1).max(4000),
      },
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: false },
    },
    async (input, ctx) =>
      runTool("crm_whatsapp_send", contextFromAuthInfo(ctx.http?.authInfo), input.leadId, async (c) => {
        const cfg = readOpenWaConfig();
        const client = createOpenWaClient();

        const lead = await prisma.lead.findFirst({
          where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { id: true, firstName: true, lastName: true, phone: true },
        });
        const chatId = lead ? chatIdFor(lead.phone) : null;

        // Guard 3 needs one cheap read: a thread with at least one message.
        const threadExists = chatId ? (await client.fetchThread(chatId, 1)).length > 0 : false;

        const sentToday = await prisma.leadInteraction.count({
          where: {
            type: "WHATSAPP_OUT",
            occurredAt: { gte: nicosiaDayStart(new Date()) },
            metadata: { path: ["via"], equals: "mcp-whatsapp" },
          },
        });

        const decision = decideSend({ leadExists: !!lead, chatId, threadExists, sentToday, dailyCap: cfg.dailySendCap });
        if (!decision.allowed) throw new ToolError(decision.code, decision.reason);

        await client.sendText(chatId!, input.text);

        // Sent. From here a failure must never be reported as "not sent", and
        // the send must never be retried to repair a logging error.
        try {
          const { interactionId } = await logLeadInteraction({ userId: c.userId, userName: c.userName }, lead!.id, {
            type: "WHATSAPP_OUT",
            body: input.text,
            via: "mcp-whatsapp",
          });
          return { sent: true, interactionId, to: lead!.phone, at: fmtDate(new Date()) };
        } catch {
          return {
            sent: true,
            interactionId: null,
            to: lead!.phone,
            at: fmtDate(new Date()),
            warning: "The message was delivered to WhatsApp but could not be written to the lead's timeline. Log it by hand; do not send again.",
          };
        }
      }),
  );
}
```

Note on the cadence: `logLeadInteraction` calls `applyFollowUpCadence`, which moves `nextFollowUpAt` to now + 7 or 14 days. That is **correct here** — a message really was just sent. Do not add the "restore the previous follow-up date" workaround used when backfilling historical messages; see `crm-contact-tracking-2026-07-25`.

- [ ] **Step 3: Register it**

In `src/lib/mcp/tools/index.ts`:

```ts
import { registerWhatsappSend } from "./whatsappSend";
// …inside registerWriteTools(server):
  registerWhatsappSend(server);
```

In `src/lib/mcp/toolNames.ts`:

```ts
export const WRITE_TOOL_NAMES = ["crm_log_interaction", "crm_update_lead", "crm_draft_email", "crm_send_email", "crm_list_drafts", "crm_create_lead", "crm_delete_lead", "crm_restore_lead", "crm_whatsapp_send"] as const;
```

- [ ] **Step 4: Verify compile and tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/tools/whatsappSend.ts src/lib/crm/logInteraction.ts src/lib/mcp/tools/index.ts src/lib/mcp/toolNames.ts
git commit -m "feat(mcp): crm_whatsapp_send — guarded send that logs itself"
```

---

### Task 8: Operator handover

**Files:**
- Modify: `docs/CRM-MCP-CONNECTOR.md` — the connector's own runbook, and where `MCP_PUBLIC_ORIGIN` and the rest of its environment are already documented. There is no `docs/DEPLOYMENT.md`.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing in code.

- [ ] **Step 1: Document the four variables**

Add to the deployment env table, with these exact names and the note that they must exist in `/var/www/shared/.env` **before** the deploy, or the first tool call returns a config error:

```
OPENWA_BASE_URL=http://127.0.0.1:2785
OPENWA_API_KEY=<dedicated OPERATOR key, minted separately from the Claude Code one>
OPENWA_SESSION_ID=<session uuid from GET /api/sessions>
OPENWA_DAILY_SEND_CAP=20
```

- [ ] **Step 2: Mint the dedicated key (operator runs this, not the agent)**

```bash
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'K=$(grep "^API_MASTER_KEY=" /opt/openwa/.env | cut -d= -f2); curl -s -X POST http://127.0.0.1:2785/api/auth/api-keys -H "X-API-Key: $K" -H "Content-Type: application/json" -d "{\"name\":\"cyprusvipestates app\",\"role\":\"operator\"}"'
```

- [ ] **Step 3: Commit and stop**

```bash
git add docs/CRM-MCP-CONNECTOR.md
git commit -m "docs: OpenWA environment for the WhatsApp connector tools"
```

Then report to the operator: branch, what is green, and that deployment is their decision. **Do not deploy.** The first live send must be to a lead the operator names, with them watching.

---

## Self-Review

**Spec coverage.** Two tools — Tasks 5 and 7. Four send guards — Task 6, wired in Task 7. Daily cap counted from interactions with no new table — Task 7's `prisma.leadInteraction.count`. Automatic `WHATSAPP_OUT` logging — Task 7. Media as marker and `unknown`-artefact filtering — Task 3. `<msisdn>@c.us` addressing with no fuzzy matching — Task 1. Single module holding the key — Task 4. Env with loud failure — Task 2. Lead-bound reads — both tools take `leadId` only. Deployment left to the operator — Task 8.

**Placeholders.** None: every code step carries the code, every test step the assertions.

**Type consistency.** `RawMessage` is defined in Task 3 and imported by Task 4. `chatIdFor` (Task 1) is used in Tasks 5 and 7. `decideSend`/`nicosiaDayStart` (Task 6) are used in Task 7. `readOpenWaConfig` returns `dailySendCap`, which Task 7 passes as `dailyCap` — the rename is deliberate and appears in both places.

**One thing the implementer must check rather than trust.** Task 7 filters the cap query with Prisma's `metadata: { path: ["via"], equals: "mcp-whatsapp" }` JSON filter. That syntax is correct for PostgreSQL on current Prisma versions, but it is the only line in this plan not exercised by a unit test, since the tests never touch the database. Verify it against the schema's Prisma version before relying on it; if it does not filter, fall back to counting with a raw query on `metadata->>'via'`.
