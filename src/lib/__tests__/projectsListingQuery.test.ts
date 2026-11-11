// What /projects costs per render (2026-11-11).
//
// The operator reported "homepage → projects, up to 5 seconds". Measured on the
// live server: /projects HTML 3.63-4.86 s, the RSC payload a click fetches
// 3.56-3.82 s total, /contacts 0.057 s — and 2,660 ms of CPU on 3,169 ms wall,
// i.e. CPU-bound in Node, not waiting on the database. Postgres answered the
// underlying SQL in 7 ms (EXPLAIN ANALYZE, all shared-buffer hits).
//
// Two independent multipliers caused it, and both are pinned below.
//
// 1. THREE identical loads per render. getFilteredProjects (cards),
//    getFilteredProjectsCount (a number) and getFilteredProjectLocationsByLang
//    (map pins) each called queryFilteredRows(), which each re-ran the full
//    development load. Measured: 1x 1,472 ms, 3x in parallel 4,528 ms.
//
// 2. `include: { override: true }` hydrated every column of every override —
//    433 rows, 9,585 kB, of which 9,247 kB (96 %) is promoBlocks* (6,620 kB) +
//    description* (2,230 kB) + seo (397 kB): detail-page text in five languages
//    that a card grid never renders. 19.88 MB of JSON to show 14 cards.
//
// With an explicit select of only the card fields: 281 ms and 2.06 MB.
//
// MEASUREMENT TRAP, recorded so the next person doesn't lose an hour to it: the
// RSC response STREAMS, so curl's %{time_starttransfer} reports 10-20 ms while
// the payload takes 3.5 s. Read %{time_total}. A hover prefetch
// (Next-Router-Prefetch: 1) returns 166 bytes — an empty shell — which is why
// the access log's RSC median is 0.021 s with a p90 of 2.149 s: the cheap rows
// are prefetches, the expensive ones are real clicks.
//
// No Prisma client is opened here, per this repo's rule — the local
// DATABASE_URL points at PRODUCTION. Everything below is pure functions and
// plain objects, which is why mapDevelopmentRowToCard and the select live in
// developmentCard.ts (prisma-free) rather than in sanity.utils.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEVELOPMENT_CARD_SELECT,
  mapDevelopmentRowToCard,
  filterDevelopmentCards,
} from "@/lib/developmentCard";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* A development row that records every field the mapper reads.
   Values are shaped by key name so the mapper runs for real rather than
   crashing on the first arithmetic. */
function recordingRow(seen: Set<string>, prefix = "") {
  const units = [
    { beds: "2", status: "available", price: 300_000, type: "Apartment", areaBuilt: "90" },
    { beds: "3+1", status: "sold", price: 450_000, type: "Apartment", areaBuilt: "120" },
  ];
  const value = (key: string): unknown => {
    if (key === "units") return units;
    if (key === "override") return new Proxy({}, handler("override."));
    if (key === "gallery") return ["/uploads/a.jpg", "/uploads/b.jpg"];
    if (key === "distances") return { beach: 5, golf: 12 };
    if (key === "createdAt") return new Date("2026-01-01T00:00:00Z");
    if (key === "latitude") return 34.7;
    if (key === "longitude") return 32.4;
    if (key === "priceFrom") return 250_000;
    if (key === "priceTo") return 500_000;
    if (key === "vatApplies") return true;
    if (key === "completion") return "Q4 2027";
    return `value-of-${key}`;
  };
  const handler = (p: string): ProxyHandler<object> => ({
    get(_t, key) {
      if (typeof key !== "string") return undefined;
      // JS/engine internals are not database fields.
      if (key === "then" || key === "toJSON" || key === "constructor") return undefined;
      seen.add(p + key);
      return value(key);
    },
    has() {
      return true;
    },
  });
  return new Proxy({}, handler(prefix));
}

const selectKeys = (sel: Record<string, unknown>, nested?: string): string[] => {
  const node = nested ? (sel[nested] as { select: Record<string, unknown> }).select : sel;
  return Object.keys(node);
};

test("the select covers every field mapDevelopmentRowToCard actually reads", () => {
  const seen = new Set<string>();
  const card = mapDevelopmentRowToCard(recordingRow(seen));
  // Sanity: the probe really exercised the mapper, it didn't bail out early.
  assert.ok(seen.size > 10, `the probe recorded only ${seen.size} field reads`);
  assert.equal(card.sanityId, "value-of-id");

  const top = new Set(selectKeys(DEVELOPMENT_CARD_SELECT as unknown as Record<string, unknown>));
  const override = new Set(
    selectKeys(DEVELOPMENT_CARD_SELECT as unknown as Record<string, unknown>, "override"),
  );

  // Array.from, not a spread: this tsconfig sets no `target`, so iterating a
  // Set with [...x] is a TS2802 error here.
  const missing = Array.from(seen).filter((k) => {
    if (k.startsWith("override.")) return !override.has(k.slice("override.".length));
    return !top.has(k);
  });
  // This is the test that makes the narrow select safe: add a field to the
  // mapper without adding it to the select and this fails by name.
  assert.deepEqual(missing, [], `fields read by the mapper but absent from the select: ${missing.join(", ")}`);
});

test("the select does not hydrate the five-language detail text", () => {
  const json = JSON.stringify(DEVELOPMENT_CARD_SELECT);
  // 9,247 kB of the 9,585 kB override payload was these. A card grid shows
  // none of it, and `include: { override: true }` is what pulled it in.
  for (const forbidden of ["promoBlocks", "description", "seo", "amenities", "heroVideo", "vatNote", "extraLinks"]) {
    assert.ok(!json.includes(forbidden), `${forbidden} must not be selected for a listing card`);
  }
  // And the listing's own load must not go back to hydrating everything.
  // Scoped to loadDevelopmentCards deliberately: four other call sites in that
  // file still use `include: { override: true }` (resolvePinnedProjects,
  // listProjectsForPicker, getDeveloperCatalogByLang,
  // getLatestDevelopmentsByLang). Two of them load ALL published developments
  // and carry the same 9 MB — a separate fix on separate surfaces, not
  // something this test should quietly claim to cover.
  const utils = read("src/sanity/sanity.utils.ts");
  const loader = /const loadDevelopmentCards = cache\(async \(\) => \{[\s\S]*?\n\}\);/.exec(utils)?.[0];
  assert.ok(loader, "loadDevelopmentCards not found");
  assert.ok(loader!.includes("select: DEVELOPMENT_CARD_SELECT"), "the listing load must use the narrow select");
  assert.ok(!/include:/.test(loader!), "the listing load must not hydrate relations wholesale");
});

test("filterDevelopmentCards is pure and keeps the filter semantics", () => {
  const base = {
    sanityId: "x", slug: "s", title: "t", keyFeatures: { city: "", propertyType: "Apartment", bedrooms: "2", price: 300_000 },
    latitude: 34.7, longitude: 32.4, unitsAvailable: 1, unitsTotal: 2,
    _matchLocations: ["limassol"], _searchText: "soho resort", _priceFrom: 300_000, _priceTo: 400_000,
    _stage: null, _source: "development" as const,
  };
  const cards = [
    { ...base, sanityId: "a" },
    { ...base, sanityId: "b", _matchLocations: ["paphos"], _searchText: "venus rock" },
  ] as unknown as Parameters<typeof filterDevelopmentCards>[0];

  const before = JSON.stringify(cards);
  assert.equal(filterDevelopmentCards(cards, {}).length, 2, "no filters keeps everything");
  assert.deepEqual(filterDevelopmentCards(cards, { city: "Limassol" }).map((c) => c.sanityId), ["a"]);
  assert.deepEqual(filterDevelopmentCards(cards, { q: "venus" }).map((c) => c.sanityId), ["b"]);
  assert.equal(filterDevelopmentCards(cards, { q: "ve" }).length, 2, "a search under 3 chars is not a filter");
  assert.equal(filterDevelopmentCards(cards, { priceTo: 100_000 }).length, 0, "price ceiling below the floor excludes");
  assert.equal(filterDevelopmentCards(cards, { propertyType: "Villa" }).length, 0);
  // A bbox needs all four edges; three of them must not silently filter.
  assert.equal(filterDevelopmentCards(cards, { north: 35, south: 34, east: 33 }).length, 2);
  assert.equal(filterDevelopmentCards(cards, { north: 35, south: 34, east: 33, west: 32 }).length, 2);
  assert.equal(filterDevelopmentCards(cards, { north: 30, south: 29, east: 33, west: 32 }).length, 0);
  assert.equal(JSON.stringify(cards), before, "the input must not be mutated");
});

test("/projects loads the listing once, not three times", () => {
  const page = read("src/app/[lang]/projects/page.tsx");
  // The three old calls each re-ran the full development load.
  for (const gone of ["getFilteredProjects(", "getFilteredProjectsCount(", "getFilteredProjectLocationsByLang("]) {
    assert.ok(!page.includes(gone), `${gone} runs its own full load — the page must use getProjectsListing()`);
  }
  assert.ok(page.includes("getProjectsListing("), "one call supplies cards, total and markers");

  const utils = read("src/sanity/sanity.utils.ts");
  // The expensive load is deduped per request for every other surface too
  // (siteStats pulls the same rows onto the detail/about/partners pages).
  assert.ok(
    /const loadDevelopmentCards = cache\(/.test(utils),
    "the development load must be wrapped in React.cache so one request loads it once",
  );
  assert.ok(
    /getProjectsListing/.test(utils) && /queryFilteredRows\(lang, filters\)/.test(utils),
    "getProjectsListing must derive cards, total and markers from a single queryFilteredRows call",
  );
});
