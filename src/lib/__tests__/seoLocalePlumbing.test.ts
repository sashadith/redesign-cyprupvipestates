import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LOCALES, DEFAULT_LOCALE, localeFromPath, parsePublicLocales,
} from "@/lib/locale";
import { deriveLocale } from "@/lib/gsc/client";
import { localeOfPath } from "@/lib/seo/urlCanonical";
import { absUrl } from "@/lib/indexnow";

// --- localeFromPath: the single parsing source for every locale-aware path ---

test("localeFromPath parses a prefixed path or a bare prefix root for every non-default locale", () => {
  assert.equal(localeFromPath("/de/projects/x"), "de");
  assert.equal(localeFromPath("/pl/projects/x"), "pl");
  assert.equal(localeFromPath("/ru/projects/x"), "ru");
  assert.equal(localeFromPath("/he/projects/x"), "he");
  assert.equal(localeFromPath("/de"), "de");
  assert.equal(localeFromPath("/pl"), "pl");
  assert.equal(localeFromPath("/ru"), "ru");
  assert.equal(localeFromPath("/he"), "he");
  assert.equal(localeFromPath("/x"), "en");
  assert.equal(localeFromPath("/"), "en");
  assert.equal(localeFromPath("/blog/some-post"), "en");
});

test("localeFromPath is pure — no env access, unaffected by PUBLIC_LOCALES gating", () => {
  // `he` is launch-gated (see LAUNCH_GATED_LOCALES in lib/locale.ts) and this
  // process's PUBLIC_LOCALES was computed once at import time from
  // NEXT_PUBLIC_LIVE_LOCALES — whatever that happens to be, a /he/ path must
  // still parse as Hebrew: GSC/analytics data for a gated locale is real
  // Hebrew data, not English.
  assert.equal(localeFromPath("/he/blog/x"), "he");
  assert.equal(DEFAULT_LOCALE, "en");
});

// --- deriveLocale: writes SearchMetric.locale — must NOT change its bare-root
// contract for the pre-existing locales (that would fork historical series) ---

test("deriveLocale recognises every non-default locale's slash-suffixed prefix, including the new he", () => {
  assert.equal(deriveLocale("/de/projects/x"), "de");
  assert.equal(deriveLocale("/pl/projects/x"), "pl");
  assert.equal(deriveLocale("/ru/projects/x"), "ru");
  assert.equal(deriveLocale("/he/projects/x"), "he");
  assert.equal(deriveLocale("/projects/x"), "en");
});

test("deriveLocale keeps its bare-root contract byte-identical (a bare /de is 'en', same as before Task 2) — changing it would fork SearchMetric's historical series", () => {
  assert.equal(deriveLocale("/de"), "en");
  assert.equal(deriveLocale("/pl"), "en");
  assert.equal(deriveLocale("/ru"), "en");
  assert.equal(deriveLocale("/he"), "en");
});

// --- localeOfPath: the JOIN-key derivation — bare root DOES resolve, he included ---

test("localeOfPath resolves a bare locale root for every locale, he included, unlike deriveLocale", () => {
  assert.equal(localeOfPath("/de"), "de");
  assert.equal(localeOfPath("/pl"), "pl");
  assert.equal(localeOfPath("/ru"), "ru");
  assert.equal(localeOfPath("/he"), "he");
  assert.equal(localeOfPath("/de/projects/x"), "de");
  assert.equal(localeOfPath("/he/projects/x"), "he");
  assert.equal(localeOfPath("/x"), "en");
});

// --- IndexNow fan-out: PUBLIC_LOCALES only, gated by NEXT_PUBLIC_LIVE_LOCALES ---
// indexnow.ts itself has no locale logic (fan-out lists are built by call
// sites via PUBLIC_LOCALES, e.g. src/app/admin/(panel)/developments/[id]/actions.ts)
// — parsePublicLocales is the pure function PUBLIC_LOCALES is built from, so
// exercising it directly proves the gating contract without needing to read
// back the frozen module-level constant.

test("IndexNow-style fan-out (PUBLIC_LOCALES.map(...)) excludes he while gated and includes it once listed", () => {
  const buildFanOutUrls = (locales: readonly string[], slug: string) =>
    locales.map((l) => absUrl(l === DEFAULT_LOCALE ? `/projects/${slug}` : `/${l}/projects/${slug}`));

  const gated = parsePublicLocales(undefined);
  const withHe = parsePublicLocales("en,de,pl,ru,he");

  const gatedUrls = buildFanOutUrls(gated, "villa-x");
  const withHeUrls = buildFanOutUrls(withHe, "villa-x");

  assert.equal(gatedUrls.length, 4);
  assert.ok(!gatedUrls.some((u) => u.includes("/he/")));
  assert.equal(withHeUrls.length, 5);
  assert.ok(withHeUrls.some((u) => u.includes("/he/projects/villa-x")));
});

// --- Inventory: reading vs. emitting decision, documented per call site ---

test("PagePower inventory's per-locale loops iterate PUBLIC_LOCALES (an emitted/served page set), not the full LOCALES", async () => {
  // Reading the module's source rather than calling getInventory() (which
  // hits Prisma/the DB — forbidden for this task's tests, which use fakes):
  // asserts the single-source decision documented on INVENTORY_LOCALES in
  // src/lib/seo/pagePower/inventory.ts is actually wired to PUBLIC_LOCALES,
  // not a re-introduced hard-coded array.
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/lib/seo/pagePower/inventory.ts"),
    "utf8",
  );
  assert.match(src, /import\s*\{\s*PUBLIC_LOCALES\s*\}\s*from\s*["']@\/lib\/locale["']/);
  assert.match(src, /const INVENTORY_LOCALES:.*=\s*PUBLIC_LOCALES/);
  assert.doesNotMatch(src, /\[\s*["']en["']\s*,\s*["']de["']\s*,\s*["']pl["']\s*,\s*["']ru["']\s*\]/);
});

test("the inventory's locale loop yields one entry per PUBLIC_LOCALES entry — five when he is public", () => {
  // Same shape as the FIXED_PAGES loop in inventory.ts (`for (const locale of
  // INVENTORY_LOCALES) for (const fixed of FIXED_PAGES) out.push(...)`),
  // exercised against parsePublicLocales directly since INVENTORY_LOCALES is
  // frozen at import time from this process's own env.
  const FIXED_PAGE_COUNT = 7; // matches FIXED_PAGES.length in inventory.ts
  const countFor = (raw: string | undefined) => parsePublicLocales(raw).length * FIXED_PAGE_COUNT;
  assert.equal(countFor(undefined), 4 * FIXED_PAGE_COUNT);
  assert.equal(countFor("en,de,pl,ru,he"), 5 * FIXED_PAGE_COUNT);
});

// --- The no-hard-coded-locale-array grep test (Global Constraint) ---
//
// Single source of locales: parsing uses LOCALES/isLocale, fan-out uses
// PUBLIC_LOCALES. No new hard-coded four-locale array/union anywhere in
// src/ — this walks every .ts/.tsx file (except this directory, which is
// allowed to name all five/four locales in assertions and fixtures) and
// fails on either shape, unconditionally. Nothing is whitelisted: a
// legitimate remaining hit must be rewritten to derive from LOCALES (see
// the CONTACT_ART_LOCALES fix in src/app/[lang]/blog/[slug]/page.tsx for the
// pattern), not excused here.

const SRC_ROOT = path.join(process.cwd(), "src");
const EXCLUDED_DIR = path.join(SRC_ROOT, "lib", "__tests__");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (full === EXCLUDED_DIR) continue;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Any spacing, either quote style, in this exact locale order.
const ARRAY_RE = /\[\s*["']en["']\s*,\s*["']de["']\s*,\s*["']pl["']\s*,\s*["']ru["']\s*\]/g;
// The union form, captured with whatever (if anything) follows so a `| "he"`
// suffix can be checked for and excluded.
const UNION_RE = /["']en["']\s*\|\s*["']de["']\s*\|\s*["']pl["']\s*\|\s*["']ru["']/g;

test("no new hard-coded [\"en\",\"de\",\"pl\",\"ru\"] array or \"en\"|\"de\"|\"pl\"|\"ru\" union outside src/lib/__tests__/", () => {
  const offenders: string[] = [];
  for (const file of walk(SRC_ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(process.cwd(), file);

    for (const m of Array.from(text.matchAll(ARRAY_RE))) {
      offenders.push(`${rel}: array literal ${JSON.stringify(m[0])}`);
    }
    for (const m of Array.from(text.matchAll(UNION_RE))) {
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 20);
      if (/^\s*\|\s*["']he["']/.test(after)) continue; // followed by | "he" — allowed
      offenders.push(`${rel}: union type ${JSON.stringify(m[0])} not followed by | "he"`);
    }
  }
  assert.deepEqual(offenders, []);
});

// Sanity check on the grep helpers themselves, so a bug in the test can't
// silently pass by never matching anything.
test("the grep helper actually matches the shapes it is meant to catch", () => {
  const arraySample = 'const locales: Locale[] = ["en", "de", "pl", "ru"] as Locale[];';
  assert.equal(Array.from(arraySample.matchAll(ARRAY_RE)).length, 1);
  const unionSampleBad = 'type Lang = "en" | "de" | "pl" | "ru";';
  assert.equal(Array.from(unionSampleBad.matchAll(UNION_RE)).length, 1);
  const unionSampleOk = 'type Lang = "en" | "de" | "pl" | "ru" | "he";';
  const m = Array.from(unionSampleOk.matchAll(UNION_RE))[0];
  assert.ok(m);
  const after = unionSampleOk.slice(m.index! + m[0].length, m.index! + m[0].length + 20);
  assert.match(after, /^\s*\|\s*["']he["']/);
});

// Confirms LOCALES itself stays the one place all five are declared together.
test("LOCALES is the exhaustive single source", () => {
  assert.deepEqual([...LOCALES], ["en", "de", "pl", "ru", "he"]);
});
