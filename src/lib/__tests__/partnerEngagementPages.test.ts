import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFICATION_KINDS, OPTED_OUT_ERROR, optOutGate } from "@/lib/partner/notify";
import { BROCHURE_CAP, brochureLang, brochureLinks, brochureRows } from "@/lib/partner/materials";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";
import { onboardingFactsFrom, onboardingHref, onboardingSteps, onboardingVisible } from "@/lib/partner/onboarding";
import { averageResponse, responseMinutesFrom } from "@/lib/partner/responseAverage";

test("optOutGate: STAGE and MESSAGE are dropped when notifications are off", () => {
  assert.equal(optOutGate("STAGE", false), OPTED_OUT_ERROR);
  assert.equal(optOutGate("MESSAGE", false), "opted out");
  assert.equal(optOutGate("STAGE", true), null);
  assert.equal(optOutGate("MESSAGE", true), null);
});
test("optOutGate: claim decisions and payouts always go out", () => {
  for (const on of [true, false]) {
    assert.equal(optOutGate("CLAIM_OUTCOME", on), null);
    assert.equal(optOutGate("PAYOUT", on), null);
  }
  // Every kind is covered by the decision above (a new kind must be classified on purpose).
  assert.deepEqual([...NOTIFICATION_KINDS].sort(), ["CLAIM_OUTCOME", "MATCH", "MESSAGE", "PAYOUT", "PRESENTATION_OPENED", "STAGE"]);
});

test("brochure links: main-site project pages only, en without prefix, slug encoded", () => {
  assert.deepEqual(brochureLinks("en", "sea-view"), { page: "https://cyprusvipestates.com/projects/sea-view" });
  assert.deepEqual(brochureLinks("de", "a b"), { page: "https://cyprusvipestates.com/de/projects/a%20b" });
  assert.equal(brochureLinks("pl", "x")!.page, "https://cyprusvipestates.com/pl/projects/x");
  assert.equal(brochureLinks("ru", "x")!.page, "https://cyprusvipestates.com/ru/projects/x");
  assert.equal(brochureLinks("en", null), null);
  assert.equal(brochureLinks("en", "  "), null);
});
test("brochure language falls back to en", () => {
  assert.equal(brochureLang("he"), "en");
  assert.equal(brochureLang("fr"), "en");
  assert.equal(brochureLang("ru"), "ru");
});
test("materials: no PDF link or PDF wording left in any locale", () => {
  for (const l of PARTNER_LOCALES) {
    const m = dict(l).materials as Record<string, unknown>;
    assert.ok(!("pdf" in m), l);
    assert.doesNotMatch(dict(l).materials.brochuresIntro, /PDF/i, l);
  }
  assert.ok(!("pdf" in brochureRows("en", [{ id: "a", name: "A", town: null, slug: "a" }])[0]));
});
test("brochureRows skips slugless projects, keeps order, caps", () => {
  const ps = Array.from({ length: 320 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, town: null, slug: i === 1 ? null : `s${i}` }));
  const rows = brochureRows("en", ps);
  assert.equal(rows.length, BROCHURE_CAP);
  assert.equal(rows[0].id, "p0");
  assert.equal(rows[1].id, "p2");
  assert.ok(!("slug" in rows[0]));
});

test("onboarding facts mapper + links", () => {
  const f = onboardingFactsFrom({ status: "ACTIVE", hasAcceptance: true, bankComplete: false, hasClaim: false });
  assert.deepEqual(f, { emailVerified: true, agreementAccepted: true, bankComplete: false, hasClient: false });
  const o = onboardingSteps(f);
  assert.equal(o.done, 2);
  assert.equal(o.total, 4);
  assert.equal(o.complete, false);
  assert.equal(onboardingSteps(onboardingFactsFrom({ status: "ACTIVE", hasAcceptance: true, bankComplete: true, hasClaim: true })).complete, true);
  assert.equal(onboardingFactsFrom({ status: "PENDING", hasAcceptance: false, bankComplete: false, hasClaim: false }).emailVerified, false);
  assert.equal(onboardingHref("bankComplete"), "/profile#bank");
  assert.equal(onboardingHref("agreementAccepted"), "/agreement");
  assert.equal(onboardingHref("hasClient"), "/submit");
  assert.equal(onboardingHref("emailVerified"), null);
});

test("responseMinutesFrom: minutes per claim with a later first outbound contact", () => {
  const t0 = new Date("2026-10-01T10:00:00Z");
  const claims = [
    { leadId: "a", createdAt: t0 },
    { leadId: "b", createdAt: t0 },
    { leadId: "c", createdAt: t0 },
  ];
  const map = new Map([
    ["a", new Date("2026-10-01T10:30:00Z")],
    ["c", new Date("2026-10-01T09:00:00Z")], // before the claim: ignored
  ]);
  assert.deepEqual(responseMinutesFrom(claims, map), [30]);
  const five = Array.from({ length: 5 }, (_, i) => ({ leadId: `l${i}`, createdAt: t0 }));
  const m5 = new Map(five.map((c, i) => [c.leadId, new Date(t0.getTime() + (i + 1) * 60_000 * 10)]));
  assert.equal(averageResponse(responseMinutesFrom(five, m5)), 30);
  assert.equal(averageResponse(responseMinutesFrom(five.slice(0, 4), m5)), null);
});

test("onboarding: VAT-number item only for EU companies, stays visible despite Hide until set", () => {
  const base = { status: "ACTIVE", hasAcceptance: true, bankComplete: true, hasClaim: true };
  const none = onboardingSteps(onboardingFactsFrom({ ...base, vat: { required: false, set: false } }));
  assert.equal(none.total, 4);
  assert.equal(none.complete, true);
  const missing = onboardingSteps(onboardingFactsFrom({ ...base, vat: { required: true, set: false } }));
  assert.deepEqual([missing.total, missing.done, missing.complete], [5, 4, false]);
  assert.equal(onboardingHref("vatId"), "/profile");
  assert.equal(onboardingVisible(missing, true), true); // Hide does not hide a missing VAT number
  assert.equal(onboardingVisible(missing, false), true);
  const set = onboardingSteps(onboardingFactsFrom({ ...base, vat: { required: true, set: true } }));
  assert.equal(set.complete, true);
  assert.equal(onboardingVisible(set, false), false);
  const open = onboardingSteps(onboardingFactsFrom({ ...base, hasClaim: false }));
  assert.equal(onboardingVisible(open, true), false);
  assert.equal(onboardingVisible(open, false), true);
  for (const l of PARTNER_LOCALES) {
    assert.ok(dict(l).onboarding.steps.vatId.trim(), l);
    assert.ok(dict(l).profile.vatMissing.trim(), l);
  }
});

test("MATCH and PRESENTATION_OPENED rows have their own builders, never another kind's template", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/partner/notifySend.ts"), "utf8");
  assert.ok(!src.includes("not implemented yet"), "no kind is skipped as not implemented any more");
  assert.ok(src.includes("buildMatchEmail(locale, {"), "MATCH uses the match builder");
  assert.ok(src.includes("buildPresentationOpenedEmail(locale, {"), "PRESENTATION_OPENED uses its own builder");
});
