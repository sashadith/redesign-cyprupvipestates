import { test } from "node:test";
import assert from "node:assert/strict";
import { changedFields, changeSummary, validateLeadEdit, type LeadEditBefore } from "@/lib/crm/editLead";
import { contactToCheck } from "@/lib/crm/createLead";

const BEFORE: LeadEditBefore = {
  firstName: "Anna", lastName: "", email: "anna.m@gmail.com", phone: "+49 171 2345678", salutation: "MS",
  languagePreference: "de", budgetMin: 300000, budgetMax: 450000, timeline: null, financing: null,
  nationality: "Germany", countryOfResidence: null, message: null, notes: null,
};
const form = (over: Record<string, unknown> = {}) => ({
  firstName: "Anna", lastName: "", email: "anna.m@gmail.com", phone: "+49 171 2345678", salutation: "MS",
  languagePreference: "de", budgetMin: 300000, budgetMax: 450000, timeline: "", financing: "",
  nationality: "Germany", countryOfResidence: "", message: "", notes: "", ...over,
});

test("an unchanged form is valid and changes nothing", () => {
  const r = validateLeadEdit(form(), "de");
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && changedFields(BEFORE, r.data), []);
});

test("changed phone and budget are reported once each", () => {
  const r = validateLeadEdit(form({ phone: "+49 171 9999999", budgetMin: 350000, budgetMax: 500000 }), "de");
  assert.ok(r.ok);
  const f = changedFields(BEFORE, r.data);
  assert.deepEqual(f, ["phone", "budgetMin", "budgetMax"]);
  assert.equal(changeSummary(f), "Phone, Budget");
});

test("shares the new-lead rules: name and a contact channel are required", () => {
  assert.deepEqual(validateLeadEdit(form({ firstName: " " }), null), { ok: false, error: "First name is required.", field: "firstName" });
  assert.deepEqual(validateLeadEdit(form({ email: "", phone: "" }), null), { ok: false, error: "Add an email or a phone number", field: "email" });
  assert.equal(validateLeadEdit(form({ budgetMin: 500000, budgetMax: 1 }), null).ok, false);
});

test("the owner cannot be changed through the edit", () => {
  assert.deepEqual(validateLeadEdit(form({ ownerId: "x" }), null), { ok: false, error: "Unknown field: ownerId", field: "ownerId" });
});

test("a language the form no longer offers survives when left unchanged, but cannot be picked", () => {
  const kept = validateLeadEdit(form({ languagePreference: "he" }), "he");
  assert.equal(kept.ok && kept.data.languagePreference, "he");
  assert.equal(validateLeadEdit(form({ languagePreference: "he" }), "de").ok, false);
});

test("salutation, nationality and country are checked", () => {
  assert.equal(validateLeadEdit(form({ salutation: "DR" }), null).ok, false);
  assert.equal(validateLeadEdit(form({ nationality: "x".repeat(81) }), null).ok, false);
  const r = validateLeadEdit(form({ countryOfResidence: "  Cyprus " }), null);
  assert.equal(r.ok && r.data.countryOfResidence, "Cyprus");
});

test("duplicate check runs only on a contact that really changed", () => {
  const b = { email: "anna.m@gmail.com", phone: "+49 171 2345678" };
  assert.deepEqual(contactToCheck(b, { email: "Anna.M@googlemail.com", phone: "0049 171 2345678" }), { email: null, phone: null });
  assert.deepEqual(contactToCheck(b, { email: "anna@web.de", phone: "+49 171 2345678" }), { email: "anna@web.de", phone: null });
  assert.deepEqual(contactToCheck(b, { email: null, phone: "+357 99 123456" }), { email: null, phone: "+357 99 123456" });
});
