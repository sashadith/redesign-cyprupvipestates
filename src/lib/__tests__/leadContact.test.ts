import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidLeadEmail, normalizeLeadEmail, phoneInvalidText, emailInvalidText } from "@/lib/leads/contactEmail";
import { isValidLeadPhone, isPossibleLeadPhone, e164LeadPhone } from "@/lib/leads/contactPhone";

test("phone: needs a country code and a complete number", () => {
  for (const ok of ["+357 99 278285", "+35799278285", "0035799278285", "+49 171 2345678", "+44 7911 123456", "+7 912 345-67-89", "+48 512 345 678"]) {
    assert.equal(isValidLeadPhone(ok), true, ok);
  }
  for (const bad of ["", "+357", "+357 99", "99278285", "0171 2345678", "+49", "+1 555", "+357 99 278285 999999", "abc", "+++", null, undefined]) {
    assert.equal(isValidLeadPhone(bad), false, String(bad));
  }
});
test("phone: the server's looser check still refuses a bare code or a missing +", () => {
  assert.equal(isPossibleLeadPhone("+357"), false);
  assert.equal(isPossibleLeadPhone("99278285"), false);
  assert.equal(isPossibleLeadPhone("+357 99 278285"), true);
  assert.equal(e164LeadPhone("00357 99-278-285"), "+35799278285");
  assert.equal(e164LeadPhone("+357"), null);
});
test("email: real addresses pass, typos and fragments do not", () => {
  for (const ok of ["anna@example.com", " Anna.Muster+cy@Sub.Example.co.uk ", "a_b-c@xn--mller-kva.de", "x@gmail.de"]) {
    assert.equal(isValidLeadEmail(ok), true, ok);
  }
  for (const bad of ["", "anna", "anna@", "@example.com", "anna@example", "anna@example.c", "anna@@example.com", "anna@example..com", ".anna@example.com", "anna.@example.com", "an na@example.com", "anna@-example.com", "anna@example.com.", "anna@example.123", null]) {
    assert.equal(isValidLeadEmail(bad), false, String(bad));
  }
  assert.equal(normalizeLeadEmail("  A@B.CO "), "a@b.co");
});
test("messages: four languages, Hebrew falls back to the form's own text", () => {
  assert.match(phoneInvalidText("en")!, /country code/);
  assert.match(phoneInvalidText("de")!, /Ländervorwahl/);
  assert.equal(phoneInvalidText("he"), null);
  assert.equal(emailInvalidText("he"), null);
  assert.match(emailInvalidText("xx")!, /valid email/);
});
