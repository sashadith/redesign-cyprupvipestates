import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubmission, SUBMISSION_ERROR_CODES } from "@/lib/partner/submission";
import { PARTNER_LOCALES, lookup, dict } from "@/lib/partner/i18n";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const ok = () => ({ firstName: " Anna ", lastName: "Meyer", email: "Anna@Example.com", mode: "HANDOVER", contactMode: "DIRECT", consent: true });
const bad = (patch: Record<string, unknown>, field: string, code?: string) => {
  const r = validateSubmission({ ...ok(), ...patch });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.field, field); if (code) assert.equal(r.code, code); }
};

test("valid minimal submission is normalised", () => {
  const r = validateSubmission(ok());
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.firstName, "Anna");
    assert.equal(r.data.email, "anna@example.com");
    assert.equal(r.data.phone, null);
    assert.deepEqual(r.data.projectIds, []);
    assert.equal(r.data.consent, true);
  }
});
test("non-objects and unknown keys", () => {
  assert.equal(validateSubmission(null).ok, false);
  assert.equal(validateSubmission([]).ok, false);
  bad({ evil: 1 }, "evil", "err.unknownField");
});
test("names", () => {
  bad({ firstName: "" }, "firstName");
  bad({ firstName: "x".repeat(81) }, "firstName");
  assert.ok(validateSubmission({ ...ok(), lastName: "שלום" }).ok);
  bad({ firstName: "A\nB" }, "firstName");
  bad({ lastName: "A\rB" }, "lastName");
  bad({ projectsText: "a\nb" }, "projectsText");
  bad({ phone: "123\n4567" }, "phone");
  bad({ contactMode: "VIA_PARTNER_REP", repName: "A\nB", repPhone: "+357 99 123456" }, "repName");
  assert.ok(validateSubmission({ ...ok(), comment: "a\nb" }).ok);
});
test("email or phone required", () => {
  bad({ email: undefined }, "email", "err.contactRequired");
  bad({ email: "nope" }, "email", "err.email");
  const r = validateSubmission({ ...ok(), email: undefined, phone: "+357 99 123456" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.phone, "+35799123456");
  bad({ phone: "123" }, "phone", "err.phone");
  bad({ phone: "1".repeat(41) }, "phone", "err.phone");
  bad({ phone: "1".repeat(21) }, "phone", "err.phone");
});
test("language", () => {
  assert.ok(validateSubmission({ ...ok(), language: "pl" }).ok);
  bad({ language: "he" }, "language", "err.language");
  bad({ language: "fr" }, "language", "err.language");
});
test("budget", () => {
  const r = validateSubmission({ ...ok(), budgetMin: 100000, budgetMax: 250000 });
  assert.ok(r.ok);
  assert.ok(validateSubmission({ ...ok(), budgetMin: 0, budgetMax: 100000000 }).ok);
  bad({ budgetMin: -1 }, "budgetMin", "err.budget");
  bad({ budgetMax: 100000001 }, "budgetMax", "err.budget");
  bad({ budgetMin: 1.5 }, "budgetMin", "err.budget");
  bad({ budgetMin: "5" }, "budgetMin", "err.budget");
  bad({ budgetMin: 300, budgetMax: 200 }, "budgetMax", "err.budget");
});
test("mode and projects", () => {
  bad({ mode: "X" }, "mode", "err.mode");
  assert.ok(validateSubmission({ ...ok(), projectIds: [U1, U2] }).ok);
  bad({ projectIds: [U1, U1] }, "projectIds", "err.projects");
  bad({ projectIds: ["nope"] }, "projectIds", "err.projects");
  bad({ projectIds: Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`) }, "projectIds", "err.projects");
  bad({ mode: "FIX", projectIds: [U1, U2] }, "projectIds", "err.fixOneProject");
  bad({ mode: "FIX" }, "projectIds", "err.fixOneProject");
  assert.ok(validateSubmission({ ...ok(), mode: "FIX", projectIds: [U1] }).ok);
  bad({ projectsText: "x".repeat(301) }, "projectsText", "err.projectsText");
});
test("contact mode", () => {
  bad({ contactMode: "X" }, "contactMode", "err.contactMode");
  bad({ contactMode: "VIA_PARTNER_REP" }, "repName", "err.rep");
  bad({ contactMode: "VIA_CLIENT_REP", repName: "Bob" }, "repPhone", "err.rep");
  bad({ contactMode: "VIA_CLIENT_REP", repName: "Bob", repPhone: "12" }, "repPhone", "err.rep");
  bad({ contactMode: "VIA_CLIENT_REP", repName: "x".repeat(81), repPhone: "+357 99 123456" }, "repName", "err.rep");
  const r = validateSubmission({ ...ok(), contactMode: "VIA_CLIENT_REP", repName: "Bob", repPhone: "+357 99 123456" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.repPhone, "+35799123456");
  const d = validateSubmission({ ...ok(), contactMode: "VIA_PARTNER", repName: "Bob", repPhone: "+357 99 123456" });
  assert.ok(d.ok);
  if (d.ok) assert.equal(d.data.repName, null);
});
test("comment and consent", () => {
  bad({ comment: "x".repeat(2001) }, "comment", "err.comment");
  bad({ consent: false }, "consent", "err.consent");
  bad({ consent: undefined }, "consent", "err.consent");
  bad({ consent: "true" }, "consent", "err.consent");
});
test("every error code exists in all locales; no Hebrew", () => {
  for (const l of PARTNER_LOCALES) {
    for (const c of SUBMISSION_ERROR_CODES) assert.ok(lookup(l, c), `${l} ${c}`);
    assert.doesNotMatch(JSON.stringify(dict(l)), /[֐-׿]/);
  }
});
