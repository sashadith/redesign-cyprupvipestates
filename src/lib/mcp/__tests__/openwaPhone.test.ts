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
