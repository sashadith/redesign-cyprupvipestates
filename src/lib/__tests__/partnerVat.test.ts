import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EU_COUNTRIES, checkPartnerVatId, creditNoteRecipientVatId, deriveVatMode, euVatIdValid, normaliseVatId,
  vatIdMissing, vatIdRequired, vatIdSoftExempt, vatModeAfterChange, vatPrefixFor,
} from "@/lib/partner/vat";
import { buildVatModeChangedNotice } from "@/lib/partner/vatNotice";
import { validateProfile, validateRegistration } from "@/lib/partner/registration";

test("vat: EU-27 list", () => {
  assert.equal(EU_COUNTRIES.length, 27);
  assert.equal(new Set(EU_COUNTRIES).size, 27);
  for (const c of EU_COUNTRIES) assert.match(c, /^[A-Z]{2}$/);
  assert.ok(!EU_COUNTRIES.includes("GB") && !EU_COUNTRIES.includes("CH") && !EU_COUNTRIES.includes("EL"));
});

test("vat: prefix (Greece uses EL)", () => {
  assert.equal(vatPrefixFor("GR"), "EL");
  assert.equal(vatPrefixFor("DE"), "DE");
  assert.equal(vatPrefixFor("cy"), "CY");
});

test("vat: normalise strips spaces, dots, dashes and upper-cases", () => {
  assert.equal(normaliseVatId(" de 123.456-789 "), "DE123456789");
  assert.equal(normaliseVatId("atu-1234 5678"), "ATU12345678");
  assert.equal(normaliseVatId(""), "");
});

test("vat: EU format per country", () => {
  assert.ok(euVatIdValid("DE", "DE123456789"));
  assert.ok(euVatIdValid("AT", "ATU12345678"));
  assert.ok(euVatIdValid("GR", "EL094259216"));
  assert.ok(euVatIdValid("CY", "CY60038766O"));
  assert.ok(euVatIdValid("DE", "de 123 456 789"));
  assert.ok(!euVatIdValid("FR", "DE123456789"), "DE prefix for FR");
  assert.ok(!euVatIdValid("GR", "GR094259216"), "Greece must use EL");
  assert.ok(!euVatIdValid("DE", "DE1"), "too short");
  assert.ok(!euVatIdValid("DE", "DE12345678901234"), "too long");
  assert.ok(!euVatIdValid("DE", "123456789"), "no prefix");
  assert.ok(!euVatIdValid("DE", "DE12345_789"));
});

test("vat: required only for a company in the EU", () => {
  assert.equal(vatIdRequired({ country: "DE", company: "Meier GmbH" }), true);
  assert.equal(vatIdRequired({ country: "DE", company: "  " }), false);
  assert.equal(vatIdRequired({ country: "DE", company: null }), false);
  assert.equal(vatIdRequired({ country: "CY", company: "X Ltd" }), true);
  assert.equal(vatIdRequired({ country: "GB", company: "X Ltd" }), false);
  assert.equal(vatIdRequired({ country: "CH", company: "X AG" }), false);
});

test("vat: deriveVatMode matrix", () => {
  assert.equal(deriveVatMode({ country: "DE", vatId: "DE123456789" }), "REVERSE_CHARGE");
  assert.equal(deriveVatMode({ country: "GR", vatId: "EL094259216" }), "REVERSE_CHARGE");
  assert.equal(deriveVatMode({ country: "CY", vatId: "CY60038766O" }), "CY_VAT");
  assert.equal(deriveVatMode({ country: "DE", vatId: null }), "NONE");
  assert.equal(deriveVatMode({ country: "CY", vatId: "" }), "NONE");
  assert.equal(deriveVatMode({ country: "GB", vatId: "GB123456789" }), "NONE");
  assert.equal(deriveVatMode({ country: "US", vatId: null }), "NONE");
});

test("vat: a manual mode survives a VAT-number change, an automatic one is re-derived", () => {
  assert.equal(vatModeAfterChange({ vatMode: "NONE", vatModeManual: true }, { country: "DE", vatId: "DE123456789" }), "NONE");
  assert.equal(vatModeAfterChange({ vatMode: "NONE", vatModeManual: false }, { country: "DE", vatId: "DE123456789" }), "REVERSE_CHARGE");
  assert.equal(vatModeAfterChange({ vatMode: "REVERSE_CHARGE", vatModeManual: false }, { country: "DE", vatId: null }), "NONE");
});

test("vat: checkPartnerVatId (EU strict, non-EU generic, stored normalised)", () => {
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "X", vatId: "" }), { ok: false, code: "err.vatIdRequired" });
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "", vatId: "" }), { ok: true, vatId: null });
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "", vatId: "FR12345678901" }), { ok: false, code: "err.vatIdFormat" });
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "X", vatId: "de-123 456 789" }), { ok: true, vatId: "DE123456789" });
  assert.deepEqual(checkPartnerVatId({ country: "CH", company: "X AG", vatId: "che-123.456.789" }), { ok: true, vatId: "CHE123456789" });
  assert.deepEqual(checkPartnerVatId({ country: "CH", company: "X AG", vatId: "" }), { ok: true, vatId: null });
  assert.deepEqual(checkPartnerVatId({ country: "CH", company: "X AG", vatId: "AB1" }), { ok: false, code: "err.vatIdFormat" });
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "X", vatId: 5 }), { ok: false, code: "err.vatIdFormat" });
});

test("vat: credit-note recipient VAT number prefers the partner's own", () => {
  assert.equal(creditNoteRecipientVatId("DE123456789", "CY99999999X"), "DE123456789");
  assert.equal(creditNoteRecipientVatId(null, "CY99999999X"), "CY99999999X");
  assert.equal(creditNoteRecipientVatId("", null), null);
});

const reg = {
  firstName: "Anna", lastName: "Meier", country: "DE", phone: "+49 170 1234567", email: "anna@example.com",
  language: "de", type: "REAL_ESTATE", password: "a-long-password", acceptAgreement: true,
};
const code = (r: { ok: boolean; field?: string; code?: string }) => (r.ok ? "ok" : `${r.field}:${r.code}`);

test("registration: VAT number rules", () => {
  assert.equal(code(validateRegistration({ ...reg, company: "Meier GmbH" })), "vatId:err.vatIdRequired");
  assert.equal(code(validateRegistration({ ...reg, company: "Meier GmbH", vatId: "FR12345678901" })), "vatId:err.vatIdFormat");
  assert.equal(code(validateRegistration({ ...reg })), "ok", "EU private person without company");
  assert.equal(code(validateRegistration({ ...reg, company: "" , vatId: "" })), "ok");
  assert.equal(code(validateRegistration({ ...reg, country: "GB", company: "Meier Ltd" })), "ok", "non-EU company without VAT");
  const r = validateRegistration({ ...reg, country: "GR", company: "Alpha AE", vatId: "el 094 259 216" });
  assert.ok(r.ok && r.data.vatId === "EL094259216");
  const none = validateRegistration({ ...reg });
  assert.ok(none.ok && none.data.vatId === null);
});

test("profile: VAT number rule uses the stored country", () => {
  const p = { firstName: "Anna", lastName: "Meier", company: "Meier GmbH", language: "de" };
  assert.equal(code(validateProfile({ ...p, vatId: "" }, { country: "DE" })), "vatId:err.vatIdRequired");
  assert.equal(code(validateProfile({ ...p, vatId: "" }, { country: "GB" })), "ok");
  assert.equal(code(validateProfile({ ...p, vatId: "DE123456789" }, { country: "AT" })), "vatId:err.vatIdFormat");
  const ok = validateProfile({ ...p, vatId: "atu 1234 5678" }, { country: "AT" });
  assert.ok(ok.ok && ok.data.vatId === "ATU12345678");
});

test("vat: soft path for existing partners — no stored number and the company unchanged", () => {
  assert.equal(vatIdSoftExempt({ vatId: null, company: "Muster GmbH" }, " Muster GmbH "), true);
  assert.equal(vatIdSoftExempt({ vatId: "", company: null }, ""), true);
  assert.equal(vatIdSoftExempt({ vatId: null, company: "Muster GmbH" }, "Muster AG"), false); // company changed → hard rule
  assert.equal(vatIdSoftExempt({ vatId: "DE123456789", company: "Muster GmbH" }, "Muster GmbH"), false); // stored number cannot be cleared
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "Muster GmbH", vatId: "", allowMissing: true }), { ok: true, vatId: null });
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "Muster GmbH", vatId: "" }), { ok: false, code: "err.vatIdRequired" });
  // allowMissing never relaxes the format of a number that is typed in
  assert.deepEqual(checkPartnerVatId({ country: "DE", company: "Muster GmbH", vatId: "FR123", allowMissing: true }), { ok: false, code: "err.vatIdFormat" });
});

test("profile: soft path accepts a save without a VAT number; company change or registration stays hard", () => {
  const raw = { firstName: "Anna", lastName: "Muster", company: "Muster GmbH", vatId: "", language: "de" };
  const code = (x: ReturnType<typeof validateProfile>) => (x.ok ? "ok" : `${x.field}:${x.code}`);
  const legacy = { vatId: null, company: "Muster GmbH" };
  assert.equal(code(validateProfile(raw, { country: "DE", stored: legacy })), "ok");
  assert.equal(code(validateProfile({ ...raw, firstName: "Anne" }, { country: "DE", stored: legacy })), "ok");
  assert.equal(code(validateProfile({ ...raw, company: "Muster AG" }, { country: "DE", stored: legacy })), "vatId:err.vatIdRequired");
  assert.equal(code(validateProfile(raw, { country: "DE", stored: { vatId: "DE123456789", company: "Muster GmbH" } })), "vatId:err.vatIdRequired");
  assert.equal(code(validateProfile(raw, { country: "DE" })), "vatId:err.vatIdRequired");
  const reg = validateRegistration({
    firstName: "Anna", lastName: "Muster", company: "Muster GmbH", country: "DE", vatId: "", phone: "+49 30 1234567",
    email: "anna@example.com", language: "de", type: "REAL_ESTATE", password: "correct-horse-battery", acceptAgreement: true,
  });
  assert.equal(reg.ok ? "ok" : reg.code, "err.vatIdRequired");
});

test("vat: vatIdMissing drives the profile prompt and the onboarding item", () => {
  assert.equal(vatIdMissing({ country: "DE", company: "Muster GmbH", vatId: null }), true);
  assert.equal(vatIdMissing({ country: "DE", company: "Muster GmbH", vatId: "DE123456789" }), false);
  assert.equal(vatIdMissing({ country: "DE", company: null, vatId: null }), false);
  assert.equal(vatIdMissing({ country: "GB", company: "Ltd", vatId: null }), false);
});

test("vat: office notice when the partner's own edit changes the VAT treatment (English, escaped)", () => {
  assert.equal(
    buildVatModeChangedNotice({ name: "Muster <GmbH> & Co", vatId: "DE123456789", before: "NONE", after: "REVERSE_CHARGE" }),
    "Partner Muster &lt;GmbH&gt; &amp; Co set VAT number DE123456789 — VAT treatment No VAT → Reverse charge. Check before the next payout.",
  );
  assert.match(buildVatModeChangedNotice({ name: "A", vatId: "CY12345678X", before: "NONE", after: "CY_VAT" }), /No VAT → CY VAT 19%/);
  assert.match(buildVatModeChangedNotice({ name: "A", vatId: null, before: "REVERSE_CHARGE", after: "NONE" }), /removed the VAT number — VAT treatment Reverse charge → No VAT/);
});
