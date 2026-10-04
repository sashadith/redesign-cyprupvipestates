import { test } from "node:test";
import assert from "node:assert/strict";
import { emailKey, phoneDigits, phonesMatch, fullName, nameMatches } from "@/lib/crm/leadIdentity";

test("emailKey is Gmail-aware and null for empty input", () => {
  assert.equal(emailKey("John.Doe@GoogleMail.com"), "johndoe@gmail.com");
  assert.equal(emailKey("  Anna@Example.COM "), "anna@example.com");
  assert.equal(emailKey(""), null);
  assert.equal(emailKey(null), null);
});

test("phonesMatch ignores formatting and a missing country code, but not short numbers", () => {
  assert.equal(phoneDigits("+49 (151) 234-5678"), "491512345678");
  assert.equal(phonesMatch("+49 151 2345678", "0151/2345678"), true); // same last 8 digits
  assert.equal(phonesMatch("+49 151 2345678", "+49 151 2345679"), false);
  assert.equal(phonesMatch("12345", "12345"), false); // below MIN_PHONE_DIGITS
  assert.equal(phonesMatch("1234567", "1234567"), true); // exact, even below the suffix length
  assert.equal(phonesMatch("1234567", "91234567"), false); // one side too short for the suffix rule
  assert.equal(phonesMatch(null, "+357 99 123456"), false);
});

test("nameMatches is case/whitespace-insensitive and rejects empty confirmations", () => {
  assert.equal(fullName("  Jill ", "Bryan"), "Jill Bryan");
  assert.equal(nameMatches("jill  bryan", "Jill", "Bryan"), true);
  assert.equal(nameMatches("Jill", "Jill", "Bryan"), false);
  assert.equal(nameMatches("   ", "", ""), false);
  assert.equal(nameMatches("David", "David", ""), true);
});
