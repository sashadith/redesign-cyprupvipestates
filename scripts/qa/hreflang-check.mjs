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
//   - (identity checks above compare PATHS ONLY — every canonical/hreflang
//     URL the app emits is absolute against the hard-coded SITE_URL,
//     src/lib/seo.ts:11, regardless of which host actually served the
//     page, so comparing full URL strings against `host + path` fails on
//     every non-production host; see the C1 fix note on `samePath`/
//     `classifyOrigin` below. The origin itself is checked separately,
//     informationally, and only FAILS a pair when it is neither the
//     sampled host nor the configured production origin — override with
//     `--canonical-origin <origin>`.)
//   - the HE page's `og:locale` meta is "he_IL"
//   - `robots` is noindex ONLY on /he/blog* (Phase 6 borrowed-content index)
//     or on a non-2xx (404/gated) page — every other HE/EN page must be
//     indexable
//   - every JSON-LD `inLanguage` value found on the HE page is "he-IL"
//
// Usage:
//   node scripts/qa/hreflang-check.mjs <host> [--json] [--canonical-origin <origin>]
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
//   --canonical-origin <origin>  The app's configured production origin
//           (default: https://cyprusvipestates.com, i.e. SITE_URL —
//           src/lib/seo.ts:11). Every canonical/hreflang URL the app emits
//           is absolute against this origin regardless of the sampled
//           host (see C1 in the identity-checks list above) — this is
//           what the informational ORIGIN column is checked against.
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

// C1 fix: every canonical/hreflang URL the app emits is absolute against a
// single hard-coded origin (`SITE_URL` in src/lib/seo.ts:11 — the comment
// there says so explicitly), not against whatever host actually served the
// page. This constant mirrors that value (not imported — this is a plain
// .mjs network sampler and seo.ts is TypeScript; keep the two in sync by
// hand) and is only the DEFAULT for `--canonical-origin` — never hard-coded
// into the identity checks themselves.
export const PRODUCTION_ORIGIN = "https://cyprusvipestates.com";

function originOf(url) {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function pathOf(url) {
  if (typeof url !== "string") return null;
  try {
    const p = new URL(url).pathname;
    return p.length > 1 ? p.replace(/\/+$/, "") : p; // normalise a trailing slash, keep bare "/"
  } catch {
    return null;
  }
}

/** Compare two absolute URLs (or a URL and any string) by PATHNAME only,
 *  ignoring origin and a trailing slash. `xDefault`/`reciprocal`/
 *  `canonicalSelf` all used to compare full URL strings against
 *  `host + path`, which fails the instant the fetched host differs from
 *  the app's hard-coded SITE_URL (i.e. every run against staging) — see
 *  C1. Null/undefined/unparseable input reads as "doesn't match" (false),
 *  not a thrown error, so a missing alternate still fails the check
 *  instead of crashing the sampler. */
export function samePath(a, b) {
  const pa = pathOf(a);
  const pb = pathOf(b);
  return pa !== null && pb !== null && pa === pb;
}

/** Classify a page's canonical origin as "matches host" (the origin that
 *  actually served the page — correct on any host, staging included),
 *  "production" (the app's hard-coded `SITE_URL`/`canonicalOrigin` — also
 *  correct, since every canonical/hreflang URL the app emits is pinned
 *  there regardless of which host served the page), or a genuine mismatch
 *  (anything else — e.g. a stray third-party domain, which the samePath()
 *  fix above would otherwise mask since it only looks at the path). This
 *  is what keeps the C1 fix from also hiding a real cross-origin bug. */
function classifyOrigin(canonical, hostOrigin, canonicalOrigin) {
  const o = originOf(canonical);
  if (o === null) return { ok: false, label: "missing" };
  if (o === hostOrigin) return { ok: true, label: "matches host" };
  if (o === canonicalOrigin) return { ok: true, label: "production" };
  return { ok: false, label: `unexpected (${o})` };
}

const HE_BLOG_RE = /\/he\/blog(\/|$|\?)/;

/** Assert the full head-signal contract for one EN/HE pair, given two
 *  already-parsed `parsePage()` results. Pure — no I/O. Returns
 *  `{ ok, checks, issues }`; `checks` names each individual assertion
 *  (`null` when a 404/error on either side made it inapplicable) so a
 *  caller can render a table without re-deriving pass/fail per column. */
export function assertPair(en, he, { canonicalOrigin = PRODUCTION_ORIGIN } = {}) {
  const issues = [];
  const enOk = en.status >= 200 && en.status < 300;
  const heOk = he.status >= 200 && he.status < 300;
  const checks = {
    enOk,
    heOk,
    xDefault: null,
    reciprocal: null,
    canonicalSelf: null,
    origin: null,
    ogLocale: null,
    robots: null,
    inLanguage: null,
  };
  let originLabel = null;

  if (!enOk) issues.push(`en ${en.url} returned ${en.status}`);
  if (!heOk) issues.push(`he ${he.url} returned ${he.status}`);

  if (enOk && heOk) {
    // C1 fix: PATH-only comparison (samePath) — the app's canonical/
    // hreflang URLs are absolute against SITE_URL, not the fetched host,
    // so comparing full URL strings against `en.url`/`he.url` failed on
    // every non-production host. The origin itself is checked separately
    // below (checks.origin), so a genuinely wrong domain still fails.
    checks.xDefault = samePath(en.alternates["x-default"], en.url) && samePath(he.alternates["x-default"], en.url);
    if (!checks.xDefault) {
      issues.push(
        `x-default should be ${en.url} (en saw ${en.alternates["x-default"] ?? "none"}, he saw ${he.alternates["x-default"] ?? "none"})`,
      );
    }

    checks.reciprocal = samePath(en.alternates["he"], he.url) && samePath(he.alternates["en"], en.url);
    if (!checks.reciprocal) {
      issues.push(
        `reciprocity failed (en's "he" alternate: ${en.alternates["he"] ?? "none"}, he's "en" alternate: ${he.alternates["en"] ?? "none"})`,
      );
    }

    checks.canonicalSelf = samePath(en.canonical, en.url) && samePath(he.canonical, he.url);
    if (!checks.canonicalSelf) {
      issues.push(`canonical not self-referencing (en: ${en.canonical ?? "none"}, he: ${he.canonical ?? "none"})`);
    }

    // Informational-but-real check: the canonical's ORIGIN must be either
    // the host we actually sampled (correct on staging or production) or
    // the app's configured production origin (also correct — see the
    // header comment). Anything else is a genuine bug that samePath()
    // above would otherwise mask.
    const hostOrigin = originOf(en.url);
    const enOrigin = classifyOrigin(en.canonical, hostOrigin, canonicalOrigin);
    const heOrigin = classifyOrigin(he.canonical, hostOrigin, canonicalOrigin);
    checks.origin = enOrigin.ok && heOrigin.ok;
    originLabel = enOrigin.label === heOrigin.label ? enOrigin.label : `en: ${enOrigin.label}, he: ${heOrigin.label}`;
    if (!checks.origin) {
      issues.push(
        `canonical origin unexpected (en: ${enOrigin.label}, he: ${heOrigin.label}) — want either the sampled host (${hostOrigin}) or production (${canonicalOrigin})`,
      );
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
  return { ok, checks, issues, originLabel };
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
  const opts = { host: "", json: false, canonicalOrigin: PRODUCTION_ORIGIN };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--canonical-origin") {
      const value = argv[++i];
      if (!value) throw new Error("--canonical-origin requires a value, e.g. --canonical-origin https://cyprusvipestates.com");
      opts.canonicalOrigin = value.replace(/\/+$/, "");
    } else if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
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
    console.error("Usage: node scripts/qa/hreflang-check.mjs <host> [--json] [--canonical-origin <origin>]");
    process.exitCode = 1;
    return;
  }

  if (!opts.host) {
    console.error("Usage: node scripts/qa/hreflang-check.mjs <host> [--json] [--canonical-origin <origin>]");
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
    const { ok, checks, issues, originLabel } = pair.unlocalized
      ? assertUnlocalizedPair(en, he)
      : assertPair(en, he, { canonicalOrigin: opts.canonicalOrigin });
    rows.push({ type: pair.type, en, he, ok, checks, issues, originLabel, unlocalized: !!pair.unlocalized });
  }

  const failedCount = rows.filter((r) => !r.ok).length;

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`host: ${opts.host}`);
    console.log(`${rows.length} pairs checked, ${rows.length - failedCount} passed, ${failedCount} failed\n`);
    console.log(
      "STATUS  TYPE".padEnd(28) + "EN   HE   ALT  XDEF CANON ORIGIN         OG   ROBOTS INLANG",
    );
    for (const r of rows) {
      const label = `${r.ok ? "PASS" : "FAIL"}  ${r.type}`.padEnd(28);
      if (r.unlocalized) {
        // Different contract (see assertUnlocalizedPair) — the generic
        // ALT/XDEF/CANON/ORIGIN/OG/ROBOTS/INLANG columns don't apply.
        console.log(
          `${label}${String(r.en.status).padEnd(5)}${String(r.he.status).padEnd(5)}` +
            `(unlocalized: no "he" alternate + 404 expected)`,
        );
      } else {
        // ORIGIN is informational (shows "matches host" / "production" /
        // the mismatch label from classifyOrigin) — see the C1 fix note
        // above assertPair. It still counts toward checks.origin/`ok`.
        console.log(
          `${label}${String(r.en.status).padEnd(5)}${String(r.he.status).padEnd(5)}` +
            `${statusCell(r.checks.reciprocal)}  ${statusCell(r.checks.xDefault)}  ` +
            `${statusCell(r.checks.canonicalSelf)}  ${(r.originLabel ?? "-").padEnd(14)} ` +
            `${statusCell(r.checks.ogLocale)}  ` +
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
