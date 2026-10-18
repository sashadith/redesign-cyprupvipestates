import { test } from "node:test";
import assert from "node:assert/strict";
import { PartnerType } from "@prisma/client";
import { validateRegistration, REGISTRATION_ERROR_CODES } from "@/lib/partner/registration";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

const good = {
  firstName: " Anna ", lastName: "Meier", company: "Meier GmbH", country: "DE",
  phone: "+49 170 1234567", email: " Anna@Example.COM ", language: "de",
  type: "REAL_ESTATE", password: "a-long-password", acceptAgreement: true,
};
const bad = (patch: Record<string, unknown>) => validateRegistration({ ...good, ...patch });
const code = (r: ReturnType<typeof validateRegistration>) => (r.ok ? "ok" : `${r.field}:${r.code}`);

test("registration: happy path normalises", () => {
  const r = validateRegistration(good);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.email, "anna@example.com");
    assert.equal(r.data.firstName, "Anna");
    assert.equal(r.data.phone, "+491701234567");
    assert.equal(r.data.type, "REAL_ESTATE");
  }
  assert.ok(validateRegistration({ ...good, company: undefined }).ok);
  const r2 = validateRegistration({ ...good, company: "" });
  assert.ok(r2.ok && r2.data.company === null);
});
test("registration: each failure code", () => {
  assert.equal(code(validateRegistration(null)), "_:err.invalid");
  assert.equal(code(validateRegistration([])), "_:err.invalid");
  assert.equal(code(bad({ firstName: " " })), "firstName:err.firstName");
  assert.equal(code(bad({ lastName: 5 })), "lastName:err.lastName");
  assert.equal(code(bad({ company: "x".repeat(121) })), "company:err.company");
  assert.equal(code(bad({ country: "de" })), "country:err.country");
  assert.equal(code(bad({ country: "DEU" })), "country:err.country");
  assert.equal(code(bad({ phone: "12345" })), "phone:err.phone");
  assert.equal(code(bad({ phone: "call me" })), "phone:err.phone");
  assert.equal(code(bad({ phone: "1".repeat(21) })), "phone:err.phone");
  assert.equal(code(bad({ email: "nope" })), "email:err.email");
  assert.equal(code(bad({ email: "a b@c.com" })), "email:err.email");
  assert.equal(code(bad({ language: "fr" })), "language:err.language");
  assert.equal(code(bad({ type: "WIZARD" })), "type:err.type");
  assert.equal(code(bad({ password: "short" })), "password:err.passwordShort");
  assert.equal(code(bad({ password: "a".repeat(201) })), "password:err.passwordLong");
  assert.equal(code(bad({ password: "1234567890" })), "password:err.passwordDigits");
  assert.equal(code(bad({ acceptAgreement: false })), "acceptAgreement:err.agreement");
  assert.equal(code(bad({ acceptAgreement: "true" })), "acceptAgreement:err.agreement");
});
test("registration: unknown keys and Hebrew rejected", () => {
  assert.equal(code(bad({ role: "admin" })), "role:err.unknownField");
  assert.equal(code(bad({ language: "he" })), "language:err.language");
  assert.equal(code(bad({ firstName: "דוד" })), "firstName:err.firstName");
});
test("registration: every returnable code resolves in every locale", () => {
  const samples = [
    null, { ...good, role: 1 }, { ...good, firstName: "" }, { ...good, lastName: "" }, { ...good, company: "x".repeat(200) },
    { ...good, country: "x" }, { ...good, phone: "1" }, { ...good, email: "x" }, { ...good, language: "he" },
    { ...good, type: "x" }, { ...good, password: "x" }, { ...good, password: "x".repeat(201) },
    { ...good, password: "1234567890" }, { ...good, acceptAgreement: false },
  ];
  const seen = new Set<string>();
  for (const s of samples) { const r = validateRegistration(s); assert.ok(!r.ok); if (!r.ok) seen.add(r.code); }
  assert.deepEqual(Array.from(seen).sort(), [...REGISTRATION_ERROR_CODES].sort());
  for (const c of [...REGISTRATION_ERROR_CODES, "err.rateLimited", "err.generic"])
    for (const l of PARTNER_LOCALES) assert.ok((lookup(l, c) ?? "").length > 0, `${l} ${c}`);
});
test("registration: PartnerType list in sync with prisma", () => {
  for (const t of Object.values(PartnerType)) assert.ok(validateRegistration({ ...good, type: t }).ok, t);
});
