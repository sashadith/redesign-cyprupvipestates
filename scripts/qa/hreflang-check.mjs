#!/usr/bin/env node
// Hebrew localization Phase 8 (Task 3) — hreflang / og:locale / robots /
// JSON-LD `inLanguage` sampler. Fetches an EN<->HE URL-pair list with plain
// `fetch()` (no browser — same house rule as rtl-matrix.mjs, whose page list
// this reuses) and asserts the head-signal contract every localized page is
// supposed to carry:
//
//   - x-default hreflang points at the EN url on both pages of a pair
//   - the EN page lists a `he` alternate pointing at the HE url and vice
//     versa (reciprocity)
//   - each page's own canonical is self-referencing
//   - the HE page's `og:locale` meta is "he_IL"
//   - `robots` is noindex ONLY on /he/blog* (Phase 6 borrowed-content index)
//     or on a non-2xx (404/gated) page — every other HE/EN page must be
//     indexable
//   - every JSON-LD `inLanguage` value found on the HE page is "he-IL"
//
// Usage:
//   node scripts/qa/hreflang-check.mjs <host> [--json]
//
// <host>   Origin to check, e.g. https://design.cyprusvipestates.com. This
//          is a live network sampler (not a unit test) — point it at a
//          staging host with NEXT_PUBLIC_LIVE_LOCALES including "he" (see
//          docs/i18n/acceptance/). Against a host where `he` is gated,
//          every /he/* row will show 404 and the pair will FAIL — that is
//          the correct, intended signal ("he" is not launch-ready there),
//          not a bug in this script.
//   --json  Print the full per-pair result array as JSON instead of the
//           text table (exit code is unaffected).
//
// Exit code: 0 if every pair passes every check, 1 otherwise (including "no
// host given" and any pair with a non-200 EN or HE fetch).
//
// Pure parser/assertion helpers (buildUrlPairs, parseHreflangAlternates,
// parseCanonical, parseMetaContent, parseOgLocale, parseRobots,
// parseJsonLdInLanguages, assertPair) are exported for
// scripts/qa/__tests__/hreflang-check.test.mjs — only main() below performs
// any I/O.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPages, DEFAULTS } from "./rtl-matrix.mjs";

// The 17 keyword-driven he landing slugs from docs/i18n/he-keyword-map.md §4
// (row 17, "limassol/investment-apartments", is explicitly "Welle 2 —
// optional, nur bauen wenn Seite 6 nicht rankt" in that doc, so it may not
// be deployed yet; a 404 for that one row is expected until it ships, not a
// bug in this script). Kept as a flat list, not derived from any runtime
// source, because this IS the source: these slugs live in Sanity/Prisma
// content rows, not in code.
export const LANDING_SLUGS = [
  "real-estate-cyprus",
  "apartments-for-sale-cyprus",
  "property-investment-cyprus",
  "property-prices-cyprus",
  "limassol",
  "limassol/new-projects",
  "paphos",
  "paphos/apartments",
  "paphos/villas",
  "villas-cyprus",
  "seafront-villas-cyprus",
  "houses-for-sale-cyprus",
  "buying-property-in-cyprus",
  "relocation-cyprus",
  "permanent-residency-cyprus",
  "property-tax-cyprus",
  "limassol/investment-apartments",
];

// One pair per remaining listing type the plan calls out that rtl-matrix's
// own list doesn't already cover (rtl-matrix has home/projects/project/
// developers/blog/about/contacts/faq/privacy/case-study/landing/404 — see
// buildPages() there). rtl-matrix's "case-study" type is a single DETAIL
// page; "case-studies" here is the plural LISTING. "terms" has no rtl-matrix
// equivalent at all.
const EXTRA_TYPE_PAGES = [
  { type: "case-studies", en: "/case-studies", he: "/he/case-studies" },
  { type: "terms", en: "/terms-and-conditions", he: "/he/terms-and-conditions" },
];

// Partners (decision J, spec §4.4/§8) is the opposite shape from every pair
// above: it's a Task 3 Critical fix regression guard, not a normal
// localized pair. The EN page must carry NO `he` hreflang alternate (that
// alternate is exactly what pointed a Hebrew URL at English-fallback
// content before the fix) and `/he/partners` must 404, not 200. `unlocalized`
// routes these through assertUnlocalizedPair() below instead of assertPair().
const UNLOCALIZED_TYPE_PAGES = [
  { type: "partners", en: "/partners", he: "/he/partners", unlocalized: true },
];

/** The full EN<->HE URL-pair list this sampler checks: rtl-matrix.mjs's own
 *  page-type list (minus its synthetic "404" row, which has no hreflang/
 *  canonical/JSON-LD to assert on) + the two extra listing types above +
 *  the deliberately-unlocalized pair(s) + the 17 keyword landing slugs. Bare
 *  site-relative paths — the caller prepends `host`. */
export function buildUrlPairs() {
  const base = buildPages(DEFAULTS).filter((p) => p.type !== "404");
  const landing = LANDING_SLUGS.map((slug) => ({
    type: `landing:${slug}`,
    en: `/${slug}`,
    he: `/he/${slug}`,
  }));
  const seen = new Set();
  const out = [];
  for (const p of [...base, ...EXTRA_TYPE_PAGES, ...UNLOCALIZED_TYPE_PAGES, ...landing]) {
    if (seen.has(p.en)) continue; // rtl-matrix's default "landing" slug and
    seen.add(p.en); // the 17 keyword slugs don't collide today, but a
    out.push(p); // future default change shouldn't produce a duplicate row.
  }
  return out;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** `{ hreflang: href }` for every `<link rel="alternate" hreflang=...>` tag —
 *  attribute order/quoting agnostic (Next.js renders double quotes, but this
 *  doesn't assume it). */
export function parseHreflangAlternates(html) {
  const out = {};
  const linkRe = /<link\b[^>]*\brel=["']alternate["'][^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    const hreflang = tag.match(/\bhreflang=["']([^"']+)["']/i)?.[1];
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (hreflang && href) out[hreflang] = decodeHtmlEntities(href);
  }
  return out;
}

/** `href` of `<link rel="canonical">`, or null. */
export function parseCanonical(html) {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  const href = tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  return href ? decodeHtmlEntities(href) : null;
}

/** `content` of `<meta {attr}="{name}" content="...">` (attr: "name" or
 *  "property"), or null. Attribute-order agnostic. */
export function parseMetaContent(html, name, attr = "name") {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${escaped}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1];
  return content !== undefined ? decodeHtmlEntities(content) : null;
}

export function parseOgLocale(html) {
  return parseMetaContent(html, "og:locale", "property");
}

export function parseRobotsMeta(html) {
  return parseMetaContent(html, "robots", "name");
}

function collectInLanguage(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collectInLanguage(n, out);
  } else if (node && typeof node === "object") {
    if (typeof node.inLanguage === "string") out.push(node.inLanguage);
    for (const v of Object.values(node)) collectInLanguage(v, out);
  }
}

/** Every `inLanguage` value found in any `<script type="application/ld+json">`
 *  block on the page (recursing into nested objects/arrays — schema.org
 *  nesting varies per emitter). Empty array if there's no JSON-LD, or none
 *  of it declares `inLanguage` — callers treat that as "nothing to assert",
 *  not a failure (plenty of legitimate schema, e.g. BreadcrumbList, never
 *  carries the field). Malformed JSON-LD blocks are skipped, not thrown. */
export function parseJsonLdInLanguages(html) {
  const out = [];
  const scriptRe = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    collectInLanguage(data, out);
  }
  return out;
}

/** Parse every signal this sampler cares about out of one fetched page's
 *  `html` into the shape `assertPair` consumes. `url`/`status` are passed
 *  through from the caller's fetch (or supplied directly by a test fixture
 *  without ever calling fetch). */
export function parsePage(url, status, html, robotsHeader) {
  return {
    url,
    status,
    alternates: parseHreflangAlternates(html),
    canonical: parseCanonical(html),
    ogLocale: parseOgLocale(html),
    robots: parseRobotsMeta(html) ?? robotsHeader ?? null,
    inLanguage: parseJsonLdInLanguages(html),
  };
}

const HE_BLOG_RE = /\/he\/blog(\/|$|\?)/;

/** Assert the full head-signal contract for one EN/HE pair, given two
 *  already-parsed `parsePage()` results. Pure — no I/O. Returns
 *  `{ ok, checks, issues }`; `checks` names each individual assertion
 *  (`null` when a 404/error on either side made it inapplicable) so a
 *  caller can render a table without re-deriving pass/fail per column. */
export function assertPair(en, he) {
  const issues = [];
  const enOk = en.status >= 200 && en.status < 300;
  const heOk = he.status >= 200 && he.status < 300;
  const checks = {
    enOk,
    heOk,
    xDefault: null,
    reciprocal: null,
    canonicalSelf: null,
    ogLocale: null,
    robots: null,
    inLanguage: null,
  };

  if (!enOk) issues.push(`en ${en.url} returned ${en.status}`);
  if (!heOk) issues.push(`he ${he.url} returned ${he.status}`);

  if (enOk && heOk) {
    checks.xDefault = en.alternates["x-default"] === en.url && he.alternates["x-default"] === en.url;
    if (!checks.xDefault) {
      issues.push(
        `x-default should be ${en.url} (en saw ${en.alternates["x-default"] ?? "none"}, he saw ${he.alternates["x-default"] ?? "none"})`,
      );
    }

    checks.reciprocal = en.alternates["he"] === he.url && he.alternates["en"] === en.url;
    if (!checks.reciprocal) {
      issues.push(
        `reciprocity failed (en's "he" alternate: ${en.alternates["he"] ?? "none"}, he's "en" alternate: ${he.alternates["en"] ?? "none"})`,
      );
    }

    checks.canonicalSelf = en.canonical === en.url && he.canonical === he.url;
    if (!checks.canonicalSelf) {
      issues.push(`canonical not self-referencing (en: ${en.canonical ?? "none"}, he: ${he.canonical ?? "none"})`);
    }

    checks.ogLocale = he.ogLocale === "he_IL";
    if (!checks.ogLocale) issues.push(`og:locale on ${he.url} is ${he.ogLocale ?? "missing"}, want he_IL`);

    const wantNoindex = HE_BLOG_RE.test(he.url);
    const isNoindex = /noindex/i.test(he.robots ?? "");
    checks.robots = wantNoindex ? isNoindex : !isNoindex;
    if (!checks.robots) {
      issues.push(
        wantNoindex
          ? `${he.url} should be noindex (borrowed-content blog, Phase 6) but robots=${he.robots ?? "none"}`
          : `${he.url} should be indexable but robots=${he.robots ?? "none"}`,
      );
    }

    if (he.inLanguage.length > 0) {
      checks.inLanguage = he.inLanguage.every((v) => v === "he-IL");
      if (!checks.inLanguage) issues.push(`inLanguage on ${he.url}: [${he.inLanguage.join(", ")}], want he-IL`);
    } else {
      checks.inLanguage = true; // no JSON-LD on this page — nothing to assert
    }
  }

  const ok = Object.values(checks).every((v) => v === true);
  return { ok, checks, issues };
}

/** Assert the special-case contract for a pair the spec deliberately keeps
 *  unlocalized in one locale (today: `/partners`, decision J) — the inverse
 *  of `assertPair`'s "must be reciprocal and indexable" contract. Two
 *  checks, both load-bearing regression guards for the Task 3 Critical bug:
 *
 *    - the EN (or other offered-locale) page must carry NO hreflang
 *      alternate for `locale` at all — not just "not reciprocal": an
 *      alternate present but pointing at English-fallback content was
 *      exactly the bug, and a present-but-wrong alternate would slip past a
 *      simple "is it reciprocal" check.
 *    - the localized URL must 404 — not 200 with borrowed English copy.
 *
 *  Pure — no I/O, same shape as `assertPair` (`{ ok, checks, issues }`) so
 *  the caller can treat both uniformly. */
export function assertUnlocalizedPair(en, he, { locale = "he" } = {}) {
  const issues = [];
  const enOk = en.status >= 200 && en.status < 300;
  const checks = {
    enOk,
    heIs404: he.status === 404,
    noHeAlternate: !Object.prototype.hasOwnProperty.call(en.alternates, locale),
  };

  if (!enOk) issues.push(`en ${en.url} returned ${en.status}`);
  if (!checks.heIs404) {
    issues.push(`${he.url} should 404 (not offered in "${locale}", decision J) but returned ${he.status}`);
  }
  if (!checks.noHeAlternate) {
    issues.push(
      `${en.url} must not carry a "${locale}" hreflang alternate (found ${en.alternates[locale]}) — this route is deliberately unlocalized in "${locale}" (decision J)`,
    );
  }

  const ok = Object.values(checks).every((v) => v === true);
  return { ok, checks, issues };
}

// ---------------------------------------------------------------------------
// I/O — everything below this line touches the network or process.argv/exit.

function parseArgs(argv) {
  const opts = { host: "", json: false };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    else if (!opts.host) opts.host = arg.replace(/\/+$/, "");
    else throw new Error(`Unexpected extra argument: ${arg}`);
  }
  return opts;
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const html = await res.text();
    return parsePage(url, res.status, html, res.headers.get("x-robots-tag"));
  } catch (err) {
    // status 0 reads as a failure in assertPair (enOk/heOk both require
    // 200-299) without needing a separate error path through the table.
    return { ...parsePage(url, 0, "", null), error: String(err?.message ?? err) };
  }
}

function statusCell(check) {
  if (check === null) return " - ";
  return check ? "ok " : "FAIL";
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error("Usage: node scripts/qa/hreflang-check.mjs <host> [--json]");
    process.exitCode = 1;
    return;
  }

  if (!opts.host) {
    console.error("Usage: node scripts/qa/hreflang-check.mjs <host> [--json]");
    console.error("Example: node scripts/qa/hreflang-check.mjs https://design.cyprusvipestates.com");
    process.exitCode = 1;
    return;
  }

  const pairs = buildUrlPairs();
  const rows = [];
  for (const pair of pairs) {
    const enUrl = opts.host + pair.en;
    const heUrl = opts.host + pair.he;
    const [en, he] = await Promise.all([fetchPage(enUrl), fetchPage(heUrl)]);
    const { ok, checks, issues } = pair.unlocalized ? assertUnlocalizedPair(en, he) : assertPair(en, he);
    rows.push({ type: pair.type, en, he, ok, checks, issues, unlocalized: !!pair.unlocalized });
  }

  const failedCount = rows.filter((r) => !r.ok).length;

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`host: ${opts.host}`);
    console.log(`${rows.length} pairs checked, ${rows.length - failedCount} passed, ${failedCount} failed\n`);
    console.log(
      "STATUS  TYPE".padEnd(28) + "EN   HE   ALT  XDEF CANON OG   ROBOTS INLANG",
    );
    for (const r of rows) {
      const label = `${r.ok ? "PASS" : "FAIL"}  ${r.type}`.padEnd(28);
      if (r.unlocalized) {
        // Different contract (see assertUnlocalizedPair) — the generic
        // ALT/XDEF/CANON/OG/ROBOTS/INLANG columns don't apply.
        console.log(
          `${label}${String(r.en.status).padEnd(5)}${String(r.he.status).padEnd(5)}` +
            `(unlocalized: no "he" alternate + 404 expected)`,
        );
      } else {
        console.log(
          `${label}${String(r.en.status).padEnd(5)}${String(r.he.status).padEnd(5)}` +
            `${statusCell(r.checks.reciprocal)}  ${statusCell(r.checks.xDefault)}  ` +
            `${statusCell(r.checks.canonicalSelf)}  ${statusCell(r.checks.ogLocale)}  ` +
            `${statusCell(r.checks.robots)}   ${statusCell(r.checks.inLanguage)}`,
        );
      }
      if (!r.ok) for (const issue of r.issues) console.log(`        - ${issue}`);
    }
  }

  if (failedCount > 0) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
