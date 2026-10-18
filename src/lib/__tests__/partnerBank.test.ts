import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bicValid, ibanValid, isPayoutBlocked, maskIban, normaliseIban, payoutBlockedUntil, validateBankDetails, vatIdValid,
} from "@/lib/partner/bank";
import { decryptBankDetails, encryptBankDetails } from "@/lib/partner/bankCrypto";
import crypto from "node:crypto";

test("iban: valid samples", () => {
  for (const s of ["DE89370400440532013000", "CY17002001280000001200527600", "PL61109010140000071219812874", "GB82WEST12345698765432", "de89 3704 0044 0532 0130 00"]) {
    assert.equal(ibanValid(s), true, s);
  }
});

test("iban: wrong checksum, length, country, junk", () => {
  assert.equal(ibanValid("DE89370400440532013001"), false);
  assert.equal(ibanValid("DE8937040044053201300"), false);
  assert.equal(ibanValid("RU0304452522540817810538091310419"), false);
  assert.equal(ibanValid(""), false);
  assert.equal(ibanValid("DE89-3704-0044-0532-0130-00"), false);
});

test("iban: normalise and mask", () => {
  assert.equal(normaliseIban(" de89 3704 "), "DE893704");
  assert.equal(maskIban("de89 3704 0044 0532 0130 00"), "•••• 3000");
});

test("bic and vat id", () => {
  assert.equal(bicValid("COBADEFF"), true);
  assert.equal(bicValid("cobadeff xxx"), true);
  assert.equal(bicValid("COBADEF"), false);
  assert.equal(bicValid("1OBADEFF"), false);
  assert.equal(vatIdValid("CY12345678X"), true);
  assert.equal(vatIdValid("DE 123456789"), true);
  assert.equal(vatIdValid("12345678"), false);
  assert.equal(vatIdValid("CY1"), false);
  assert.equal(vatIdValid("CY" + "1".repeat(19)), false);
});

const good = {
  holder: "Anna Müller", iban: "de89 3704 0044 0532 0130 00", bic: "", billingName: "Müller GmbH",
  billingAddress: "Hauptstr. 1\r\n10115 Berlin", vatId: "",
};

test("validateBankDetails: ok, normalised", () => {
  const r = validateBankDetails(good);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.iban, "DE89370400440532013000");
    assert.equal(r.data.bic, null);
    assert.equal(r.data.vatId, null);
    assert.equal(r.data.billingAddress, "Hauptstr. 1\n10115 Berlin");
  }
});

test("validateBankDetails: errors per field", () => {
  const code = (o: object) => { const r = validateBankDetails({ ...good, ...o }); return r.ok ? "ok" : `${r.field}:${r.code}`; };
  assert.equal(code({ holder: "" }), "holder:err.holder");
  assert.equal(code({ holder: "x".repeat(81) }), "holder:err.holder");
  assert.equal(code({ holder: "A\u0000B" }), "holder:err.holder");
  assert.equal(code({ iban: "DE00" }), "iban:err.iban");
  assert.equal(code({ bic: "bad" }), "bic:err.bic");
  assert.equal(code({ billingName: "x".repeat(121) }), "billingName:err.billingName");
  assert.equal(code({ billingAddress: "x".repeat(301) }), "billingAddress:err.billingAddress");
  assert.equal(code({ billingAddress: "a\u0007b" }), "billingAddress:err.billingAddress");
  assert.equal(code({ vatId: "123" }), "vatId:err.vatId");
  assert.equal(code({ extra: 1 }), "extra:err.unknownField");
  assert.equal(validateBankDetails(null).ok, false);
});

test("payout block: 7 days after an IBAN change", () => {
  assert.equal(payoutBlockedUntil(null), null);
  const at = new Date("2026-10-01T10:00:00Z");
  const until = payoutBlockedUntil(at)!;
  assert.equal(until.toISOString(), "2026-10-08T10:00:00.000Z");
  assert.equal(isPayoutBlocked(until, new Date("2026-10-08T09:59:59Z")), true);
  assert.equal(isPayoutBlocked(until, new Date("2026-10-08T10:00:00Z")), false);
  assert.equal(isPayoutBlocked(null, new Date()), false);
});

test("bankCrypto: round trip and tamper", () => {
  const prev = process.env.SETTINGS_ENCRYPTION_KEY;
  process.env.SETTINGS_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  try {
    const r = validateBankDetails(good);
    assert.ok(r.ok);
    if (!r.ok) return;
    const enc = encryptBankDetails(r.data);
    assert.ok(!enc.includes("DE89"));
    assert.deepEqual(decryptBankDetails(enc), r.data);
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 1;
    assert.throws(() => decryptBankDetails(buf.toString("base64")));
  } finally {
    if (prev === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY; else process.env.SETTINGS_ENCRYPTION_KEY = prev;
  }
});
