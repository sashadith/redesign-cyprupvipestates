import { test } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { classifyDeveloperReply, classifySystem, isAutoSubmitted, parseVerdict, type ReplyVerdict } from "@/lib/crm/registration/classify";

function fakeAnthropic(input: unknown) {
  const c = {
    lastRequest: null as any,
    messages: {
      create: async (req: unknown) => {
        c.lastRequest = req;
        return { content: [{ type: "tool_use", id: "t", name: "registration_verdict", input }] };
      },
    },
  };
  return c;
}
const throwingAnthropic = () => ({ messages: { create: async () => { throw new Error("overloaded"); } } });
const asClient = (c: unknown) => c as unknown as Anthropic;

test("parseVerdict", () => {
  assert.deepEqual(parseVerdict({ verdict: "confirmed", evidence: " Registered, thanks " }), { verdict: "confirmed", evidence: "Registered, thanks" });
  assert.equal(parseVerdict({ verdict: "maybe", evidence: "" }), null);
  assert.equal(parseVerdict(null), null);
  assert.equal(parseVerdict({ verdict: "rejected", evidence: "x".repeat(500) })?.evidence.length, 300);
});

test("isAutoSubmitted", () => {
  assert.ok(isAutoSubmitted(new Map([["auto-submitted", "auto-replied"]])));
  assert.ok(!isAutoSubmitted(new Map([["auto-submitted", "no"]])));
  assert.ok(isAutoSubmitted({ "x-autoreply": "yes" }));
  assert.ok(!isAutoSubmitted(new Map()));
});

test("system prompt: confirmation only when explicit, rejection when already registered, data is untrusted", () => {
  assert.match(classifySystem, /untrusted_developer_text/);
  assert.match(classifySystem, /already registered/i);
  assert.match(classifySystem, /out of office|automatic/i);
  assert.match(classifySystem, /never confirmed/);
});

test("classifier maps realistic replies via a fake client", async () => {
  const cases: [string, ReplyVerdict["verdict"]][] = [
    ["Dear Sascha, the client is registered with us. Kind regards, Maria", "confirmed"],
    ["Unfortunately this client has already been registered by another agency.", "rejected"],
    ["I am out of the office until Monday with limited access to email.", "autoreply"],
    ["Which project is the client interested in?", "unclear"],
  ];
  for (const [body, verdict] of cases) {
    const client = fakeAnthropic({ verdict, evidence: body.slice(0, 40) });
    const r = await classifyDeveloperReply({ subject: "Re: Client registration", body, developerName: "Marinakis", clientName: "Anna Muster" }, { client: asClient(client) });
    assert.equal(r.verdict, verdict);
    assert.match(JSON.stringify(client.lastRequest.messages), /untrusted_developer_text/);
    assert.equal(client.lastRequest.tool_choice.name, "registration_verdict");
  }
});

test("API error, unparseable output or no client → unclear, never throws", async () => {
  const input = { subject: null, body: "x", developerName: "D", clientName: "C" };
  assert.deepEqual(await classifyDeveloperReply(input, { client: asClient(throwingAnthropic()) }), { verdict: "unclear", evidence: "" });
  assert.deepEqual(await classifyDeveloperReply(input, { client: asClient(fakeAnthropic({ verdict: "yes" })) }), { verdict: "unclear", evidence: "" });
  assert.deepEqual(await classifyDeveloperReply(input, { client: null }), { verdict: "unclear", evidence: "" });
});
