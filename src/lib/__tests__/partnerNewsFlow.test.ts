import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import { badgeText, newsItems, unreadCount } from "@/lib/partner/news";
import { ratesById, reviveAvailability, reviveEvents, slimEvents } from "@/lib/partner/newsFlow";
import { dict, PARTNER_LOCALES } from "@/lib/partner/i18n";

const NOW = new Date("2026-10-19T12:00:00Z");
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ev = (type: string, id: string, at: string, extra: Record<string, unknown> = {}): ChangeEvent =>
  ({
    developmentId: id, name: `Project ${id}`, developer: "Secret Developer", location: { area: null, district: null, town: "Paphos" },
    publicUrl: { en: `/projects/p-${id}`, de: `/de/projects/p-${id}` }, type, at: new Date(at), since: null, ...extra,
  }) as ChangeEvent;

test("unread: newer than seenAt, all when never seen, nearly_sold_out never counts", () => {
  const items = [
    { at: new Date("2026-10-18T00:00:00Z"), kind: "new_project" as const },
    { at: new Date("2026-10-10T00:00:00Z"), kind: "price_drop" as const },
    { at: NOW, kind: "nearly_sold_out" as const },
  ];
  assert.equal(unreadCount(items, null), 2);
  assert.equal(unreadCount(items, new Date("2026-10-15T00:00:00Z")), 1);
  assert.equal(unreadCount(items, new Date("2026-10-18T00:00:00Z")), 0); // strictly newer
  assert.equal(unreadCount(items, new Date("2026-10-19T12:00:01Z")), 0); // sold-out state stays read forever
  assert.equal(unreadCount([{ at: NOW, kind: "nearly_sold_out" }], null), 0);
});

test("badge formatting: hidden at 0, number to 9, 9+ above", () => {
  assert.equal(badgeText(0), null);
  assert.equal(badgeText(-1), null);
  assert.equal(badgeText(1), "1");
  assert.equal(badgeText(9), "9");
  assert.equal(badgeText(10), "9+");
  assert.equal(badgeText(120), "9+");
});

test("rates are merged into items per partner: own handover rate, null = on request", () => {
  const cache = slimEvents([ev("published", "a", "2026-10-17T10:00:00Z"), ev("published", "b", "2026-10-16T10:00:00Z")]);
  const build = (rates: Map<string, number | null>) =>
    newsItems({ changes: reviveEvents(cache), availability: new Map(), rates, now: NOW, locale: "de" });
  const x = build(ratesById([{ id: "a", handoverRate: 1.85 }]));
  assert.equal(x.find((i) => i.developmentId === "a")!.rate, 1.85);
  assert.equal(x.find((i) => i.developmentId === "b")!.rate, null);
  const y = build(ratesById([{ id: "a", handoverRate: 2.5 }, { id: "b", handoverRate: null }]));
  assert.equal(y.find((i) => i.developmentId === "a")!.rate, 2.5);
  assert.equal(x[0].id, "new_project:a"); // newest first
});

test("the cached catalogue survives JSON and carries no developer", () => {
  const events = [ev("price_from_changed", "a", "2026-10-17T10:00:00Z", { from: 300000, to: 280000 }), ev("sold_out", "c", "2026-10-17T10:00:00Z")];
  const slim = slimEvents(events);
  assert.equal(slim.length, 1); // sold_out is not news
  const json = JSON.stringify(slim);
  assert.ok(!json.includes("Secret Developer"));
  const items = newsItems({
    changes: reviveEvents(JSON.parse(json)),
    availability: reviveAvailability(JSON.parse(JSON.stringify([["z", { available: 1, total: 20, name: "Zed", town: "Larnaca", en: "/projects/zed" }]]))),
    rates: new Map(), now: NOW,
  });
  const drop = items.find((i) => i.kind === "price_drop")!;
  assert.equal(drop.priceBefore, 300000);
  assert.equal(drop.priceFrom, 280000);
  assert.equal(drop.at.toISOString(), "2026-10-17T10:00:00.000Z");
  const nearly = items.find((i) => i.kind === "nearly_sold_out")!;
  assert.equal(nearly.name, "Zed");
  assert.equal(unreadCount(items, null), 1);
});

test("news dictionary and nav label exist in all four locales", () => {
  for (const l of PARTNER_LOCALES) {
    const t = dict(l);
    assert.ok(t.nav.news.length > 0);
    assert.ok(t.news.unreadAria.includes("{n}"));
  }
});

test("wiring: seen action is own-partner + client mount, nav badge is failure-safe, no admin touch", () => {
  const action = src("src/app/partner-portal/newsActions.ts");
  assert.match(action, /requirePartner\(\{ active: true \}\)/);
  assert.match(action, /id: me\.partner\.id/);
  assert.match(src("src/app/partner-portal/components/NewsSeen.tsx"), /useEffect/);
  assert.ok(!/markNewsSeenAction/.test(src("src/app/partner-portal/news/page.tsx").replace(/<NewsSeen \/>/, "")));
  const store = src("src/lib/partner/newsStore.ts");
  assert.match(store, /revalidate: 3600/);
  assert.match(store, /tags: \[NEWS_TAG\]/);
  assert.match(store, /catch \(e\)[\s\S]*return 0/);
});
