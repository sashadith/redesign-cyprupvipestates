// The 1974 ceasefire line across Cyprus, coarsely, for one job: keeping points
// of interest in the north out of a Development's "distances" figures.
//
// public/poi/cyprus.json is an OpenStreetMap export of the whole island, so it
// also holds ~1,100 POIs in the north (77 beaches, 2 golf courses, 486
// restaurants…). computeDistances() takes the nearest POI as the crow flies,
// which for Nicosia meant "beach 13 min" (an inland point NW of the city),
// "golf 38 min" (Korineum, Kyrenia) and for two Troodos projects the CMC golf
// course — all on the far side of the line, reachable only through a crossing
// point. Found 2026-10-04 on Nicosia Central Park Residences; 6 of 292
// published Developments were affected.
//
// Accuracy: a polyline of ~20 vertices, good to roughly a kilometre — enough
// for "is this beach/golf course/restaurant in the north", not a map. Every
// vertex is pinned by a pair of real places on either side, asserted in
// src/lib/__tests__/ceasefireLine.test.ts. The Louroujina (Akincilar) salient
// south of the line is handled as its own box. The British bases and the
// buffer zone count as south (they are reachable without a crossing).
//
// scripts/backfill-development-distances.mjs carries a copy of LINE and
// isNorthOfCeasefireLine (it is plain node and cannot import from src/) —
// change both together.

/** West → east, [longitude, latitude]. A point is north when its latitude is
 *  above the line at its longitude. */
export const CEASEFIRE_LINE: readonly [number, number][] = [
  // West of here the Republic's coast runs from Pomos to Kato Pyrgos (35.18,
  // 32.68); everything below 35.25 is land in the south (the tiny Kokkina
  // exclave at 35.18, 32.61 is the one known miss, and holds no POIs we use).
  [32.5, 35.25],
  [32.7, 35.25],
  [32.715, 35.14], // Limnitis/Yesilirmak (35.163, 32.733) north, just east of Kato Pyrgos
  [32.8, 35.1],
  [32.92, 35.085], // Lefka (35.11, 32.85) north · Linou (35.07, 32.91) south
  [33.0, 35.12],
  [33.05, 35.15], // Morphou (35.20, 32.99) north · Astromeritis (35.14, 33.04) south
  [33.2, 35.168],
  [33.3, 35.172],
  [33.36, 35.176], // Nicosia old town: Ledra St (35.172, 33.361) south · Kaimakli (35.185, 33.38) north
  [33.42, 35.17],
  [33.5, 35.12], // Ercan (35.15, 33.50) north · Pyroi (35.083, 33.48) south
  [33.6, 35.1],
  [33.7, 35.09],
  [33.8, 35.08],
  [33.9, 35.075],
  [33.98, 35.07], // Famagusta (35.12, 33.94) north · Deryneia (35.06, 33.96) south
  [34.6, 35.06],
];

/** Louroujina/Akincilar: a northern salient reaching south of the line. */
const LOUROUJINA = { minLat: 35.0, maxLat: 35.06, minLng: 33.45, maxLng: 33.56 };

export function isNorthOfCeasefireLine(lat: number, lng: number): boolean {
  if (lat >= LOUROUJINA.minLat && lat <= LOUROUJINA.maxLat && lng >= LOUROUJINA.minLng && lng <= LOUROUJINA.maxLng) return true;
  const line = CEASEFIRE_LINE;
  if (lng <= line[0][0]) return lat > line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1];
    const [x2, y2] = line[i];
    if (lng <= x2) return lat > y1 + ((y2 - y1) * (lng - x1)) / (x2 - x1);
  }
  return lat > line[line.length - 1][1];
}
