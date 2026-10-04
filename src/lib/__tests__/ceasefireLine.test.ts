import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isNorthOfCeasefireLine, CEASEFIRE_LINE } from "@/lib/ceasefireLine";
import { computeDistances } from "@/lib/developmentDistances";

/* Distances must never point at a beach, golf course or town centre across the
   1974 ceasefire line (2026-10-04: Nicosia Central Park Residences showed
   "beach 13 min" and "golf 38 min", both in the north). */

const NORTH: [string, number, number][] = [
  ["Kyrenia harbour", 35.341, 33.319],
  ["Korineum golf (Kyrenia)", 35.32627, 33.51357],
  ["Famagusta old town", 35.125, 33.941],
  ["Varosha", 35.105, 33.958],
  ["Morphou", 35.199, 32.993],
  ["Lefka", 35.11, 32.85],
  ["Limnitis (Yesilirmak)", 35.163, 32.733],
  ["Kaimakli (north Nicosia)", 35.185, 33.38],
  ["Ercan airport", 35.154, 33.496],
  ["Louroujina salient", 35.03, 33.5],
  ["the inland 'beach' POI NW of Nicosia", 35.21416, 33.29039],
];
const SOUTH: [string, number, number][] = [
  ["Ledra Street (Nicosia old town)", 35.172, 33.361],
  ["Evagorou 25 (Nicosia Central Park)", 35.1677578, 33.3571586],
  ["Strovolos", 35.145, 33.345],
  ["Kato Pyrgos", 35.18, 32.68],
  ["Pomos", 35.15, 32.55],
  ["Linou", 35.07, 32.91],
  ["Astromeritis", 35.14, 33.04],
  ["Pyroi", 35.083, 33.48],
  ["Athienou", 35.061, 33.542],
  ["Deryneia", 35.06, 33.96],
  ["Ayia Napa", 34.988, 34.004],
  ["Protaras", 35.012, 34.058],
  ["Limassol", 34.6786, 33.0413],
  ["Paphos", 34.772, 32.4297],
  ["Troodos (Prodromos)", 34.95, 32.83],
];

test("places in the north are north", () => {
  for (const [name, lat, lng] of NORTH) assert.equal(isNorthOfCeasefireLine(lat, lng), true, name);
});

test("places in the Republic are south — the border villages included", () => {
  for (const [name, lat, lng] of SOUTH) assert.equal(isNorthOfCeasefireLine(lat, lng), false, name);
});

test("Nicosia Central Park: no beach or golf across the line, the centre is the old town", () => {
  const d = computeDistances(35.1677578, 33.3571586);
  // The nearest beach in the Republic (Larnaca) is ~36 km away: the formula
  // gives ~60 min — coarse, but no longer an inland point 13 minutes away.
  assert.ok(d.beach === undefined || d.beach >= 45, `beach ${d.beach} min`);
  assert.equal(d.golf, undefined, "no golf course in the Republic within 60 minutes");
  assert.ok(d.cityCenter !== undefined && d.cityCenter <= 2, `city centre ${d.cityCenter} min`);
  assert.ok(d.shops !== undefined && d.restaurants !== undefined, "everyday categories still resolve");
});

test("a Limassol seafront project is unchanged in kind: beach 1 min, centre within minutes", () => {
  const d = computeDistances(34.6870928, 33.0641376); // Olympic Residence
  assert.equal(d.beach, 1);
  assert.ok(d.cityCenter !== undefined && d.cityCenter <= 5);
  assert.ok(d.golf !== undefined && d.golf <= 60);
});

test("the backfill script carries the same line (it cannot import src/)", () => {
  const src = readFileSync("scripts/backfill-development-distances.mjs", "utf8");
  const m = src.match(/const CEASEFIRE_LINE = (\[\[.*?\]\]);/);
  assert.ok(m, "CEASEFIRE_LINE literal present in the backfill script");
  assert.deepEqual(JSON.parse(m![1]), CEASEFIRE_LINE.map(([a, b]) => [a, b]));
  assert.match(src, /if \(isNorthOfCeasefireLine\(p\.lat, p\.lng\)\) continue;/);
});
