import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewLead } from "@/lib/crm/newLeadForm";

test("a name plus email or phone is enough", () => {
  const r = validateNewLead({ firstName: "Markus", phone: "+49 171 555 1234" });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.data.phone, "+49 171 555 1234");
  assert.equal(r.ok && r.data.email, null);
});
test("a contact channel is required", () => {
  const r = validateNewLead({ firstName: "Markus" });
  assert.deepEqual(r, { ok: false, error: "Add an email or a phone number", field: "email" });
});
test("bad email, short phone and inverted budget are rejected", () => {
  assert.equal(validateNewLead({ firstName: "A", email: "nope" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", phone: "123" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", budgetMin: 500000, budgetMax: 300000 }).ok, false);
});
test("unknown fields and Hebrew are rejected", () => {
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", source: "PARTNER" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", languagePreference: "he" }).ok, false);
});
test("blank strings become null and text is trimmed", () => {
  const r = validateNewLead({ firstName: "  Olga ", lastName: " ", email: " o@x.ru " });
  assert.equal(r.ok && r.data.firstName, "Olga");
  assert.equal(r.ok && r.data.lastName, null);
  assert.equal(r.ok && r.data.email, "o@x.ru");
});
test("timeline, financing and owner follow the allowed values", () => {
  const ok = validateNewLead({ firstName: "A", email: "a@b.cy", timeline: "SIX_MONTHS", financing: "CASH", ownerId: "u1", budgetMin: 0, budgetMax: 0 });
  assert.equal(ok.ok && ok.data.timeline, "SIX_MONTHS");
  assert.equal(ok.ok && ok.data.ownerId, "u1");
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", timeline: "SOON" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", financing: "LOAN" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", budgetMin: 1.5 }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", email: "a@b.cy", timeline: "" }).ok, true);
  assert.equal(validateNewLead(null).ok, false);
});
test("phone rejects illegal characters and more than 20 digits", () => {
  assert.equal(validateNewLead({ firstName: "A", phone: "+49 171 abc 1234" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", phone: "123456789012345678901" }).ok, false);
  assert.equal(validateNewLead({ firstName: "A", phone: "12345678901234567890" }).ok, true);
});
