import { test } from "node:test";
import assert from "node:assert/strict";
import { datedEvents, diffSnapshot, pickPrevSnapshots, devRef, type ChangesDevelopment } from "@/lib/crm/inventoryChanges";

const now = new Date("2026-09-08T10:00:00Z");
const from = new Date("2026-08-25T10:00:00Z");
const d = (o: Partial<ChangesDevelopment> = {}): ChangesDevelopment => ({
  id: "dev1", publicName: "Alpha", developer: "Dev Co", district: "Paphos", town: "Paphos", area: null, slug: "alpha", publishStatus: "published",
  publishedAt: null, soldOutSince: null, returnedToMarketAt: null, priceFrom: 300_000, priceTo: 500_000, units: [], override: null, ...o,
});
const u = (o: Partial<ChangesDevelopment["units"][number]> & { id: string }) => ({ ref: o.id, feedRef: null, label: null, type: "Apartment", status: "available", price: null, source: "feed", createdAt: new Date("2026-01-01T00:00:00Z"), ...o });

test("datedEvents: published / sold_out / back_on_market / new_units inside the window only", () => {
  const dev = d({
    publishedAt: new Date("2026-09-01T00:00:00Z"), soldOutSince: new Date("2026-08-01T00:00:00Z"), returnedToMarketAt: new Date("2026-09-02T00:00:00Z"),
    units: [u({ id: "n1", createdAt: new Date("2026-09-03T00:00:00Z"), price: 320_000 }), u({ id: "n2", createdAt: new Date("2026-09-04T00:00:00Z"), price: 340_000, type: "Penthouse", source: "manual" }), u({ id: "old" })],
  });
  const ev = datedEvents(dev, from, now);
  assert.deepEqual(ev.map((e) => e.type), ["published", "back_on_market", "new_units"]); // sold_out is before the window
  const nu = ev.find((e) => e.type === "new_units")!;
  assert.equal(nu.count, 2);
  assert.deepEqual(nu.types, ["Apartment", "Penthouse"]);
  assert.deepEqual(nu.priceRange, { min: 320_000, max: 340_000 });
  assert.equal(nu.source, "mixed");
  assert.equal(ev.find((e) => e.type === "back_on_market")!.availableNow, 3);
  assert.equal(ev[0].publicUrl?.en, "/en/projects/alpha");
});

test("datedEvents: sold_out carries the lower-bound flag; nothing for an unpublished development", () => {
  const ev = datedEvents(d({ soldOutSince: new Date("2026-09-05T00:00:00Z") }), from, now);
  assert.equal(ev[0].type, "sold_out");
  assert.equal(ev[0].sinceIsLowerBound, true);
  assert.deepEqual(datedEvents(d({ publishStatus: "ready", publishedAt: new Date("2026-09-05T00:00:00Z") }), from, now), []);
});

test("diffSnapshot: availability, priceFrom, unit status and unit price (1% threshold), grouped and capped", () => {
  const ref = devRef(d());
  const prev = {
    capturedAt: new Date("2026-08-26T02:00:00Z"), publishStatus: "published", priceFrom: 300_000, priceTo: 500_000, unitsTotal: 13, unitsAvailable: 3,
    units: [
      { key: "1", label: "Nr. 1", status: "available", price: 300_000 },
      { key: "2", label: "Nr. 2", status: "available", price: 400_000 },
      { key: "3", label: "Nr. 3", status: "available", price: 500_000 },
      { key: "gone", label: "Nr. 9", status: "available", price: 450_000 },
      ...Array.from({ length: 9 }, (_, i) => ({ key: `s${i}`, label: `S${i}`, status: "sold", price: 1 })),
    ],
  };
  const cur = {
    publishStatus: "published", priceFrom: 315_000, priceTo: 500_000, unitsTotal: 12, unitsAvailable: 1,
    units: [
      { key: "1", label: "Nr. 1", status: "reserved", price: 300_000 },
      { key: "2", label: "Nr. 2", status: "available", price: 403_000 }, // +0.75% → below threshold
      { key: "3", label: "Nr. 3", status: "sold", price: 520_000 },       // +4% → reported even though sold
      ...Array.from({ length: 9 }, (_, i) => ({ key: `s${i}`, label: `S${i}`, status: "sold", price: 1 })),
    ],
  };
  const ev = diffSnapshot(ref, prev, cur, now);
  const types = ev.map((e) => e.type);
  assert.deepEqual(types, ["availability_changed", "price_from_changed", "unit_status_changed", "unit_price_changed"]);
  const av = ev[0];
  assert.deepEqual({ from: av.from, to: av.to, lastUnits: av.lastUnits }, { from: 3, to: 1, lastUnits: true });
  assert.deepEqual({ from: ev[1].from, to: ev[1].to, pct: ev[1].pct }, { from: 300_000, to: 315_000, pct: 5 });
  const st = ev[2] as unknown as { units: { key: string; from: string; to: string }[]; more: number };
  assert.deepEqual(st.units.map((x) => [x.key, x.from, x.to]), [["1", "available", "reserved"], ["3", "available", "sold"], ["gone", "available", "removed"]]);
  assert.equal(st.more, 0);
  const pr = ev[3] as unknown as { units: { key: string; from: number; to: number; pct: number }[] };
  assert.deepEqual(pr.units, [{ key: "3", label: "Nr. 3", from: 500_000, to: 520_000, pct: 4 }]);
  assert.equal(ev[0].since?.toISOString(), prev.capturedAt.toISOString());
  assert.equal(ev[0].at, null);
});

test("diffSnapshot: a removed unit is not reported when the development is no longer published; no events when nothing changed", () => {
  const ref = devRef(d());
  const prev = { capturedAt: from, publishStatus: "published", priceFrom: 1, priceTo: 2, unitsTotal: 1, unitsAvailable: 1, units: [{ key: "x", label: null, status: "available", price: 1 }] };
  assert.deepEqual(diffSnapshot(ref, prev, { ...prev, publishStatus: "ready", unitsAvailable: 0, units: [] }, now).map((e) => e.type), ["availability_changed"]); // "removed" suppressed: not published
  const prevReady = { ...prev, publishStatus: "ready" };
  assert.deepEqual(diffSnapshot(ref, prevReady, { ...prev, unitsAvailable: 0, units: [] }, now).map((e) => e.type), ["availability_changed"]); // "removed" suppressed: prev side wasn't published either
  assert.deepEqual(diffSnapshot(ref, prev, { ...prev }, now), []);
});

test("diffSnapshot caps listed units at 10 and reports the rest as more", () => {
  const ref = devRef(d());
  const mk = (status: string) => Array.from({ length: 14 }, (_, i) => ({ key: `k${i}`, label: null, status, price: 1 }));
  const prev = { capturedAt: from, publishStatus: "published", priceFrom: null, priceTo: null, unitsTotal: 14, unitsAvailable: 14, units: mk("available") };
  const ev = diffSnapshot(ref, prev, { ...prev, unitsAvailable: 0, units: mk("sold") }, now);
  const st = ev.find((e) => e.type === "unit_status_changed") as unknown as { units: unknown[]; more: number };
  assert.equal(st.units.length, 10);
  assert.equal(st.more, 4);
});

test("pickPrevSnapshots keeps the oldest row per development", () => {
  const rows = [
    { developmentId: "a", capturedAt: new Date("2026-09-03T00:00:00Z") },
    { developmentId: "a", capturedAt: new Date("2026-09-01T00:00:00Z") },
    { developmentId: "b", capturedAt: new Date("2026-09-02T00:00:00Z") },
  ];
  const m = pickPrevSnapshots(rows);
  assert.equal(m.get("a")?.capturedAt.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(m.get("b")?.capturedAt.toISOString(), "2026-09-02T00:00:00.000Z");
});

test("diffSnapshot: a priceFrom that starts at 0 reports the move without a percentage", () => {
  const ref = devRef(d());
  const prev = { capturedAt: from, publishStatus: "published", priceFrom: 0, priceTo: null, unitsTotal: 0, unitsAvailable: 0, units: [] };
  const ev = diffSnapshot(ref, prev, { ...prev, priceFrom: 250_000 }, now);
  assert.deepEqual(ev.map((e) => [e.type, e.from, e.to, e.pct]), [["price_from_changed", 0, 250_000, null]]);
});
