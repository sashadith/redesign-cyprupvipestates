// Pure helpers behind the Hebrew content-pack gate (scripts/qa/he-content-check.mjs)
// and, later, the EN→HE translation queue (src/lib/heStyleRules.ts — Task 7
// asserts STYLE_RULES here equals a TS copy of the same list byte-for-byte).
// No I/O, no DB, no imports beyond the standard library — safe to unit-test
// directly and safe to reuse from anything that only has a JSON blob in hand.
//
// Hebrew localization Phase 5, Task 1 (docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md).

// Same range src/lib/ai/localeTextGuards.ts uses for `hasHebrew` — kept as a
// literal copy here rather than an import so this file stays self-contained
// (plain .mjs, no TS, no src/ imports — same convention every scripts/*.mjs
// file in this repo follows).
export const HEBREW_RE = /[֐-׿]/;

function hasHebrewScript(s) {
  return HEBREW_RE.test(s);
}

/** True if `s` contains any Unicode letter (Latin, Hebrew, Cyrillic, …) — used
 *  to tell "this EN string actually has translatable prose" apart from a
 *  string that's just digits/punctuation/emoji, which the Hebrew side is
 *  allowed to leave untouched (e.g. a literal "2026" or "€"). */
function hasAnyLetters(s) {
  return /\p{L}/u.test(s);
}

// Fields that carry structure, not prose: they must be IDENTICAL between the
// EN source and the HE file, never "translated". Covers Sanity/portable-text
// plumbing (_key ties an EN block to its HE mirror one-to-one; _type/style/
// listItem/level are block-shape, not content; marks is the list of markDef
// keys applied to a span, not text) and literal link/asset fields (url, slug,
// href, _ref) that must keep pointing at the same place.
const IDENTICAL_KEYS = new Set(["_key", "_ref", "_type", "id", "url", "slug", "href", "link", "linkDestination", "marks", "style", "listItem", "level"]);

// Link-carrying keys may differ from EN only by the locale prefix rewrite
// (`/en/x` → `/he/x`, `/x` → `/he/x`, absolute site URLs likewise) — the
// Hebrew page must point at the Hebrew page, and linkCheck validates the target.
const LINK_KEYS = new Set(["url", "href", "link", "linkDestination"]);
// Site documents name their link fields freely (agreementLinkDestination,
// buttonUrl, ctaHref…): anything ending in one of these suffixes is a link.
export const isLinkKey = (k) => LINK_KEYS.has(k) || /(destination|url|href|link)$/i.test(k);
export function isHeLinkRewrite(en, he) {
  if (typeof en !== "string" || typeof he !== "string") return false;
  const strip = (u) => u.replace(/^https?:\/\/(www\.)?cyprusvipestates\.com/, "");
  const e = strip(en);
  const h = strip(he);
  if (!e.startsWith("/") || !h.startsWith("/he")) return false;
  const bare = e.replace(/^\/en(?=\/|$)/, "");
  const expected = "/he" + (bare === "" ? "" : bare.startsWith("/") ? bare : "/" + bare);
  return h === expected || h.replace(/\/$/, "") === expected.replace(/\/$/, "");
}

function identicalEqual(a, b) {
  if (a === b) return true;
  if (a != null && b != null && typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Structural diff between an EN source value and its HE counterpart.
 * Returns a list of human-readable violation strings (empty = clean).
 *
 * Checks: same keys (no missing/extra), same array lengths, same `_type`s,
 * same portable-text block/mark structure (via IDENTICAL_KEYS above), string
 * fields non-empty and containing Hebrew script wherever the EN string had
 * letters, and every IDENTICAL_KEYS field byte-identical between EN and HE.
 */
export function mirrorCheck(enValue, heValue, path = "", stats = null) {
  const violations = [];
  const label = path || "(root)";

  if (enValue == null && heValue == null) return violations;
  if (enValue == null || heValue == null) {
    violations.push(`${label}: presence mismatch (en=${enValue == null ? "missing" : "present"}, he=${heValue == null ? "missing" : "present"})`);
    return violations;
  }

  const enIsArray = Array.isArray(enValue);
  const heIsArray = Array.isArray(heValue);
  if (enIsArray || heIsArray) {
    if (!enIsArray || !heIsArray) {
      violations.push(`${label}: type mismatch (array vs non-array)`);
      return violations;
    }
    if (enValue.length !== heValue.length) {
      violations.push(`${label}: array length mismatch (en=${enValue.length}, he=${heValue.length})`);
      return violations;
    }
    enValue.forEach((v, i) => {
      violations.push(...mirrorCheck(v, heValue[i], path ? `${path}[${i}]` : `[${i}]`, stats));
    });
    return violations;
  }

  if (typeof enValue === "object" && typeof heValue === "object") {
    const enKeys = Object.keys(enValue);
    const heKeySet = new Set(Object.keys(heValue));
    const enKeySet = new Set(enKeys);
    for (const k of enKeys) {
      if (!heKeySet.has(k)) violations.push(`${path ? `${path}.${k}` : k}: missing key in he`);
    }
    for (const k of heKeySet) {
      if (!enKeySet.has(k)) violations.push(`${path ? `${path}.${k}` : k}: extra key in he (not present in en)`);
    }
    for (const k of enKeys) {
      if (!heKeySet.has(k)) continue;
      const childPath = path ? `${path}.${k}` : k;
      // `listItem` is a layout token ("bullet"/"number") on portable-text
      // blocks but a TEXT field on the homepage's ListItem objects.
      // Link fields may be retargeted to the matching Hebrew page (the EN
      // landing slugs differ from the Hebrew pack's); linkCheck enforces the
      // he allow-list on the target, so no identity or Hebrew is required here.
      if (isLinkKey(k) && typeof enValue[k] === "string" && typeof heValue[k] === "string") continue;
      const isLayoutListItem = k === "listItem" && (enValue[k] === "bullet" || enValue[k] === "number");
      if (IDENTICAL_KEYS.has(k) && (k !== "listItem" || isLayoutListItem)) {
        if (!identicalEqual(enValue[k], heValue[k])) {
          violations.push(`${childPath}: must be identical between en/he (en=${JSON.stringify(enValue[k])}, he=${JSON.stringify(heValue[k])})`);
        }
        continue;
      }
      violations.push(...mirrorCheck(enValue[k], heValue[k], childPath, stats));
    }
    return violations;
  }

  if (typeof enValue !== typeof heValue) {
    violations.push(`${label}: type mismatch (en=${typeof enValue}, he=${typeof heValue})`);
    return violations;
  }

  if (typeof enValue === "number" || typeof enValue === "boolean") {
    if (enValue !== heValue) violations.push(`${label}: must be identical (en=${enValue}, he=${heValue})`);
    return violations;
  }

  if (typeof enValue === "string") {
    // An empty EN string (spacer spans, blank subtitles) may stay empty in HE.
    if (!enValue.trim()) return violations;
    if (!heValue.trim()) {
      violations.push(`${label}: he value is empty`);
    } else if (enValue === heValue || heValue === enValue.replace(/\bEN\b/g, "HE")) {
      // Deliberately kept identical (enum values, layout tokens, person and
      // developer names, language strings the code maps itself). Not a
      // violation, but counted so the gate can print how much of a file was
      // left untranslated — a whole-file "kept" count is a red flag a human
      // reads, a per-string one is noise.
      if (hasAnyLetters(enValue) && stats) stats.keptIdentical.push(label);
    } else if (hasAnyLetters(enValue) && !hasHebrewScript(heValue)) {
      violations.push(`${label}: en has letters but he has no Hebrew script (he="${heValue}")`);
    }
    return violations;
  }

  return violations;
}

// The style rules every Hebrew string in the content pack must pass. Kept as
// one exported array — id/test/message, `test` ALWAYS a regex literal (never
// a function) — so this list stays byte-identical (same ids, same regex
// sources, same order) with src/lib/heStyleRules.ts, the TS copy the AI
// translation queue (src/lib/ai/translateHe.ts) consumes.
// src/lib/__tests__/translateHe.test.ts enforces the parity by reading BOTH
// files as text and diffing their ids/regex sources — a rule added to one
// copy without the matching line in the other fails that test immediately.
// Sources: docs/i18n/he-styleguide.md §4/§7/§11 + the glossary's fixed
// spellings (see heStyleRules.ts's own header for the long version).
export const STYLE_RULES = [
  { id: "em-dash", test: /—/, message: "em dash is not used in Hebrew copy; use a comma, a period or a new sentence" },
  { id: "en-dash", test: /–/, message: "en dash is not used in Hebrew copy; use a comma, a period or a new sentence" },
  { id: "exclamation-mark", test: /!/, message: "no exclamation marks (styleguide §11.7)" },
  { id: "curly-quotes", test: /[“”‘’]/, message: "no curly quotes; Hebrew copy uses the straight double quote" },
  {
    id: "slash-gender-form",
    test: /\/[תה](?![֐-׿])/,
    message: "slash gender form is a last resort (styleguide §11.1); use the nominal or plural-participle register",
  },
  { id: "hakol-spelling", test: /הכול/, message: "spelling: write the short form, not the plene one" },
  { id: "loading-gerund", test: /בטעינה/, message: "gerund evasion (styleguide §11.2); use a plural participle or an impersonal construction" },
  { id: "sending-gerund", test: /בשליחה/, message: "gerund evasion (styleguide §11.2); use a plural participle or an impersonal construction" },
  { id: "notary", test: /נוטריון/, message: "Cyprus has no notary in a property purchase (styleguide §7); the lawyer signs" },
  { id: "safe-room", test: /ממ"ד/, message: "Israeli safe-room term does not exist in Cyprus property copy" },
  { id: "construction-companies", test: /חברות בנייה/, message: "glossary term: use the developer wording, not the Israeli construction-company one" },
  {
    id: "nadlan-gershayim",
    test: /נדל[^"]?ן/,
    message: 'the real-estate noun is spelled with a straight double quote (נדל"ן), never with a gershayim or bare',
  },
];

/** Runs every STYLE_RULES entry against `str`, returning violation strings
 *  (empty = clean). `path` is prefixed onto each message for locating it. */
export function styleCheck(str, path = "") {
  const violations = [];
  const label = path || "(root)";
  for (const rule of STYLE_RULES) {
    if (rule.test.test(str)) violations.push(`${label}: ${rule.message}`);
  }
  return violations;
}

// Code routes that exist regardless of which landing-page slugs the pack
// defines — see docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md,
// Task 1 "Additional context" (linkCheck "code routes" allow-list).
const CODE_ROUTES = [
  /^\/he$/,
  /^\/he\/projects(\/.*)?$/,
  /^\/he\/blog(\/.*)?$/,
  /^\/he\/developers(\/.*)?$/,
  /^\/he\/about-us$/,
  /^\/he\/contacts$/,
  /^\/he\/faq$/,
  /^\/he\/case-studies(\/.*)?$/,
  /^\/he\/privacy-policy$/,
  /^\/he\/terms-and-conditions$/,
];

/**
 * Validates one href/url against the Hebrew content-pack link allow-list.
 * `packSlugs` is the list of Latin landing-page slugs this pack defines
 * (e.g. "limassol", "limassol/new-projects") — any `/he/<packSlug>` or
 * `/he/<packSlug>/...` is allowed in addition to the fixed code routes.
 * Returns null when the link is fine, or a violation string otherwise.
 */
export function linkCheck(href, packSlugs = []) {
  if (typeof href !== "string" || !href.trim()) return "empty or non-string href";

  if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  if (href.startsWith("https://wa.me/")) return null;
  // Filter links carry a query (`/he/projects?city=Paphos`); the allow-list
  // judges the path only.
  href = href.replace(/[?#].*$/, "");
  // Partners stays English (decision J) and must not surface as an EN-fallback
  // page under /he — the Hebrew chrome links the EN page explicitly.
  if (href === "/partners") return null;
  if (href === "https://cyprusvipestates.com/he" || href.startsWith("https://cyprusvipestates.com/he/")) return null;
  if (/^\/blog\/[^/]+\/?$/.test(href)) return null; // EN blog article, no /he prefix (decision C)

  if (/^\/(de|pl|ru)\//.test(href)) return `forbidden non-Hebrew locale link: ${href}`;
  if (/^\/en(\/|$)/.test(href)) return `forbidden bare /en link: ${href}`;

  for (const re of CODE_ROUTES) {
    if (re.test(href)) return null;
  }
  for (const slug of packSlugs) {
    if (href === `/he/${slug}` || href.startsWith(`/he/${slug}/`)) return null;
  }
  return `link not on the he allow-list: ${href}`;
}

const segmenter = new Intl.Segmenter("he", { granularity: "grapheme" });
function graphemeLength(s) {
  let n = 0;
  // eslint-disable-next-line no-unused-vars
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

const META_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 155;

/** Checks a `seo` object's metaTitle/title (<= 60 graphemes) and
 *  metaDescription (<= 155 graphemes), counted with Intl.Segmenter so Hebrew
 *  niqqud/ligatures don't overcount. Returns violation strings (empty = clean
 *  — including when `seo` itself is missing, which is a shape problem for
 *  mirrorCheck to catch, not a length problem for this function). */
export function metaCheck(seo) {
  const violations = [];
  if (!seo || typeof seo !== "object") return violations;

  const title = typeof seo.metaTitle === "string" ? seo.metaTitle : typeof seo.title === "string" ? seo.title : null;
  if (title != null) {
    const len = graphemeLength(title);
    if (len > META_TITLE_MAX) violations.push(`seo.metaTitle exceeds ${META_TITLE_MAX} graphemes (${len}): "${title}"`);
  }

  if (typeof seo.metaDescription === "string") {
    const len = graphemeLength(seo.metaDescription);
    if (len > META_DESCRIPTION_MAX) violations.push(`seo.metaDescription exceeds ${META_DESCRIPTION_MAX} graphemes (${len}): "${seo.metaDescription}"`);
  }

  return violations;
}

// Keys that carry structure/links rather than prose — skipped by walkStrings
// so callers don't run styleCheck (forbidden-punctuation etc.) against a
// _key/_ref/slug/url/href value, which is never meant to read as Hebrew text.
const NON_TEXT_KEYS = new Set(["_key", "_ref", "_type", "id", "url", "slug", "href", "link", "linkDestination", "marks"]);

/**
 * Walks every string leaf reachable from `json`, calling `fn(value, path)`
 * for each one — skipping NON_TEXT_KEYS fields (structure/links, not prose).
 * Arrays are walked by index (`path[i]`); objects by dotted key.
 */
export function walkStrings(json, fn, path = "") {
  if (json == null) return;
  if (typeof json === "string") {
    fn(json, path || "(root)");
    return;
  }
  if (Array.isArray(json)) {
    json.forEach((v, i) => walkStrings(v, fn, path ? `${path}[${i}]` : `[${i}]`));
    return;
  }
  if (typeof json === "object") {
    for (const k of Object.keys(json)) {
      if (NON_TEXT_KEYS.has(k)) continue;
      walkStrings(json[k], fn, path ? `${path}.${k}` : k);
    }
  }
}
