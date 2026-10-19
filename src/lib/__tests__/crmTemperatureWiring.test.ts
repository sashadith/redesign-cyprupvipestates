import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunk, leadsNeedingTemperature, scoreLead, sortByTemperature, temperatureText, toPublicTemperature, toTemperatureInput,
  type TemperatureLead,
} from "@/lib/crm/insights/temperatureWiring";

const NOW = new Date("2026-10-19T12:00:00Z");
const lead = (over: Partial<TemperatureLead> = {}): TemperatureLead => ({
  id: "l1", status: "COMMUNICATING", timeline: null, budgetMin: null, budgetMax: null, createdAt: new Date("2026-10-10T00:00:00Z"), ...over,
});

test("chunk splits and keeps order", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.equal(chunk(Array.from({ length: 2500 }, (_, i) => i), 1000).length, 3);
  assert.throws(() => chunk([1], 0));
});

test("leadsNeedingTemperature drops closed/lost/keep-contact and duplicates", () => {
  const out = leadsNeedingTemperature([lead({ id: "a" }), lead({ id: "b", status: "CLOSED" }), lead({ id: "c", status: "LOST" }),
    lead({ id: "d", status: "KEEP_CONTACT" }), lead({ id: "a" }), lead({ id: "e", status: "NEW" })]);
  assert.deepEqual(out.map((l) => l.id), ["a", "e"]);
});

test("toTemperatureInput maps rows and defaults missing signals to null", () => {
  const i = toTemperatureInput(lead({ timeline: "IMMEDIATE", budgetMax: 400000 }), { lastInboundAt: new Date("2026-10-18T00:00:00Z") });
  assert.equal(i.status, "COMMUNICATING");
  assert.equal(i.timeline, "IMMEDIATE");
  assert.equal(i.budgetMax, 400000);
  assert.equal(i.lastInboundAt?.toISOString(), "2026-10-18T00:00:00.000Z");
  assert.equal(i.lastRealContactAt, null);
  assert.equal(i.lastPresentationViewAt, null);
  assert.equal(i.lastFavoriteAt, null);
});

test("scoreLead: engaged lead is hot, closed is null", () => {
  const hot = scoreLead(lead({ status: "VIEWING_SCHEDULED" }), { lastInboundAt: new Date("2026-10-18T12:00:00Z"), lastRealContactAt: new Date("2026-10-18T12:00:00Z") }, NOW);
  assert.equal(hot?.level, "hot");
  assert.equal(scoreLead(lead({ status: "CLOSED" }), {}, NOW), null);
});

test("toPublicTemperature strips the score and copies reasons", () => {
  const r = { level: "hot" as const, score: 7, reasons: ["a"] };
  const p = toPublicTemperature(r);
  assert.deepEqual(p, { level: "hot", reasons: ["a"] });
  assert.ok(p && !("score" in p));
  assert.notEqual(p?.reasons, r.reasons);
  assert.equal(toPublicTemperature(null), null);
  assert.equal(toPublicTemperature(undefined), null);
});

test("temperatureText", () => {
  assert.equal(temperatureText({ level: "hot", reasons: ["Replied today", "Viewing scheduled"] }), "Hot lead — Replied today, Viewing scheduled");
  assert.equal(temperatureText({ level: "cold", reasons: [] }), "Cold lead");
});

test("sortByTemperature: hot, warm, cold, none; stable within groups", () => {
  const items = [
    { id: 1, t: null }, { id: 2, t: { level: "cold" as const } }, { id: 3, t: { level: "hot" as const } }, { id: 4, t: { level: "warm" as const } },
    { id: 5, t: { level: "hot" as const } }, { id: 6, t: { level: "cold" as const } }, { id: 7, t: undefined }, { id: 8, t: { level: "warm" as const } },
  ];
  assert.deepEqual(sortByTemperature(items, (x) => x.t).map((x) => x.id), [3, 5, 4, 8, 2, 6, 1, 7]);
  assert.deepEqual(items.map((x) => x.id), [1, 2, 3, 4, 5, 6, 7, 8]); // input untouched
});
