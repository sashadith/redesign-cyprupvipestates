// Inbound WhatsApp: which messages get recorded, and against whom.
//
// WHATSAPP_IN was declared in the schema and never written. No webhook was
// registered with the gateway, so customer replies were invisible to the CRM:
// 59 leads messaged, 13 with a reply on file, all 14 inbound rows typed in by
// hand (production, 2026-10-17). The field carries forcesLeadReacted and feeds
// the Action Center's "real contact" rule, so a missing reply keeps a lead on
// the chase list forever.
//
// The failures worth testing are the ones that write the WRONG row rather than
// no row: our own outgoing message logged as the customer reacting, the team
// group landing on a customer's timeline, a near-miss number matching the
// wrong person. Those are silent and they corrupt the pipeline.
//
// Pure functions and injected deps; no DB, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMsisdn, chatIdFor } from "@/lib/openwa/phoneMatch";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("numbers normalise to a comparable MSISDN whatever the operator typed", () => {
  // Real stored formats, production 2026-10-17.
  assert.equal(toMsisdn("+971 56 342 8755"), "971563428755");
  assert.equal(toMsisdn("+972546222785"), "972546222785");
  assert.equal(toMsisdn("00357 99 278285"), "35799278285");
  assert.equal(chatIdFor("+357 99 278285"), "35799278285@c.us");
});

test("a number too short to be real is refused, not guessed at", () => {
  assert.equal(toMsisdn("1234"), null);
  assert.equal(toMsisdn(""), null);
  assert.equal(toMsisdn(null), null);
  assert.equal(chatIdFor("123"), null);
});

test("matching is on the FULL number — nine shared digits are not a match", () => {
  // "+357 99 278285" and "+44 7999 278285" share their last nine digits and
  // belong to different people. phoneMatch.ts warns about exactly this, and
  // the inbound matcher must not reintroduce it in the other direction.
  const cy = toMsisdn("+357 99 278285");
  const uk = toMsisdn("+44 7999 278285");
  assert.notEqual(cy, uk);
  assert.equal(/last9|slice\(-9\)|endsWith/.test(read("src/lib/openwa/matchLead.ts")), false,
    "matchLead appears to compare partial numbers — a near-miss would land on the wrong lead");
});

test("our own outgoing messages are never logged as the customer reacting", () => {
  // fromMe comes back over the same stream. Logging it would double-count
  // every send AND mark the lead as having replied, resetting the cadence.
  const src = read("src/lib/openwa/inboundMessage.ts");
  assert.ok(/if \(msg\.fromMe\) return .*from-us/.test(src), "the fromMe guard is gone");
});

test("group traffic never lands on a customer timeline", () => {
  // The team announcement group is a @g.us chat. Its messages must not be
  // recorded against any lead. Since 2026-10-18 a one-to-one sender is either
  // …@c.us or a privacy id …@lid; everything else is refused. The behavioural
  // check (a @g.us message with button text) is in whatsappButtonLead.test.ts.
  const src = read("src/lib/openwa/inboundMessage.ts");
  assert.ok(/if \(from\.endsWith\("@c\.us"\)\)/.test(src) && /else if \(from\.endsWith\("@lid"\)\)/.test(src), "the one-to-one sender check changed shape");
  assert.ok(/\} else \{\s*return \{ status: "skipped", reason: "not-a-chat" \};/.test(src), "the one-to-one chat guard is gone");
});

test("a repeated delivery does not create a second timeline entry", () => {
  const src = read("src/lib/openwa/inboundMessage.ts");
  assert.ok(/messageId: msg\.id/.test(src), "messageId is no longer stored, so retries cannot be detected");
  assert.ok(/findFirst\(\{ where: \{ messageId/.test(src), "the duplicate check is gone");
});

test("the webhook is closed when its secret is unset", () => {
  // It writes to a lead's timeline and resets the follow-up cadence, and nginx
  // proxies /api publicly. Falling open because a variable is missing from a
  // release would let anyone plant messages on any lead.
  const src = read("src/app/api/webhooks/whatsapp-inbound/route.ts");
  assert.ok(/if \(!expected \|\| expected\.length < 16\) return false/.test(src), "an unset or short secret must refuse");
  assert.ok(/timingSafeEqual/.test(src), "the secret must be compared in constant time");
  // The gateway cannot send custom headers (verified against the live API
  // 2026-10-17: a webhook created with {"headers":{...}} stores no such field),
  // so the query fallback is what actually carries the secret in production.
  // Removing it would make every real webhook call fail 401 — silently.
  assert.ok(/searchParams\.get\("s"\)/.test(src), "the ?s= fallback is gone; the gateway has no other way to authenticate");
  assert.equal(/x-webhook-secret[^\n]*console\.(log|warn|error)/.test(src), false, "the presented secret must never be logged");
});
