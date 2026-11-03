import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";
import { calculatePayouts, parsePriceInput } from "@/lib/partner/calculator";
import { onboardingSteps } from "@/lib/partner/onboarding";
import { averageResponse, formatResponse } from "@/lib/partner/responseAverage";
import { buildDigestEmail, digestContent, isoWeekKey } from "@/lib/partner/digest";

const proj = (o: Partial<Parameters<typeof calculatePayouts>[1][number]> = {}) => ({
  id: "p1", name: "Alpha", town: "Paphos", handoverRate: 1.5, fixRate: 2.5, ourRate: 5, ...o,
});

test("calculatePayouts rounds in basis points to whole euros", () => {
  // 1.85% of 62,750 = 1160.875 → 1161; exact half: 0.5% of 233 = 1.165→ 1; 1.5% of 77 = 1.155 → 1
  const [r] = calculatePayouts(62750, [proj({ handoverRate: 1.85, fixRate: 2 })], { trust: false });
  assert.equal(r.handover, 1161);
  assert.equal(r.fix, 1255);
  const [h] = calculatePayouts(1161, [proj({ handoverRate: 0.5, fixRate: null })], { trust: false });
  assert.equal(h.handover, 6); // 5.805
  const [half] = calculatePayouts(1000, [proj({ handoverRate: 0.0005 * 100 })], { trust: false });
  assert.equal(half.handover, 1); // 0.5 rounds up, not 0
  assert.equal(half.fix, 25);
});
test("calculatePayouts: missing rate stays null; ourRate only in trust mode", () => {
  const p = proj({ handoverRate: null, fixRate: null, ourRate: null });
  const [r] = calculatePayouts(500000, [p], { trust: true });
  assert.deepEqual([r.handover, r.fix, r.ourRate], [null, null, null]);
  assert.equal(calculatePayouts(500000, [proj()], { trust: true })[0].ourRate, 5);
  assert.equal(calculatePayouts(500000, [proj()], { trust: false })[0].ourRate, null);
  assert.equal(calculatePayouts(500000, [proj()], { trust: false })[0].handover, 7500);
});
test("parsePriceInput", () => {
  assert.equal(parsePriceInput("450000"), 450000);
  assert.equal(parsePriceInput("1.250.000 €"), 1250000);
  assert.equal(parsePriceInput("€ 1,250,000"), 1250000);
  assert.equal(parsePriceInput("900 000"), 900000);
  assert.equal(parsePriceInput("100000000"), 100000000);
  for (const bad of ["", "abc", "0", "100000001", "12a", "-5", "1e6"]) assert.equal(parsePriceInput(bad), null, bad);
});

test("onboardingSteps counts done items", () => {
  const none = onboardingSteps({ agreementAccepted: false, bankComplete: false, hasClient: false, emailVerified: false });
  assert.deepEqual([none.done, none.total, none.complete], [0, 4, false]);
  const two = onboardingSteps({ agreementAccepted: true, bankComplete: false, hasClient: false, emailVerified: true });
  assert.equal(two.done, 2);
  assert.deepEqual(two.steps.filter((s) => s.done).map((s) => s.key).sort(), ["agreementAccepted", "emailVerified"]);
  assert.equal(onboardingSteps({ agreementAccepted: true, bankComplete: true, hasClient: true, emailVerified: true }).complete, true);
  for (const l of PARTNER_LOCALES) for (const s of two.steps) assert.ok((dict(l).onboarding.steps as Record<string, string>)[s.key]);
});

test("averageResponse needs 5 samples and rounds", () => {
  assert.equal(averageResponse([10, 20, 30, 40]), null);
  assert.equal(averageResponse([10, 20, 30, 40, 51]), 30);
  assert.equal(averageResponse([1, 1, 1, 1, 2]), 1);
});
test("formatResponse: minutes under 120, else hours to 0.5", () => {
  const t = { minutes: "{n} min", hours: "{n} h" };
  assert.equal(formatResponse(45, t), "45 min");
  assert.equal(formatResponse(119, t), "119 min");
  assert.equal(formatResponse(120, t), "2 h");
  assert.equal(formatResponse(200, t), "3.5 h");
  assert.equal(formatResponse(200, t, "de"), "3,5 h");
});

test("isoWeekKey across the year boundary", () => {
  assert.equal(isoWeekKey(new Date("2026-10-19T08:00:00Z")), "2026-W43"); // Monday
  assert.equal(isoWeekKey(new Date("2026-12-28T10:00:00Z")), "2026-W53"); // 2026 has 53 weeks
  assert.equal(isoWeekKey(new Date("2027-01-03T10:00:00Z")), "2026-W53"); // Sunday
  assert.equal(isoWeekKey(new Date("2027-01-04T10:00:00Z")), "2027-W01");
  assert.equal(isoWeekKey(new Date("2027-01-01T10:00:00Z")), "2026-W53");
});
test("isoWeekKey uses Cyprus time: Sunday night UTC is already Monday in Cyprus", () => {
  // 2026-10-18 22:30 UTC = 2026-10-19 01:30 EEST (Mon) → W43, not W42
  assert.equal(isoWeekKey(new Date("2026-10-18T22:30:00Z")), "2026-W43");
  assert.equal(isoWeekKey(new Date("2026-10-18T20:30:00Z")), "2026-W42"); // 23:30 EEST Sunday
  // winter (UTC+2): 2027-01-03 22:30 UTC = Mon 2027-01-04 00:30 → 2027-W01
  assert.equal(isoWeekKey(new Date("2027-01-03T22:30:00Z")), "2027-W01");
});

const totals0 = { expected: 0, earned: 0, developerPaid: 0, paidOut: 0 };
const upd = (i: number, name = "Client " + i) => ({ clientName: name, key: "milestones.firstContact", at: new Date(Date.UTC(2026, 9, 15, 10, i)) });
const pub = (day: number) => new Date(Date.UTC(2026, 9, day, 9));
test("digestContent is null without news (totals alone are not news) and caps the lists", () => {
  assert.equal(digestContent({ updates: [], totals: totals0, newProjects: [] }), null);
  assert.equal(digestContent({ updates: [], totals: { ...totals0, expected: 1, paidOut: 500 }, newProjects: [] }), null);
  const withTotals = digestContent({ updates: [upd(1)], totals: { ...totals0, earned: 7 }, newProjects: [] })!;
  assert.equal(withTotals.totals.earned, 7); // still carried inside a mail that goes out
  const c = digestContent({
    updates: Array.from({ length: 14 }, (_, i) => upd(i)),
    totals: totals0,
    newProjects: Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, town: null, handoverRate: null, url: `https://x/${i}`, publishedAt: pub(10 + i) })),
  })!;
  assert.equal(c.updates.length, 10);
  assert.equal(c.newProjects.length, 5);
});
test("digestContent: new projects newest first, not by name", () => {
  const c = digestContent({
    updates: [],
    totals: totals0,
    newProjects: [
      { name: "Alpha", town: null, handoverRate: null, url: "https://x/a", publishedAt: pub(12) },
      { name: "Zeta", town: null, handoverRate: null, url: "https://x/z", publishedAt: pub(16) },
      { name: "Mid", town: null, handoverRate: null, url: "https://x/m", publishedAt: pub(14) },
    ],
  })!;
  assert.deepEqual(c.newProjects.map((p) => p.name), ["Zeta", "Mid", "Alpha"]);
});

test("buildDigestEmail: escapes, opt-out link, no internal fields, 4 locales", () => {
  const content = digestContent({
    updates: [upd(1, "<script>alert(1)</script>"), { ...upd(2), key: "milestones.dealEarned" }],
    totals: { expected: 12000, earned: 3000, developerPaid: 0, paidOut: 500 },
    newProjects: [{ name: "Sea <b>View</b>", town: "Limassol", handoverRate: 1.5, url: "https://cyprusvipestates.com/en/projects/sea", publishedAt: pub(15) }],
  })!;
  for (const l of PARTNER_LOCALES) {
    const m = buildDigestEmail(l, { partnerFirstName: "Anna", content, portalUrl: "https://partner.example/home", profileUrl: "https://partner.example/profile" });
    assert.ok(m.subject.length > 0);
    assert.ok(m.html.includes("&lt;script&gt;"), l);
    assert.ok(!m.html.includes("<script>"), l);
    assert.ok(!m.html.includes("<b>View"), l);
    assert.ok(m.text.includes("https://partner.example/profile") && m.html.includes("https://partner.example/profile"), l);
    assert.ok(m.text.includes("https://cyprusvipestates.com/en/projects/sea"), l);
    assert.doesNotMatch(m.text + m.html, /ourRate|ourCommission|leadId|undefined|\{\w+\}/, l);
  }
  const de = buildDigestEmail("de", { partnerFirstName: "Anna", content, portalUrl: "https://p/home", profileUrl: "https://p/profile" });
  assert.match(de.text, /Guten Tag Anna/);
  assert.match(de.text, /12\.000/);
  assert.match(de.text, /Ihr Satz: 1,5 %/); // rate in the partner's number format
  assert.match(buildDigestEmail("en", { partnerFirstName: "Anna", content, portalUrl: "https://p/home", profileUrl: "https://p/profile" }).text, /Your rate: 1\.5%/);
  // Stage names come from the commissions dictionary in every locale.
  for (const l of PARTNER_LOCALES) {
    const m = buildDigestEmail(l, { partnerFirstName: "Anna", content, portalUrl: "https://p/home", profileUrl: "https://p/profile" });
    const c = dict(l).commission;
    for (const s of [c.EXPECTED, c.EARNED, c.DEVELOPER_PAID, c.PAID_OUT]) assert.ok(m.text.includes(`• ${s}: `), `${l} ${s}`);
  }
  const nothingRate = digestContent({ updates: [], totals: totals0, newProjects: [{ name: "X", town: null, handoverRate: null, url: "https://u", publishedAt: pub(15) }] })!;
  assert.match(buildDigestEmail("en", { partnerFirstName: "", content: nothingRate, portalUrl: "https://p", profileUrl: "https://p/profile" }).text, /on request/);
});

test("new dictionary sections carry the programme facts in every locale", () => {
  for (const l of PARTNER_LOCALES) {
    const d = dict(l);
    assert.equal(Object.keys(d.materials.faq).length, 10);
    // FAQ q3 names the stages exactly as the commissions page does.
    for (const s of [d.commission.EXPECTED, d.commission.EARNED, d.commission.DEVELOPER_PAID, d.commission.PAID_OUT]) {
      assert.ok(d.materials.faq.q3.a.includes(s), `${l} q3 ${s}`);
    }
    // q2 must not reveal our rate through a formula.
    assert.doesNotMatch(d.materials.faq.q2.a, /our commission rate|unserem Provisionssatz|naszą stawkę|нашу ставку/i, l);
    assert.ok(d.landing.responseAvg.includes("{time}"));
  }
});
