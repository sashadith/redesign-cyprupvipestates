import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alreadyYoursAnswer, buildPartnerClientNotice, claimSubmissionJson, leadDataFromSubmission, leadMessage, parseBudgetField,
  partnerDisplayName, partnerSubmissionNote, rawFromForm,
} from "@/lib/partner/submitFlow";
import { validateSubmission, type SubmissionInput } from "@/lib/partner/submission";
import { effectiveRate, projectRates } from "@/lib/partner/scope";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const input = (patch: Partial<SubmissionInput> = {}): SubmissionInput => ({
  firstName: "Anna", lastName: "Meyer", email: "anna@example.com", phone: "+491701234567", language: "de",
  budgetMin: 300000, budgetMax: 450000, mode: "HANDOVER", projectIds: [P1], projectsText: null,
  contactMode: "DIRECT", repName: null, repPhone: null, comment: null, consent: true, ...patch,
});

// ─── parseBudgetField ────────────────────────────────────────────────────────

test("parseBudgetField strips thousands decoration and the euro sign", () => {
  assert.equal(parseBudgetField("250000"), 250000);
  assert.equal(parseBudgetField("250.000"), 250000);
  assert.equal(parseBudgetField("250,000 €"), 250000);
  assert.equal(parseBudgetField("€ 1 250 000"), 1250000);
  assert.equal(parseBudgetField("1 250 000"), 1250000);
  assert.equal(parseBudgetField("1'250'000"), 1250000);
});
test("parseBudgetField: empty is absent, anything else non-numeric is invalid", () => {
  assert.equal(parseBudgetField(""), null);
  assert.equal(parseBudgetField("   "), null);
  assert.equal(parseBudgetField(null), null);
  assert.equal(parseBudgetField("300k"), "invalid");
  assert.equal(parseBudgetField("-5000"), "invalid");
  assert.equal(parseBudgetField("1e6"), "invalid");
  assert.equal(parseBudgetField("about 300000"), "invalid");
  assert.equal(parseBudgetField("9".repeat(30)), "invalid");
});
test("parseBudgetField rejects decimals instead of multiplying them", () => {
  assert.equal(parseBudgetField("250,000.50"), "invalid");
  assert.equal(parseBudgetField("250.000,5"), "invalid");
  assert.equal(parseBudgetField("1.5"), "invalid");
});

// ─── rawFromForm ─────────────────────────────────────────────────────────────

test("rawFromForm converts budgets, projectIds and consent, and validates end to end", () => {
  const r = rawFromForm(fd([
    ["firstName", " Anna "], ["lastName", ""], ["email", "Anna@Example.com"], ["mode", "HANDOVER"],
    ["budgetMin", "300.000"], ["budgetMax", ""], ["projectIds", P1], ["projectIds", P2], ["contactMode", "DIRECT"],
    ["consent", "on"],
  ]));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.raw.budgetMin, 300000);
  assert.equal("budgetMax" in r.raw, false);
  assert.equal("lastName" in r.raw, false);
  assert.deepEqual(r.raw.projectIds, [P1, P2]);
  assert.equal(r.raw.consent, true);
  const v = validateSubmission(r.raw);
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.data.budgetMin, 300000);
    assert.equal(v.data.budgetMax, null);
    assert.equal(v.data.email, "anna@example.com");
  }
});
test("rawFromForm: unparsable budget names the field; missing consent is false", () => {
  assert.deepEqual(rawFromForm(fd([["budgetMax", "lots"]])), { ok: false, field: "budgetMax", code: "err.budget" });
  const r = rawFromForm(fd([["firstName", "A"]]));
  assert.ok(r.ok && r.raw.consent === false);
  // Unknown form fields (e.g. the search box) never reach the validator.
  const r2 = rawFromForm(fd([["firstName", "A"], ["evil", "x"], ["q", "lim"]]));
  assert.ok(r2.ok && !("evil" in r2.raw) && !("q" in r2.raw));
});

// ─── lead data ───────────────────────────────────────────────────────────────

test("leadMessage joins comment and projects, only the parts present", () => {
  assert.equal(leadMessage(null, [], null), null);
  assert.equal(leadMessage("Call after 6pm", [], null), "Call after 6pm");
  assert.equal(leadMessage(null, ["Aria", "Bay"], null), "Projects: Aria, Bay");
  assert.equal(leadMessage("Hi", ["Aria"], "sea view"), "Hi\n\nProjects: Aria, sea view");
  assert.equal(leadMessage("  ", [], " "), null);
});
test("leadDataFromSubmission maps to a PARTNER lead, unassigned, NEW", () => {
  const d = leadDataFromSubmission(
    input({ firstName: " Anna ", lastName: null, email: "Anna@Example.COM", mode: "FIX", contactMode: "VIA_CLIENT_REP", repName: "Bob", repPhone: "+357991234", comment: "Hi" }),
    { id: "partner-1" },
    ["Aria"],
  );
  assert.equal(d.source, "PARTNER");
  assert.equal(d.status, "NEW");
  assert.equal(d.assignedToId, null);
  assert.equal(d.firstName, "Anna");
  assert.equal(d.lastName, "");
  assert.equal(d.email, "anna@example.com");
  assert.equal(d.phone, "+491701234567");
  assert.equal(d.languagePreference, "de");
  assert.equal(d.budgetMin, 300000);
  assert.equal(d.budgetMax, 450000);
  assert.equal(d.partnerId, "partner-1");
  assert.equal(d.partnerMode, "FIX");
  assert.equal(d.contactMode, "VIA_CLIENT_REP");
  assert.equal(d.contactRepName, "Bob");
  assert.equal(d.contactRepPhone, "+357991234");
  assert.equal(d.message, "Hi\n\nProjects: Aria");
});
test("claimSubmissionJson keeps what the partner typed plus project names", () => {
  const j = claimSubmissionJson(input({ projectIds: [P1, P2], projectsText: "sea view" }), [{ id: P1, name: "Aria" }, { id: P2, name: "Bay" }]);
  assert.equal(j.firstName, "Anna");
  assert.deepEqual(j.projectIds, [P1, P2]);
  assert.deepEqual(j.projects, [{ id: P1, name: "Aria" }, { id: P2, name: "Bay" }]);
  assert.equal(j.projectsText, "sea view");
  assert.equal("consent" in j, false);
});
test("partner display name and SYSTEM note", () => {
  assert.equal(partnerDisplayName({ company: " Acme Realty ", firstName: "A", lastName: "B" }), "Acme Realty");
  assert.equal(partnerDisplayName({ company: null, firstName: "Ann", lastName: "Bee" }), "Ann Bee");
  assert.equal(partnerSubmissionNote({ company: "", firstName: "Ann", lastName: "Bee" }, "HANDOVER"), "Submitted by partner Ann Bee — Handover");
  assert.equal(partnerSubmissionNote({ company: "Acme", firstName: "A", lastName: "B" }, "FIX"), "Submitted by partner Acme — Fix");
});

// ─── office notice ───────────────────────────────────────────────────────────

test("buildPartnerClientNotice: CREATED links the lead, REVIEW points to the inbox", () => {
  const created = buildPartnerClientNotice({ clientName: "Anna Meyer", partnerName: "Acme", mode: "HANDOVER", outcome: "CREATED", leadId: "lead-1", baseUrl: "https://example.com/" });
  assert.equal(created, "Partner client: Anna Meyer from Acme (Handover) → https://example.com/crm/leads/lead-1");
  const review = buildPartnerClientNotice({ clientName: "Anna Meyer", partnerName: "Acme", mode: "FIX", outcome: "REVIEW" });
  assert.equal(review, "Partner client: Anna Meyer from Acme (Fix) → needs review in /crm/inbox");
  assert.doesNotMatch(review, /crm\/leads/);
});
test("buildPartnerClientNotice escapes HTML in every value", () => {
  const s = buildPartnerClientNotice({ clientName: "<b>Eve</b> & co", partnerName: "A\"<i>", mode: "HANDOVER", outcome: "REVIEW" });
  assert.doesNotMatch(s, /<b>|<i>/);
  assert.match(s, /&lt;b&gt;Eve&lt;\/b&gt; &amp; co/);
  assert.match(s, /A&quot;&lt;i&gt;/);
});

// ─── project rates (scope) ───────────────────────────────────────────────────

test("effectiveRate = our rate × share / 100, 2 decimals, null when missing", () => {
  assert.equal(effectiveRate(5, 30), 1.5);
  assert.equal(effectiveRate(5.55, 33.33), 1.85);
  assert.equal(effectiveRate(4, 50), 2);
  assert.equal(effectiveRate(null, 30), null);
});
test("projectRates resolves project over developer rate, hides our rate without trust mode, sorts by name", () => {
  const devs = [
    { id: "d2", name: "beta", town: "Paphos", slug: "beta", developerAccountId: "acc1" },
    { id: "d1", name: "Alpha", town: null, slug: null, developerAccountId: "acc1" },
    { id: "d3", name: "Gamma", town: "Limassol", slug: "gamma", developerAccountId: "acc2" },
  ];
  const rates = [
    { developerAccountId: "acc1", developmentId: null, ratePercent: 5 },
    { developerAccountId: "acc1", developmentId: "d2", ratePercent: 6 },
  ];
  const out = projectRates(devs, rates, { handoverShare: 30, fixShare: 50, trustMode: false });
  assert.deepEqual(out.map((p) => p.id), ["d1", "d2", "d3"]);
  assert.deepEqual(out.map((p) => [p.handoverRate, p.fixRate, p.ourRate]), [[1.5, 2.5, null], [1.8, 3, null], [null, null, null]]);
  const trusted = projectRates(devs, rates, { handoverShare: 30, fixShare: 50, trustMode: true });
  assert.deepEqual(trusted.map((p) => p.ourRate), [5, 6, null]);
});

// ─── ALREADY_YOURS must not be an enumeration oracle ─────────────────────────

test("alreadyYoursAnswer: only a full identifier match says ALREADY_YOURS", () => {
  const lead = { email: "anna.meyer@gmail.com", phone: "+49 170 1234567" };
  assert.equal(alreadyYoursAnswer({ email: "Anna.Meyer@gmail.com", phone: null }, lead), "ALREADY_YOURS");
  assert.equal(alreadyYoursAnswer({ email: null, phone: "+491701234567" }, lead), "ALREADY_YOURS");
  assert.equal(alreadyYoursAnswer({ email: "annameyer@googlemail.com", phone: "0049 170 1234567" }, lead), "ALREADY_YOURS");
});
test("alreadyYoursAnswer: email probe (unknown email + own client's phone) stays neutral", () => {
  const lead = { email: "anna@example.com", phone: "+491701234567" };
  assert.equal(alreadyYoursAnswer({ email: "probe@other.com", phone: "+491701234567" }, lead), "RECEIVED");
  // Lead without email: any typed email is a mismatch.
  assert.equal(alreadyYoursAnswer({ email: "probe@other.com", phone: "+491701234567" }, { email: null, phone: "+491701234567" }), "RECEIVED");
});
test("alreadyYoursAnswer: phone probe (own client's email + unknown phone) stays neutral", () => {
  const lead = { email: "anna@example.com", phone: "+491701234567" };
  assert.equal(alreadyYoursAnswer({ email: "anna@example.com", phone: "+357 99 000000" }, lead), "RECEIVED");
  assert.equal(alreadyYoursAnswer({ email: "anna@example.com", phone: "+357 99 000000" }, { email: "anna@example.com", phone: null }), "RECEIVED");
  assert.equal(alreadyYoursAnswer({ email: null, phone: null }, lead), "RECEIVED");
});
