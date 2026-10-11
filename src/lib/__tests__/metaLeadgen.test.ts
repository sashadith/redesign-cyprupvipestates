import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { mapFieldData, matchBudget, matchChannel, splitFullName, checkPhone, formLanguage, BUDGETS } from "@/lib/metaLeadgen/mapFields";
import { verifyMetaSignature } from "@/lib/metaLeadgen/signature";
import { buildLeadMessage } from "@/lib/metaLeadgen/notify";
import { isTokenErrorCode, parseSinceHours } from "@/lib/metaLeadgen/graph";

/* Meta Lead Ads → CRM (2026-10-11, docs/META-LEADGEN.md). The two live forms,
   "CVE PC Briefing DE v3" and "CVE PC Briefing EN v2", answer the same two
   custom questions in different languages and option orders. */

const DE = { budget: "welches_investitionsvolumen_planen_sie?", contact: "wie_möchten_sie_kontaktiert_werden?" };
const EN = { budget: "what_investment_volume_are_you_planning?", contact: "how_would_you_prefer_to_be_contacted?" };

const fd = (q: typeof DE, budget: string, contact: string, extra: Record<string, string> = {}) => [
  { name: "email", values: ["richard@manchesterdrinks.com"] },
  { name: "full_name", values: ["Richard Benjamin"] },
  { name: "phone_number", values: ["+447961182628"] },
  { name: q.budget, values: [budget] },
  { name: q.contact, values: [contact] },
  ...Object.entries(extra).map(([name, v]) => ({ name, values: [v] })),
];

test("budget: all four options, both languages, labels and Meta's slugged values", () => {
  const cases: [string, keyof typeof BUDGETS][] = [
    ["2 bis 3 Millionen Euro", "2-3"], ["3 bis 5 Millionen Euro", "3-5"], ["Über 5 Millionen Euro", "5+"], ["Unter 2 Millionen Euro", "<2"],
    ["€2 to 3 million", "2-3"], ["€3 to 5 million", "3-5"], ["Over €5 million", "5+"], ["Under €2 million", "<2"],
    ["2_bis_3_millionen_euro", "2-3"], ["über_5_millionen_euro", "5+"], ["under_€2_million", "<2"],
  ];
  for (const [v, want] of cases) assert.equal(matchBudget(v), want, v);
  assert.equal(matchBudget("Weiß ich noch nicht"), null);
});

test("budget → budgetMin/budgetMax exactly as specified", () => {
  assert.deepEqual([BUDGETS["2-3"].min, BUDGETS["2-3"].max], [2_000_000, 3_000_000]);
  assert.deepEqual([BUDGETS["3-5"].min, BUDGETS["3-5"].max], [3_000_000, 5_000_000]);
  assert.deepEqual([BUDGETS["5+"].min, BUDGETS["5+"].max], [5_000_000, null]);
  assert.deepEqual([BUDGETS["<2"].min, BUDGETS["<2"].max], [null, 2_000_000]);
});

test("contact preference: WhatsApp / Telefon / E-Mail / Phone call / Email", () => {
  assert.equal(matchChannel("WhatsApp"), "WHATSAPP");
  assert.equal(matchChannel("Telefon"), "PHONE");
  assert.equal(matchChannel("E-Mail"), "EMAIL");
  assert.equal(matchChannel("Phone call"), "PHONE");
  assert.equal(matchChannel("Email"), "EMAIL");
  assert.equal(matchChannel("phone_call"), "PHONE");
});

test("names: one word has no trailing space, extra spaces collapse", () => {
  assert.deepEqual(splitFullName("Richard Benjamin"), { firstName: "Richard", lastName: "Benjamin" });
  assert.deepEqual(splitFullName("  Schirazi "), { firstName: "Schirazi", lastName: "" });
  assert.deepEqual(splitFullName("Anna   Maria von Berg"), { firstName: "Anna", lastName: "Maria von Berg" });
  assert.deepEqual(splitFullName(""), { firstName: "", lastName: "" });
});

test("phone: country only when unambiguous; placeholder flagged, never dropped", () => {
  assert.deepEqual(checkPhone("+44 7961 182628"), { e164: "+447961182628", country: "GB", placeholderReason: null });
  const ph = checkPhone("+43699100000000");
  assert.equal(ph.e164, "+43699100000000");
  assert.ok(ph.placeholderReason);
  assert.equal(checkPhone("+491701234567").country, "DE");
  assert.equal(checkPhone("+41791234567").country, "CH");
  assert.equal(checkPhone("+15555555555").country, null);
  assert.ok(checkPhone("+49123").placeholderReason, "wrong length is flagged");
  assert.deepEqual(checkPhone(null), { e164: null, country: null, placeholderReason: null });
});

test("form language from the form name, Meta locale as fallback", () => {
  assert.equal(formLanguage("CVE PC Briefing DE v3"), "de");
  assert.equal(formLanguage("CVE PC Briefing EN v2"), "en");
  assert.equal(formLanguage("CVE PC Briefing DE"), "de");
  assert.equal(formLanguage("Kontakt", "de_DE"), "de");
  assert.equal(formLanguage("Kontakt", null), null);
});

test("mapFieldData: EN form, full mapping", () => {
  const m = mapFieldData(fd(EN, "€2 to 3 million", "WhatsApp"), "CVE PC Briefing EN v2");
  assert.equal(m.firstName, "Richard");
  assert.equal(m.lastName, "Benjamin");
  assert.equal(m.email, "richard@manchesterdrinks.com");
  assert.equal(m.phone, "+447961182628");
  assert.equal(m.countryOfResidence, "GB");
  assert.equal(m.languagePreference, "en");
  assert.equal(m.budget, "2-3");
  assert.equal(m.preferredChannel, "WHATSAPP");
  assert.deepEqual(m.unmatched, []);
  assert.equal(m.answers.length, 5);
});

test("mapFieldData: DE form, options in another order, unknown answer kept not guessed", () => {
  const m = mapFieldData(fd(DE, "Über 5 Millionen Euro", "Telefon", { zusatz: "Bitte nur abends" }), "CVE PC Briefing DE v3");
  assert.equal(m.languagePreference, "de");
  assert.equal(m.budgetMin, 5_000_000);
  assert.equal(m.budgetMax, null);
  assert.equal(m.preferredChannel, "PHONE");
  assert.deepEqual(m.unmatched, [{ name: "zusatz", value: "Bitte nur abends" }]);
});

test("signature: valid passes, tampered body / wrong secret / missing header fail", () => {
  const body = JSON.stringify({ object: "page", entry: [] });
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(verifyMetaSignature(body, sig, "s3cret"), true);
  assert.equal(verifyMetaSignature(body + " ", sig, "s3cret"), false);
  assert.equal(verifyMetaSignature(body, sig, "other"), false);
  assert.equal(verifyMetaSignature(body, null, "s3cret"), false);
  assert.equal(verifyMetaSignature(body, "sha256=abc", "s3cret"), false);
  assert.equal(verifyMetaSignature(body, sig, undefined), false);
});

test("token error codes: 190, 10, 200-299", () => {
  for (const c of [190, 10, 200, 299]) assert.equal(isTokenErrorCode(c), true, String(c));
  for (const c of [1, 2, 100, 4, 17, null]) assert.equal(isTokenErrorCode(c), false, String(c));
});

test("sinceHours: default 48, capped at 90 days, junk → default", () => {
  assert.equal(parseSinceHours(null), 48);
  assert.equal(parseSinceHours("168"), 168);
  assert.equal(parseSinceHours("99999"), 2160);
  assert.equal(parseSinceHours("abc"), 48);
  assert.equal(parseSinceHours("-5"), 48);
});

test("telegram text: new lead, below threshold, duplicate, placeholder", () => {
  const base = {
    outcome: "CREATED" as const, language: "en" as const, name: "Richard Benjamin", email: "richard@manchesterdrinks.com", phone: "+447961182628",
    budget: "2-3" as const, preferredChannel: "WHATSAPP" as const, campaignName: "UK Leads", formName: "CVE PC Briefing EN v2",
    placeholderReason: null, unmatchedCount: 0, leadId: "abc",
  };
  const t = buildLeadMessage(base);
  assert.match(t, /New Private Collection lead \(UK\)/);
  assert.match(t, /Budget: €2–3M · Prefers: WhatsApp/);
  assert.match(t, /Campaign: UK Leads · Form: CVE PC Briefing EN v2/);
  assert.match(t, /\/admin\/crm\/abc/);
  assert.doesNotMatch(t, /threshold/);
  assert.match(buildLeadMessage({ ...base, budget: "<2" }), /below Private Collection threshold/);
  assert.match(buildLeadMessage({ ...base, outcome: "ATTACHED", language: "de" }), /Existing lead submitted the form again \(DACH\)/);
  assert.match(buildLeadMessage({ ...base, placeholderReason: "x" }), /phone looks like a placeholder/);
  assert.match(buildLeadMessage({ ...base, name: "<b>x</b>" }), /&lt;b&gt;x/);
});
