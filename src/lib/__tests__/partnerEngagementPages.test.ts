import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFICATION_KINDS, OPTED_OUT_ERROR, optOutGate } from "@/lib/partner/notify";
import { BROCHURE_CAP, brochureLinks, brochurePdfLang, brochureRows } from "@/lib/partner/materials";
import { onboardingFactsFrom, onboardingHref, onboardingSteps } from "@/lib/partner/onboarding";
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
  assert.deepEqual([...NOTIFICATION_KINDS].sort(), ["CLAIM_OUTCOME", "MESSAGE", "PAYOUT", "STAGE"]);
});

test("brochure links: main-site URLs, en without prefix, slug encoded", () => {
  assert.deepEqual(brochureLinks("en", "sea-view"), {
    page: "https://cyprusvipestates.com/projects/sea-view",
    pdf: "https://cyprusvipestates.com/api/projects/en/sea-view/pdf",
  });
  assert.deepEqual(brochureLinks("de", "a b"), {
    page: "https://cyprusvipestates.com/de/projects/a%20b",
    pdf: "https://cyprusvipestates.com/api/projects/de/a%20b/pdf",
  });
  assert.equal(brochureLinks("pl", "x")!.pdf, "https://cyprusvipestates.com/api/projects/pl/x/pdf");
  assert.equal(brochureLinks("ru", "x")!.page, "https://cyprusvipestates.com/ru/projects/x");
  assert.equal(brochureLinks("en", null), null);
  assert.equal(brochureLinks("en", "  "), null);
});
test("brochure PDF language falls back to en", () => {
  assert.equal(brochurePdfLang("he"), "en");
  assert.equal(brochurePdfLang("fr"), "en");
  assert.equal(brochurePdfLang("ru"), "ru");
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
