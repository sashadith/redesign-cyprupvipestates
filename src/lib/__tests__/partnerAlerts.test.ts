import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALERT_MAX_PROJECTS, alertsStartFromEnv, cyDate, planBankMissing, planProjectNews, planProtectionReminders, planQuietClients, planTierNear,
  planWatch, protectionEnd, readNewsPayload, readWatchPayload, watchChangeOf, type WatchEvent,
} from "@/lib/partner/alerts";
import {
  PARTNER_ONLY_KINDS, buildBankMissingEmail, buildClientQuietEmail, buildProjectNewsEmail, buildProtectionEndingEmail, buildStageEmail, buildTierNearEmail,
  buildWatchEmail, notificationGate, switchGate, watchChangeLabels,
} from "@/lib/partner/notify";
import { TELEGRAM_MAX_CHARS, buildTelegramNotification } from "@/lib/partner/telegram";
import { buildDigestTelegram, digestChannels, DIGEST_TELEGRAM_MAX } from "@/lib/partner/digest";
import { buildApprovedEmail } from "@/lib/partner/mail";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";
import { isOwnProjectUrl } from "@/lib/partner/matchGlue";

const DAY = 86_400_000;
const NOW = new Date("2026-11-02T05:30:00Z");
const src = (p: string) => readFileSync(p, "utf8");

// ── Planners ────────────────────────────────────────────────────────────────

test("project news: one row per partner and day, newest first, capped, with the partner's own rate", () => {
  const projects = Array.from({ length: 7 }, (_, i) => ({
    id: `d${i}`, name: `P${i}`, area: "Paphos", priceFrom: 300_000 + i, url: `https://cyprusvipestates.com/projects/p${i}`,
    publishedAt: new Date(NOW.getTime() - i * 3_600_000),
  }));
  const rows = planProjectNews({
    partners: [{ id: "a", rates: new Map([["d0", 1.5]]) }, { id: "b", rates: new Map() }],
    projects, today: cyDate(NOW),
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].refKey, "news:a:2026-11-02");
  const list = rows[0].payload.projects as { name: string; rate: number | null }[];
  assert.equal(list.length, ALERT_MAX_PROJECTS);
  assert.equal(list[0].name, "P0");
  assert.equal(list[0].rate, 1.5);
  assert.equal((rows[1].payload.projects as { rate: number | null }[])[0].rate, null);
  assert.deepEqual(planProjectNews({ partners: [{ id: "a", rates: new Map() }], projects: [], today: "x" }), []);
});

test("watch: decreases only, low stock crosses into 1..3, only the partner's own presentation projects", () => {
  const ev = (o: Partial<WatchEvent> & { type: string }): WatchEvent => ({ developmentId: "d1", name: "Sea", url: "https://cyprusvipestates.com/projects/sea", ...o });
  assert.deepEqual(watchChangeOf(ev({ type: "price_from_changed", from: 300, to: 280 })), { type: "price_from_changed" });
  assert.equal(watchChangeOf(ev({ type: "price_from_changed", from: 280, to: 300 })), null);
  assert.equal(watchChangeOf(ev({ type: "unit_price_changed", units: [{ from: 100, to: 120 }] })), null);
  assert.deepEqual(watchChangeOf(ev({ type: "unit_price_changed", units: [{ from: 100, to: 120 }, { from: 100, to: 90 }] })), { type: "unit_price_changed" });
  assert.deepEqual(watchChangeOf(ev({ type: "availability_changed", from: 5, to: 2 })), { type: "low_stock", n: 2 });
  assert.equal(watchChangeOf(ev({ type: "availability_changed", from: 3, to: 2 })), null, "already low: told before");
  assert.equal(watchChangeOf(ev({ type: "availability_changed", from: 5, to: 0 })), null, "sold out is not 'almost'");
  assert.equal(watchChangeOf(ev({ type: "sold_out" })), null);

  const rows = planWatch({
    watched: new Map([["a", new Set(["d1"])], ["b", new Set(["d2"])]]),
    events: [
      ev({ type: "unit_price_changed", units: [{ from: 100, to: 90 }] }),
      ev({ type: "price_from_changed", from: 300, to: 280 }),
      ev({ type: "availability_changed", from: 6, to: 3 }),
      ev({ type: "new_units", url: null }),
    ],
    priceFrom: new Map([["d1", 280]]),
    today: "2026-11-02",
  });
  assert.equal(rows.length, 1, "partner b watches nothing that changed");
  assert.equal(rows[0].refKey, "watch:a:2026-11-02");
  const [p] = rows[0].payload.projects as { changes: { type: string }[]; priceFrom: number }[];
  assert.deepEqual(p.changes.map((c) => c.type), ["price_from_changed", "low_stock"], "unit price folds into price from; no URL → dropped");
  assert.equal(p.priceFrom, 280);
});

test("protection reminders: 30 then 7 days, keyed by the end date, nothing after the end", () => {
  const claim = (days: number) => ({ claimId: "c", partnerId: "p", leadId: "l", protectedUntil: new Date(NOW.getTime() + days * DAY) });
  assert.deepEqual(planProtectionReminders({ claims: [claim(40)], now: NOW }), []);
  const [r30] = planProtectionReminders({ claims: [claim(25)], now: NOW });
  assert.match(r30.refKey, /^protect:c:30:\d{4}-\d{2}-\d{2}$/);
  const [r7] = planProtectionReminders({ claims: [claim(5)], now: NOW });
  assert.match(r7.refKey, /^protect:c:7:/);
  assert.deepEqual(planProtectionReminders({ claims: [claim(-1)], now: NOW }), []);
  // The end moves with a real contact (6 months from the later of activeSince and the contact).
  const since = new Date("2026-05-01T10:00:00Z");
  assert.equal(protectionEnd(since, null).toISOString(), "2026-11-01T10:00:00.000Z");
  assert.equal(protectionEnd(since, new Date("2026-06-01T10:00:00Z")).toISOString(), "2026-12-01T10:00:00.000Z");
});

test("quiet clients: after 14 days, once per quiet stretch", () => {
  const c = (daysAgo: number) => ({ claimId: "c", partnerId: "p", leadId: "l", lastActivityAt: new Date(NOW.getTime() - daysAgo * DAY) });
  assert.deepEqual(planQuietClients({ claims: [c(13)], now: NOW }), []);
  const [r] = planQuietClients({ claims: [c(14)], now: NOW });
  assert.equal(r.refKey, `quiet:c:${cyDate(c(14).lastActivityAt)}`);
  assert.equal(planQuietClients({ claims: [c(20)], now: NOW })[0].refKey, planQuietClients({ claims: [c(20)], now: new Date(NOW.getTime() + DAY) })[0].refKey);
});

test("bank missing: created, then devpaid once the developer paid (never both in one run)", () => {
  const base = { dealId: "d", partnerId: "p", leadId: "l", claimId: "c" };
  assert.deepEqual(planBankMissing({ deals: [{ ...base, developerPaid: false }] }).map((r) => r.refKey), ["bank:d:created"]);
  assert.deepEqual(planBankMissing({ deals: [{ ...base, developerPaid: true }] }).map((r) => r.refKey), ["bank:d:devpaid"]);
});

test("tier near: only with a next tier one deal away; once per tier", () => {
  const rows = planTierNear({ partners: [{ id: "a", next: { key: "gold", name: "Gold", handoverShare: 35, fixShare: 55 } }, { id: "b", next: null }] });
  assert.deepEqual(rows.map((r) => r.refKey), ["tiernear:a:gold"]);
});

test("payload readers drop foreign links and unknown change types", () => {
  const ok = "https://cyprusvipestates.com/projects/a";
  assert.deepEqual(readNewsPayload({ projects: [{ name: "A", url: ok, priceFrom: 0, rate: 1.5 }, { name: "B", url: "https://evil.example/x" }] }, isOwnProjectUrl),
    [{ name: "A", area: null, priceFrom: null, url: ok, rate: 1.5 }]);
  assert.deepEqual(readWatchPayload({ projects: [{ name: "A", url: ok, changes: [{ type: "low_stock", n: 2 }, { type: "nope" }] }, { name: "C", url: ok, changes: [] }] }, isOwnProjectUrl),
    [{ name: "A", url: ok, priceFrom: null, changes: [{ type: "low_stock", n: 2 }] }]);
  assert.deepEqual(readNewsPayload(null, isOwnProjectUrl), []);
});

test("PARTNER_ALERTS_START gate", () => {
  assert.equal(alertsStartFromEnv({}), null);
  assert.equal(alertsStartFromEnv({ PARTNER_ALERTS_START: "soon" }), null);
  assert.equal(alertsStartFromEnv({ PARTNER_ALERTS_START: "2026-11-02T00:00:00Z" })?.toISOString(), "2026-11-02T00:00:00.000Z");
});

// ── Gates ───────────────────────────────────────────────────────────────────

test("switches: market alerts and reminders gate only their own kinds", () => {
  const off = { marketAlerts: false, reminders: false };
  for (const k of ["PROJECT_NEWS", "WATCH", "PROTECTION_ENDING", "CLIENT_QUIET"] as const) assert.equal(switchGate(k, off), "switched off");
  for (const k of ["STAGE", "BANK_MISSING", "TIER_NEAR", "PAYOUT"] as const) assert.equal(switchGate(k, off), null);
  assert.equal(switchGate("WATCH", { marketAlerts: true, reminders: false }), null);
  assert.equal(switchGate("CLIENT_QUIET", { marketAlerts: false, reminders: true }), null);
});

test("claim gate: partner-wide kinds need no claim; bank rows need the partner's own claim; reminders need an ACTIVE claim", () => {
  for (const kind of ["PROJECT_NEWS", "WATCH", "TIER_NEAR"] as const) {
    assert.ok(PARTNER_ONLY_KINDS.includes(kind));
    assert.equal(notificationGate({ kind, accepted: false, claim: null }), null);
  }
  assert.equal(notificationGate({ kind: "BANK_MISSING", accepted: false, claim: { ownedByPartner: true, effective: "EXPIRED" } }), null);
  assert.equal(notificationGate({ kind: "BANK_MISSING", accepted: false, claim: { ownedByPartner: false, effective: "ACTIVE" } }), "claim missing");
  assert.equal(notificationGate({ kind: "PROTECTION_ENDING", accepted: false, claim: { ownedByPartner: true, effective: "EXPIRED" } }), "protection ended");
  assert.equal(notificationGate({ kind: "CLIENT_QUIET", accepted: false, claim: { ownedByPartner: true, effective: "ACTIVE" } }), null);
});

// ── Texts ───────────────────────────────────────────────────────────────────

test("every v2 text exists in every partner language", () => {
  const notifyKeys = ["viewingOn", "expectedCommission", "projectNews", "projectRate", "watch", "unitsLeft", "protectionEnding", "protectionNote", "clientQuiet",
    "clientQuietNote", "bankMissing", "bankMissingDevPaid", "addBank", "tierNear", "digestTitle", "openProjects"] as const;
  for (const l of PARTNER_LOCALES) {
    const d = dict(l);
    for (const k of notifyKeys) assert.ok(d.telegram.notify[k]?.trim(), `${l} telegram.notify.${k}`);
    assert.ok(d.telegram.changeTypes.low_stock?.trim(), `${l} low_stock`);
    for (const k of ["marketAlerts", "marketAlertsHint", "reminders", "remindersHint"] as const) assert.ok(d.profileSettings[k]?.trim(), `${l} ${k}`);
    for (const k of ["projectNews", "watch", "protectionEnding", "clientQuiet", "bankMissing", "tierNear"] as const) assert.ok(d.mail[k].subject.trim(), `${l} mail.${k}`);
    assert.ok(d.mail.approved.nextStep.includes("{url}"), `${l} approved.nextStep`);
  }
});

test("telegram v2 notifications: escaped, linked, within the limit", () => {
  const base = { url: "https://partner.cyprusvipestates.com/clients/c1", portalUrl: "https://partner.cyprusvipestates.com" };
  for (const l of PARTNER_LOCALES) {
    const many = Array.from({ length: 5 }, (_, i) => ({ name: `<b>P${i}</b>`, area: "Paphos", detail: "x".repeat(150), url: `https://cyprusvipestates.com/projects/p${i}?${"a".repeat(150)}` }));
    for (const kind of ["PROJECT_NEWS", "WATCH"] as const) {
      const h = buildTelegramNotification(l, { kind, ...base, projects: many });
      assert.ok(h.length <= TELEGRAM_MAX_CHARS, `${l} ${kind} ${h.length}`);
      assert.ok(!h.includes("<b>P0</b>"), "names escaped");
      assert.ok(h.includes("&lt;b&gt;P0"), "first project kept");
    }
    const prot = buildTelegramNotification(l, { kind: "PROTECTION_ENDING", ...base, clientName: "Anna <x>", date: "2 December 2026" });
    assert.ok(prot.includes("Anna &lt;x&gt;") && prot.includes("2 December 2026"));
    assert.ok(buildTelegramNotification(l, { kind: "CLIENT_QUIET", ...base, clientName: "Anna" }).includes("Anna"));
    const bank = buildTelegramNotification(l, { kind: "BANK_MISSING", ...base, clientName: "Anna", developerPaid: true, url: "https://partner.cyprusvipestates.com/profile#bank" });
    assert.ok(bank.includes(dict(l).telegram.notify.addBank) && bank.includes("/profile#bank"));
    assert.ok(buildTelegramNotification(l, { kind: "TIER_NEAR", ...base, tierName: "Gold" }).includes("Gold"));
    const stage = buildTelegramNotification(l, { kind: "STAGE", ...base, clientName: "Anna", stageKey: "stages.viewing", extra: ["Viewing on 5 November 2026"] });
    assert.ok(stage.includes("Viewing on 5 November 2026"));
  }
});

test("e-mail v2 builders: subject, link and the client name", () => {
  const common = { partnerFirstName: "Eva", clientName: "Anna", link: "https://partner.cyprusvipestates.com/clients/c1" };
  const ok = "https://cyprusvipestates.com/projects/sea";
  assert.ok(buildProjectNewsEmail("en", { partnerFirstName: "Eva", link: "https://p/projects", projects: [{ name: "Sea", area: "Paphos", priceFrom: 300000, url: ok, rate: 1.5 }] }).text.includes(ok));
  assert.ok(buildWatchEmail("de", { partnerFirstName: "Eva", link: "https://p/presentations", projects: [{ name: "Sea", url: ok, priceFrom: null, changes: [{ type: "low_stock", n: 2 }] }] }).text.includes("nur noch 2 frei"));
  assert.ok(buildProtectionEndingEmail("en", { ...common, until: new Date("2026-12-02T10:00:00Z") }).subject.includes("Anna"));
  assert.ok(buildClientQuietEmail("pl", common).subject.includes("Anna"));
  assert.notEqual(buildBankMissingEmail("ru", { ...common, developerPaid: true }).text, buildBankMissingEmail("ru", { ...common, developerPaid: false }).text);
  assert.ok(buildTierNearEmail("en", { partnerFirstName: "Eva", tierName: "Gold", handoverShare: 35, fixShare: 55, portalUrl: "https://p" }).subject.includes("Gold"));
  assert.ok(buildStageEmail("en", { ...common, stageKey: "stages.reserved", extra: ["Your expected commission: €4,500"] }).text.includes("€4,500"));
  assert.equal(watchChangeLabels("en", [{ type: "price_from_changed" }, { type: "low_stock", n: 1 }]), "price reduced · only 1 left");
  const approved = buildApprovedEmail("en", "Eva", "https://p/login", undefined, "https://p/submit");
  assert.ok(approved.text.includes("https://p/submit") && approved.text.includes("Telegram"));
  assert.ok(!buildApprovedEmail("en", "Eva", "https://p/login").text.includes("/submit"), "no submit line without the link");
});

test("weekly summary: follows the channel, Telegram text fits and is escaped", () => {
  assert.deepEqual(digestChannels({ notifyChannel: "EMAIL", chatLinked: true, botConfigured: true, hasEmail: true }), { email: true, telegram: false });
  assert.deepEqual(digestChannels({ notifyChannel: "TELEGRAM", chatLinked: true, botConfigured: true, hasEmail: true }), { email: false, telegram: true });
  assert.deepEqual(digestChannels({ notifyChannel: "BOTH", chatLinked: true, botConfigured: true, hasEmail: true }), { email: true, telegram: true });
  assert.deepEqual(digestChannels({ notifyChannel: "TELEGRAM", chatLinked: false, botConfigured: true, hasEmail: true }), { email: true, telegram: false }, "unlinked → e-mail");
  assert.deepEqual(digestChannels({ notifyChannel: "TELEGRAM", chatLinked: true, botConfigured: true, hasEmail: false }), { email: false, telegram: true });
  const content = {
    updates: Array.from({ length: 10 }, (_, i) => ({ clientName: `<i>C${i}</i> ${"n".repeat(300)}`, key: "stages.viewing", at: NOW })),
    totals: { expected: 1000, earned: 0, developerPaid: 0, paidOut: 0 },
    newProjects: [{ name: "Sea & Sun", town: "Paphos", handoverRate: 1.5, url: "https://cyprusvipestates.com/projects/sea", publishedAt: NOW }],
  };
  for (const l of PARTNER_LOCALES) {
    const h = buildDigestTelegram(l, { content, portalUrl: "https://partner.cyprusvipestates.com/home" });
    assert.ok(h.length <= DIGEST_TELEGRAM_MAX, `${l} ${h.length}`);
    assert.ok(h.includes("Sea &amp; Sun") && !h.includes("<i>C0</i>"));
  }
});

// ── Wiring ──────────────────────────────────────────────────────────────────

test("wiring: linking the bot switches EMAIL to BOTH; settings save both switches; cron route gated", () => {
  const hook = src("src/lib/partner/telegramWebhook.ts");
  assert.ok(hook.includes('...(partner.notifyChannel === "EMAIL" ? { notifyChannel: "BOTH" as const } : {})'));
  const settings = src("src/app/partner-portal/settingsActions.ts");
  assert.ok(settings.includes('marketAlerts: checked(fd, "marketAlerts")') && settings.includes('reminders: checked(fd, "reminders")'));
  const route = src("src/app/api/cron/partner-alerts/route.ts");
  assert.ok(route.includes("process.env.CRON_SECRET") && route.includes("PARTNER_ALERTS_START") && route.includes("withAlertsLock"));
  const send = src("src/lib/partner/notifySend.ts");
  assert.ok(send.includes("const switchedOff = switchGate(row.kind, partner);"));
  assert.ok(send.includes('if (cyDate(until) !== cyDate(planned) || until.getTime() <= now.getTime()) return { skip: "superseded" };'));
  assert.ok(send.includes('if (partner.bankDetailsEnc) return { skip: "bank details present" };'));
});
