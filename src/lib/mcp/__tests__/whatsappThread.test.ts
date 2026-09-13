import { test } from "node:test";
import assert from "node:assert/strict";
import { readThread, type ThreadDeps } from "@/lib/mcp/tools/whatsappThread";
import { ToolError } from "@/lib/mcp/toolWrapper";
import type { RawMessage } from "@/lib/openwa/shapeMessages";

const INPUT = { leadId: "11111111-1111-4111-8111-111111111111", limit: 20 };
const LEAD = { id: INPUT.leadId, firstName: "Anna", lastName: "Meier", phone: "+357 99 000001" };
const REAL_MESSAGE: RawMessage = { body: "Is the villa still available?", type: "text", timestamp: 1_757_600_000, fromMe: false };

function fakeDeps(over: Partial<ThreadDeps> = {}): ThreadDeps {
  return {
    findLead: async () => LEAD,
    fetchThread: async () => [REAL_MESSAGE],
    ...over,
  };
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

test("a thread with messages carries no note", async () => {
  const out = await readThread(fakeDeps(), INPUT);
  assert.equal(out.messages.length, 1);
  assert.equal(out.note, undefined);
});

test("a 200 with nothing in it reads as a fact, not an error", async () => {
  const out = await readThread(fakeDeps({ fetchThread: async () => [] }), INPUT);
  assert.deepEqual(out.messages, []);
  assert.match(out.note ?? "", /No WhatsApp conversation/i);
});

test("a gateway error becomes a note naming both possibilities, never an internal error", async () => {
  const { result, lines } = await captureErrorLog(() =>
    readThread(
      fakeDeps({
        fetchThread: async () => {
          throw new ToolError("internal", "WhatsApp gateway returned HTTP 500.");
        },
      }),
      INPUT,
    ),
  );
  assert.deepEqual(result.messages, []);
  // Both readings must be in the note: silently mapping 500 to "no
  // conversation" would hide an outage.
  assert.match(result.note ?? "", /no conversation/i);
  assert.match(result.note ?? "", /unhealthy/i);
  // The status must reach the server log rather than being swallowed.
  assert.equal(lines.length, 1);
  assert.match(lines[0], /crm_whatsapp_thread/);
  assert.match(lines[0], /HTTP 500/);
});

test("a non-ToolError failure is logged redacted, without its message body", async () => {
  const { result, lines } = await captureErrorLog(() =>
    readThread(
      fakeDeps({
        fetchThread: async () => {
          throw new Error("Invalid `prisma.lead.findFirst()` invocation: phone = 'secret'");
        },
      }),
      INPUT,
    ),
  );
  assert.match(result.note ?? "", /unhealthy/i);
  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0], /secret/, "only an authored ToolError message may be logged");
});

test("the address actually queried is reported, not only the stored phone", async () => {
  const out = await readThread(fakeDeps(), INPUT);
  assert.equal(out.lead.phone, LEAD.phone);
  assert.equal(out.address, "35799000001@c.us");
});

test("a leading zero stripped by toMsisdn is visible in the reported address", async () => {
  // "07787 597514" is looked up as 7787597514@c.us — a different number. The
  // read path has no thread-existence guard, so the substitution must show.
  const out = await readThread(
    fakeDeps({ findLead: async () => ({ ...LEAD, phone: "07787 597514" }) }),
    INPUT,
  );
  assert.equal(out.lead.phone, "07787 597514");
  assert.equal(out.address, "7787597514@c.us");
});

test("an unknown lead is not found, and the gateway is never asked", async () => {
  let asked = false;
  const deps = fakeDeps({
    findLead: async () => null,
    fetchThread: async () => {
      asked = true;
      return [];
    },
  });
  await assert.rejects(() => readThread(deps, INPUT), (e: unknown) => e instanceof ToolError && e.code === "not_found");
  assert.equal(asked, false);
});

test("a lead with no usable phone is refused before the gateway is asked", async () => {
  let asked = false;
  const deps = fakeDeps({
    findLead: async () => ({ ...LEAD, phone: "123" }),
    fetchThread: async () => {
      asked = true;
      return [];
    },
  });
  await assert.rejects(() => readThread(deps, INPUT), (e: unknown) => e instanceof ToolError && e.code === "validation");
  assert.equal(asked, false);
});
