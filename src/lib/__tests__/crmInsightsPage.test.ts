import { test } from "node:test";
import assert from "node:assert/strict";
import {
  periodFromSearchParams, periodHref, eur, eurCompact, pctText, durationText, channelLabel, monthLabel,
  niceScale, monthChartGeometry, columnPath, relativeBarPct, comparePartnerRows, defaultSortDir, CHART_DIMENSIONS,
} from "../crm/insights/pageModel";
import type { PartnerQualityRow } from "../crm/insights/partnerQuality";
import type { OutlookMonth } from "../crm/insights/outlook";
import { paletteActions } from "../crm/leadSearch";

const NOW = new Date("2026-10-19T09:00:00Z");

// ── period from searchParams ──

test("no preset → last 3 months, not flagged", () => {
  const p = periodFromSearchParams(undefined, NOW);
  assert.equal(p.preset, "last_3_months");
  assert.equal(p.fromKey, "2026-08-01");
  assert.equal(p.toKey, "2026-10-19");
  assert.equal(p.invalid, false);
  assert.equal(periodFromSearchParams({}, NOW).preset, "last_3_months");
  assert.equal(periodFromSearchParams({ preset: "  " }, NOW).invalid, false);
});

test("known presets resolve; arrays take the first value", () => {
  assert.equal(periodFromSearchParams({ preset: "this_month" }, NOW).fromKey, "2026-10-01");
  assert.equal(periodFromSearchParams({ preset: "this_year" }, NOW).fromKey, "2026-01-01");
  assert.equal(periodFromSearchParams({ preset: "last_12_months" }, NOW).fromKey, "2025-11-01");
  assert.equal(periodFromSearchParams({ preset: ["this_year", "this_month"] }, NOW).preset, "this_year");
});

test("unknown preset → default, flagged invalid", () => {
  const p = periodFromSearchParams({ preset: "forever" }, NOW);
  assert.equal(p.preset, "last_3_months");
  assert.equal(p.invalid, true);
});

test("custom range: valid dates kept, Cyprus-time boundaries, to is exclusive next day", () => {
  const p = periodFromSearchParams({ preset: "custom", from: "2026-03-01", to: "2026-03-31" }, NOW);
  assert.equal(p.preset, "custom");
  assert.equal(p.invalid, false);
  assert.equal(p.fromKey, "2026-03-01");
  assert.equal(p.toKey, "2026-03-31");
  assert.equal(p.from.toISOString(), "2026-02-28T22:00:00.000Z"); // EET, UTC+2
  assert.equal(p.to.toISOString(), "2026-03-31T21:00:00.000Z"); // EEST from 29 March, UTC+3
  assert.equal(periodFromSearchParams({ preset: "custom", from: "2026-05-05", to: "2026-05-05" }, NOW).invalid, false);
});

test("custom range: reversed, malformed, impossible or missing dates → default, flagged", () => {
  for (const sp of [
    { preset: "custom", from: "2026-05-10", to: "2026-05-01" },
    { preset: "custom", from: "2026-5-1", to: "2026-05-31" },
    { preset: "custom", from: "2026-02-30", to: "2026-03-01" },
    { preset: "custom", from: "2026-01-01" },
    { preset: "custom", from: "'; DROP TABLE leads;--", to: "2026-01-01" },
  ]) {
    const p = periodFromSearchParams(sp, NOW);
    assert.equal(p.preset, "last_3_months", JSON.stringify(sp));
    assert.equal(p.invalid, true);
  }
});

test("periodHref builds preset and custom links", () => {
  assert.equal(periodHref("this_year"), "/crm/insights?preset=this_year");
  assert.equal(periodHref("custom", { from: "2026-01-01", to: "2026-02-01" }), "/crm/insights?preset=custom&from=2026-01-01&to=2026-02-01");
});

// ── formatting ──

test("money is whole euros with a space after the sign", () => {
  assert.equal(eur(12345), "€ 12,345");
  assert.equal(eur(0), "€ 0");
  assert.equal(eur(1234.6), "€ 1,235");
  assert.equal(eur(-500), "−€ 500");
  assert.equal(eurCompact(0), "€ 0");
  assert.equal(eurCompact(750), "€ 750");
  assert.equal(eurCompact(25_000), "€ 25k");
  assert.equal(eurCompact(12_500), "€ 12.5k");
  assert.equal(eurCompact(1_500_000), "€ 1.5M");
});

test("percent, duration, channel and month labels", () => {
  assert.equal(pctText(null), "—");
  assert.equal(pctText(12.5), "12.5 %");
  assert.equal(pctText(0), "0 %");
  assert.equal(durationText(null), "—");
  assert.equal(durationText(0), "0 min");
  assert.equal(durationText(45), "45 min");
  assert.equal(durationText(210), "3.5 h");
  assert.equal(durationText(3 * 1440), "3 d");
  assert.equal(channelLabel("CONTACT_FORM", null), "Contact form");
  assert.equal(channelLabel("PARTNER", "HANDOVER"), "Partner · Handover");
  assert.equal(channelLabel("PARTNER", "FIX"), "Partner · Fix");
  assert.equal(channelLabel("PARTNER", null), "Partner");
  assert.equal(monthLabel("2026-03"), "Mar 2026");
});

// ── chart geometry ──

test("niceScale rounds the axis up to clean steps and is safe at zero", () => {
  assert.deepEqual(niceScale(0), { max: 0, step: 0, ticks: [0] });
  assert.deepEqual(niceScale(-5), { max: 0, step: 0, ticks: [0] });
  assert.deepEqual(niceScale(Number.NaN), { max: 0, step: 0, ticks: [0] });
  const s = niceScale(37_000);
  assert.equal(s.step, 10_000);
  assert.equal(s.max, 40_000);
  assert.deepEqual(s.ticks, [0, 10_000, 20_000, 30_000, 40_000]);
  const t = niceScale(9_000);
  assert.equal(t.step, 2_500);
  assert.equal(t.max, 10_000);
  assert.ok(niceScale(1).max >= 1);
});

const months = (vals: [number, number][]): OutlookMonth[] =>
  vals.map(([earned, developerPaid], i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, earned, developerPaid }));

test("geometry: all-zero data is empty, no NaN anywhere, bars flat on the baseline", () => {
  const g = monthChartGeometry(months(Array.from({ length: 12 }, () => [0, 0] as [number, number])));
  assert.equal(g.empty, true);
  assert.equal(g.bars.length, 12);
  assert.ok(g.bars.every((b) => b.earned === null && b.developerPaid === null && b.total === 0));
  assert.deepEqual(g.ticks.map((t) => t.y), [g.plot.bottom]);
  const nums: number[] = [];
  JSON.stringify(g, (_k, v) => (typeof v === "number" && nums.push(v), v));
  assert.ok(nums.length > 0 && nums.every(Number.isFinite)); // JSON turns NaN into null, so check before it does
});

test("geometry: heights are proportional to the axis max; stack keeps a 2px gap; tallest reaches the top", () => {
  const g = monthChartGeometry(months([[10_000, 0], [20_000, 20_000], [0, 5_000]]));
  const plotH = g.plot.bottom - g.plot.top;
  assert.equal(g.empty, false);
  assert.equal(g.ticks[g.ticks.length - 1].value, 40_000);
  const [a, b, c] = g.bars;
  assert.ok(a.earned && !a.developerPaid);
  assert.equal(Math.round(a.earned.height), Math.round(plotH / 4));
  assert.equal(a.earned.top, true); // rounded data end on the only segment
  assert.equal(a.earned.y + a.earned.height, g.plot.bottom); // grows from the baseline
  assert.ok(b.earned && b.developerPaid);
  assert.equal(b.earned.top, false);
  assert.equal(b.developerPaid.top, true);
  assert.ok(Math.abs(b.developerPaid.y - g.plot.top) < 1e-9); // 40k of 40k
  assert.ok(Math.abs(b.earned.y - (b.developerPaid.y + b.developerPaid.height) - CHART_DIMENSIONS.gap) < 1e-9);
  assert.ok(!c.earned && c.developerPaid);
  assert.equal(c.developerPaid.y + c.developerPaid.height, g.plot.bottom); // no gap without an earned segment
  for (const bar of g.bars) {
    for (const s of [bar.earned, bar.developerPaid]) if (s) assert.ok(s.width <= CHART_DIMENSIONS.barWidth && s.width > 0);
  }
  assert.equal(g.bars[0].showYear, true);
  assert.equal(g.bars[1].showYear, false);
  assert.equal(b.earnedValue, 20_000);
  assert.equal(b.developerPaidValue, 20_000);
});

test("geometry: a sliver thinner than the gap is dropped from the drawing but kept as a value", () => {
  const g = monthChartGeometry(months([[1_000_000, 1]]));
  const [b] = g.bars;
  assert.equal(b.developerPaid, null);
  assert.equal(b.earned?.top, true);
  assert.equal(b.developerPaidValue, 1);
});

test("geometry: January shows its year; negative amounts never draw downward", () => {
  const g = monthChartGeometry([
    { month: "2025-12", earned: 100, developerPaid: 0 },
    { month: "2026-01", earned: -50, developerPaid: 200 },
  ]);
  assert.equal(g.bars[0].showYear, true);
  assert.equal(g.bars[1].showYear, true);
  assert.equal(g.bars[1].earned, null);
  assert.ok(g.bars.every((b) => [b.earned, b.developerPaid].every((s) => !s || s.height >= 0)));
});

test("columnPath: rounded top corners clamp to the segment, square path when not rounded", () => {
  assert.equal(columnPath({ x: 0, y: 10, width: 20, height: 30 }, false), "M0,40V10H20V40Z");
  const p = columnPath({ x: 0, y: 10, width: 20, height: 30 }, true);
  assert.ok(p.startsWith("M0,40V14Q0,10 4,10H16Q20,10 20,14V40Z"));
  // a 2px-tall segment can't take a 4px radius
  assert.ok(columnPath({ x: 0, y: 0, width: 20, height: 2 }, true).includes("V2Q0,0 2,0"));
});

test("relativeBarPct: relative to the best channel, safe for null and zero", () => {
  assert.equal(relativeBarPct(null, 10), 0);
  assert.equal(relativeBarPct(5, 0), 0);
  assert.equal(relativeBarPct(0, 10), 0);
  assert.equal(relativeBarPct(5, 10), 50);
  assert.equal(relativeBarPct(10, 10), 100);
  assert.equal(relativeBarPct(12, 10), 100);
});

// ── partner table sort ──

const row = (over: Partial<PartnerQualityRow>): PartnerQualityRow => ({
  partnerId: over.name ?? "p", name: "P", status: "ACTIVE", submitted: 0, accepted: 0, inReview: 0, rejected: 0, valid: 0,
  reachedViewing: 0, closed: 0, conversionPct: null, medianResponseMin: null, lowQuality: false, topPartner: false, ...over,
});

test("comparePartnerRows: numeric columns both ways, ties by name", () => {
  const rows = [row({ name: "Bea", submitted: 3 }), row({ name: "anna", submitted: 3 }), row({ name: "Carl", submitted: 9 })];
  assert.deepEqual([...rows].sort(comparePartnerRows("submitted", "desc")).map((r) => r.name), ["Carl", "anna", "Bea"]);
  assert.deepEqual([...rows].sort(comparePartnerRows("submitted", "asc")).map((r) => r.name), ["anna", "Bea", "Carl"]);
  assert.deepEqual([...rows].sort(comparePartnerRows("name", "asc")).map((r) => r.name), ["anna", "Bea", "Carl"]);
  assert.deepEqual([...rows].sort(comparePartnerRows("name", "desc")).map((r) => r.name), ["Carl", "Bea", "anna"]);
});

test("comparePartnerRows: empty conversion / response sorts last in both directions", () => {
  const rows = [row({ name: "A", medianResponseMin: null }), row({ name: "B", medianResponseMin: 30 }), row({ name: "C", medianResponseMin: 5 })];
  assert.deepEqual([...rows].sort(comparePartnerRows("medianResponseMin", "asc")).map((r) => r.name), ["C", "B", "A"]);
  assert.deepEqual([...rows].sort(comparePartnerRows("medianResponseMin", "desc")).map((r) => r.name), ["B", "C", "A"]);
  const conv = [row({ name: "X", conversionPct: null }), row({ name: "Y", conversionPct: 0 }), row({ name: "Z", conversionPct: 50 })];
  assert.deepEqual([...conv].sort(comparePartnerRows("conversionPct", "desc")).map((r) => r.name), ["Z", "Y", "X"]);
  assert.deepEqual([...conv].sort(comparePartnerRows("conversionPct", "asc")).map((r) => r.name), ["Y", "Z", "X"]);
});

test("defaultSortDir: names and response time ascending, counts descending", () => {
  assert.equal(defaultSortDir("name"), "asc");
  assert.equal(defaultSortDir("medianResponseMin"), "asc");
  assert.equal(defaultSortDir("closed"), "desc");
});

test("Insights is a manager-only palette entry", () => {
  assert.ok(paletteActions(true, false).some((a) => a.href === "/crm/insights"));
  assert.ok(!paletteActions(false, false).some((a) => a.href === "/crm/insights"));
});
