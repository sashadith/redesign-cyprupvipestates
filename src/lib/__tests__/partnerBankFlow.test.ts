import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBankDetails, type BankDetails } from "@/lib/partner/bank";
import { buildBankChangedNotice, ibanChanged, ibanLast4, mergeBankInput, partnerDisplayName } from "@/lib/partner/bankFlow";
import { buildBankChangedEmail } from "@/lib/partner/mail";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";

const IBAN_A = "DE89370400440532013000";
const IBAN_B = "CY17002001280000001200527600";
const prev: BankDetails = {
  holder: "Anna Muster", iban: IBAN_A, bic: "COBADEFF", billingName: "Muster GmbH", billingAddress: "Hauptstr. 1\n10115 Berlin", vatId: null,
};
const input = (iban: string) => ({ holder: "Anna Muster", iban, bic: "", billingName: "Muster GmbH", billingAddress: "Hauptstr. 1", vatId: "" });

test("mergeBankInput: empty IBAN keeps the stored one", () => {
  const m = mergeBankInput(prev, input("   "));
  assert.equal(m.iban, IBAN_A);
  const v = validateBankDetails(m);
  assert.equal(v.ok, true);
});

test("mergeBankInput: empty IBAN without a stored one stays empty and fails validation", () => {
  const m = mergeBankInput(null, input(""));
  assert.equal(m.iban, "");
  const v = validateBankDetails(m);
  assert.deepEqual(v, { ok: false, field: "iban", code: "err.iban" });
});

test("mergeBankInput: a typed IBAN replaces the stored one; only allowed keys", () => {
  const m = mergeBankInput(prev, input(" cy17 0020 0128 0000 0012 0052 7600 "));
  assert.equal(m.iban, "cy17 0020 0128 0000 0012 0052 7600");
  assert.deepEqual(Object.keys(m).sort(), ["bic", "billingAddress", "billingName", "holder", "iban", "vatId"]);
  assert.equal(validateBankDetails(m).ok, true);
});

test("ibanChanged: first entry is not a change; same IBAN in other spacing is not a change", () => {
  const next = { ...prev, iban: IBAN_B };
  assert.equal(ibanChanged(null, next), false);
  assert.equal(ibanChanged(prev, { ...prev, iban: "de89 3704 0044 0532 0130 00" }), false);
  assert.equal(ibanChanged(prev, { ...prev, holder: "Other" }), false);
  assert.equal(ibanChanged(prev, next), true);
});

test("ibanLast4 and partnerDisplayName", () => {
  assert.equal(ibanLast4("de89 3704 0044 0532 0130 00"), "3000");
  assert.equal(partnerDisplayName({ company: "  ACME Ltd ", firstName: "A", lastName: "B" }), "ACME Ltd");
  assert.equal(partnerDisplayName({ company: null, firstName: "Anna", lastName: "Muster" }), "Anna Muster");
  assert.equal(partnerDisplayName({ company: " ", firstName: "Anna", lastName: "Muster" }), "Anna Muster");
});

test("buildBankChangedEmail: all 4 locales, last 4 only, escaped name, link to profile", () => {
  const changedAt = new Date("2026-10-18T09:30:00Z");
  for (const l of PARTNER_LOCALES) {
    const m = buildBankChangedEmail(l, { name: "<b>Anna</b>", ibanLast4: "3000", changedAt });
    const all = m.subject + m.text + m.html;
    assert.ok(m.subject.length > 0, l);
    assert.ok(m.text.includes("3000"), l);
    assert.ok(m.html.includes("3000"), l);
    assert.ok(!all.includes(IBAN_A) && !all.includes("370400"), `${l}: no full IBAN`);
    assert.ok(!m.html.includes("<b>Anna</b>"), `${l}: name escaped`);
    assert.ok(m.text.includes("/profile"), l);
    assert.ok(!/\{\w+\}/.test(m.text.replace(/\{name\}/, "")), `${l}: no unfilled placeholder`);
    assert.ok(m.text.includes("2026"), `${l}: change date shown`);
  }
});

test("buildBankChangedEmail: a full IBAN passed by mistake is cut to its last 4", () => {
  const m = buildBankChangedEmail("en", { name: "Anna", ibanLast4: IBAN_A, changedAt: new Date() });
  assert.ok(!m.text.includes(IBAN_A));
  assert.ok(m.text.includes("3000"));
});

test("buildBankChangedNotice: escaped, last 4 only, block date only on change", () => {
  const n1 = buildBankChangedNotice({ name: "A&B <Ltd>", ibanLast4: "3000", blockedUntil: null });
  assert.equal(n1, "Partner A&amp;B &lt;Ltd&gt; changed bank details (IBAN •••• 3000)");
  const n2 = buildBankChangedNotice({ name: "Anna", ibanLast4: IBAN_B, blockedUntil: new Date("2026-10-25T09:30:00Z") });
  assert.ok(n2.startsWith("Partner Anna changed bank details (IBAN •••• 7600) — payouts paused until "));
  assert.ok(n2.includes("25 Oct 2026"));
  assert.ok(!n2.includes(IBAN_B));
});
