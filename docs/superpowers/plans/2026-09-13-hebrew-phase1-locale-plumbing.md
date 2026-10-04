# Hebrew Localization — Phase 1: Locale Plumbing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/he/*` technically reachable on staging (RTL `<html dir>`, Hebrew-capable fonts, locale-aware formats, valid Prisma enum) while production keeps answering 404 for `/he` and emits no hreflang/sitemap entries for Hebrew.

**Architecture:** `src/lib/locale.ts` becomes the single source of truth for locales and gains a second constant `PUBLIC_LOCALES` (env-gated) that drives everything visible to search engines and visitors (middleware locale set, `generateStaticParams`, hreflang, sitemaps, language switcher). `LOCALES` (all five) drives validation, admin and DB. Every hard-coded `["en","de","pl","ru"]` list and every `(de|pl|ru)` regex that this plan touches is replaced by an import or a generated pattern; copy tables that become exhaustive get a `he` placeholder equal to English, marked `TODO(he)` and counted by a QA script (target 0 before launch, Phase 4).

**Tech Stack:** Next.js 14.2 App Router, next-intl 3 (middleware only), Prisma 5 / PostgreSQL, Tailwind 3.4, node:test via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` (sections 3.1, 3.3, 3.4, 5 "Phase 1").

## Global Constraints

- Locale id is `he`; URL prefix `/he`; hreflang value `he`; BCP-47 for Intl is `he-IL`.
- English stays the prefix-less default; x-default stays English.
- Env var name for public locales: `NEXT_PUBLIC_LIVE_LOCALES` (comma-separated). Unset → every locale except those in `LAUNCH_GATED_LOCALES = ["he"]`. (The spec's draft name `NEXT_PUBLIC_PUBLIC_LOCALES` is replaced by this; update the spec in Task 13.)
- Hebrew slugs for corporate pages are Latin (decision A): `about-us`, `contacts`, `privacy-policy`, `terms-and-conditions`.
- Admin UI copy stays English; no Hebrew UI strings are written in this phase — placeholders only, each marked `// TODO(he)`.
- Never run a Prisma write or migration locally: `.env.local` points at production. Migrations are handed to the operator (Task 7).
- Never deploy to production. Staging deploy is `./scripts/deploy-staging.sh` from the repo root.
- Commit via an isolated worktree (`git worktree add -b feat/he-phase1-locale-plumbing <scratchpad>/wt-he1 origin/main`), stage explicit paths only, push with `git push origin HEAD`.
- `npm run build` must stay green after every task. Type errors from newly exhaustive `Record<Locale, …>` tables are fixed in the same task that causes them.

---

## File map

| File | Responsibility after this phase |
|---|---|
| `src/lib/locale.ts` (modify) | Single source: `LOCALES`, `PUBLIC_LOCALES`, `RTL_LOCALES`, `Locale` type, `localeDir`, `BCP47`, `LOCALE_LABELS`, `isLocale`, `isPublicLocale`, `nonDefaultLocalePattern`, `fmtPrice`, `fmtDate` |
| `src/lib/__tests__/locale.test.ts` (create) | Unit tests for the above |
| `package.json` (modify) | test glob covers `src/lib/__tests__` |
| `src/i18n.config.ts` (modify) | derives `languages`/`locales` from `PUBLIC_LOCALES` |
| `src/middleware.ts` (modify) | imports locales; generated regexes; `PUBLIC_LOCALES` for next-intl |
| `src/lib/corporatePageSlugs.ts` (modify) | `he` slugs; `CORPORATE_LOCALES` = `LOCALES` |
| `src/lib/seo.ts`, `src/app/sitemaps/[type]/route.ts` (modify) | iterate `PUBLIC_LOCALES` |
| `src/lib/nestedPageRedirects.json`, `src/lib/genNestedRedirects.mjs` (modify) | `he` key |
| 6 `generateStaticParams` sites, `src/sanity/sanity.utils.ts` (modify) | `PUBLIC_LOCALES` |
| `src/app/components/Header/navShared.tsx`, `src/app/[lang]/layout.tsx`, `src/lib/seo/templateClass.ts`, `src/lib/seo/urlCanonical.ts`, `src/lib/seo/pagePower/classVerdicts.ts` (modify) | generated locale regexes |
| `prisma/migrations/20260914100000_locale_add_he/`, `prisma/migrations/20260914100100_he_content_columns/`, `prisma/schema.prisma` (create/modify) | enum value + `descriptionHE`, `textHE` |
| 13 root layouts (modify) | `dir={localeDir(lang)}`; Hebrew font variables |
| `src/app/fonts/hebrew.ts` (create) | `frankRuhlLibre` (`--font-display-he`), `rubikHebrew` (`--font-body-he`) |
| 6 CSS files (modify) | font-family chains include `var(--font-display-he)` |
| `src/lib/formatMonthYear.ts`, `src/lib/crm/bookingMessages.ts`, `src/app/book/[token]/page.tsx`, `src/app/book/[token]/SlotPicker.tsx`, `src/app/components/ProjectsMapAll/ProjectsMapAll.tsx`, `src/app/components/PropertyMap/PropertyMap.tsx`, `src/app/preview-legal/[lang]/[doc]/page.tsx` (modify) | use `BCP47` |
| `src/app/api/{leads,email,roi-calculator,monday-newsletter}/route.ts`, `src/lib/mcp/tools/{createLeadInput,updateLead}.ts` (modify) | accept `he` via `LOCALES` |
| `src/lib/crm/presentationMessages.ts`, `src/lib/crm/bookingMessages.ts`, `src/lib/developmentSeo.ts`, `src/lib/developmentCopy.ts`, `src/app/c/[token]/copy.ts`, `src/app/book/[token]/copy.ts`, `src/app/preview-legal/[lang]/[doc]/registry.ts` (modify) | `Locale` from `@/lib/locale`; `he` placeholders |
| `scripts/qa/he-placeholders.mjs` (create) | counts `TODO(he)` markers |
| `scripts/qa/he-smoke.sh` (create) | curl checks against a host |
| `src/lib/ai/projectBrief.ts`, `ops/nginx/cyprusvipestates.conf`, `DEPLOYMENT.md`, `.env.example` (modify) | five locales; nginx prefix rule; env doc |

---

### Task 1: `src/lib/locale.ts` becomes the single source of truth

**Files:**
- Modify: `src/lib/locale.ts`
- Create: `src/lib/__tests__/locale.test.ts`
- Modify: `package.json:10`

**Interfaces:**
- Produces (all exported from `@/lib/locale`):
  - `LOCALES: readonly ["en","de","pl","ru","he"]`, `type Locale = (typeof LOCALES)[number]`
  - `DEFAULT_LOCALE = "en"`, `LAUNCH_GATED_LOCALES: readonly Locale[]`, `RTL_LOCALES: readonly Locale[]`
  - `PUBLIC_LOCALES: readonly Locale[]` (computed at module load from `process.env.NEXT_PUBLIC_LIVE_LOCALES`)
  - `parsePublicLocales(raw: string | undefined): Locale[]`
  - `isLocale(l: string): l is Locale`, `isPublicLocale(l: string): l is Locale`
  - `localeDir(l: string): "rtl" | "ltr"`
  - `BCP47: Record<Locale, string>`
  - `LOCALE_LABELS: Record<Locale, { code: string; name: string }>`
  - `nonDefaultLocalePattern(locales?: readonly string[]): string` → `"de|pl|ru|he"` (or `"de|pl|ru"` for PUBLIC_LOCALES on prod)
  - `fmtPrice(n: number, lang: string): string` → `"€450,000"` using `Intl.NumberFormat("en-US")` wrapped so RTL contexts isolate it: returns the plain string; callers wrap in `<bdi>` (Phase 2)
  - `fmtDate(iso: string | Date, lang: string, opts?: Intl.DateTimeFormatOptions): string`
  - existing `localePrefix`, `localizedHref` unchanged

- [ ] **Step 1: Extend the test runner glob**

In `package.json` replace the test script:

```json
"test": "node --import tsx --test src/lib/mcp/__tests__/*.test.ts src/lib/__tests__/*.test.ts"
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/locale.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCALES, DEFAULT_LOCALE, RTL_LOCALES, LAUNCH_GATED_LOCALES, BCP47, LOCALE_LABELS,
  parsePublicLocales, isLocale, localeDir, nonDefaultLocalePattern, localizedHref, fmtPrice, fmtDate,
} from "@/lib/locale";

test("he is a known locale, en stays default and prefix-less", () => {
  assert.deepEqual([...LOCALES], ["en", "de", "pl", "ru", "he"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.ok(isLocale("he"));
  assert.ok(!isLocale("xx"));
  assert.equal(localizedHref("he", "projects"), "/he/projects");
  assert.equal(localizedHref("en", "projects"), "/projects");
});

test("parsePublicLocales: unset → everything except launch-gated; set → exactly the listed known locales", () => {
  assert.deepEqual(parsePublicLocales(undefined), ["en", "de", "pl", "ru"]);
  assert.deepEqual([...LAUNCH_GATED_LOCALES], ["he"]);
  assert.deepEqual(parsePublicLocales("en,de,pl,ru,he"), ["en", "de", "pl", "ru", "he"]);
  assert.deepEqual(parsePublicLocales(" en , he "), ["en", "he"]);
  assert.deepEqual(parsePublicLocales("xx,de"), ["de"]);
  // the default locale can never be gated away
  assert.deepEqual(parsePublicLocales("de"), ["en", "de"]);
});

test("direction, BCP-47 and labels are exhaustive", () => {
  assert.deepEqual([...RTL_LOCALES], ["he"]);
  assert.equal(localeDir("he"), "rtl");
  assert.equal(localeDir("de"), "ltr");
  assert.equal(localeDir("junk"), "ltr");
  for (const l of LOCALES) {
    assert.ok(BCP47[l], `BCP47 missing for ${l}`);
    assert.ok(LOCALE_LABELS[l]?.code && LOCALE_LABELS[l]?.name, `label missing for ${l}`);
  }
  assert.equal(BCP47.he, "he-IL");
  assert.equal(LOCALE_LABELS.he.name, "עברית");
});

test("nonDefaultLocalePattern builds an alternation without the default locale", () => {
  assert.equal(nonDefaultLocalePattern(), "de|pl|ru|he");
  assert.equal(nonDefaultLocalePattern(["en", "de", "he"]), "de|he");
  const re = new RegExp(`^/(?:(${nonDefaultLocalePattern()})/)?faq$`);
  assert.equal(re.exec("/he/faq")?.[1], "he");
  assert.equal(re.exec("/faq")?.[1], undefined);
  assert.equal(re.exec("/xx/faq"), null);
});

test("fmtPrice and fmtDate", () => {
  assert.equal(fmtPrice(450000, "he"), "€450,000");
  assert.equal(fmtPrice(450000, "de"), "€450,000");
  assert.match(fmtDate("2026-05-01", "he", { year: "numeric", month: "long" }), /2026/);
  assert.equal(fmtDate("2026-05-01", "en", { year: "numeric", month: "long" }), "May 2026");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -20`
Expected: failures mentioning `RTL_LOCALES`/`parsePublicLocales` not exported.

- [ ] **Step 4: Implement `src/lib/locale.ts`**

Replace the file's constant block (keep the existing header comment, `localePrefix`, `localizedHref`) with:

```ts
export const DEFAULT_LOCALE = "en";
/** Every locale the code and the DB know. Adding here = Prisma enum + admin + validation. */
export const LOCALES = ["en", "de", "pl", "ru", "he"] as const;
export type Locale = (typeof LOCALES)[number];

/** Locales that exist but are NOT routed/advertised until the operator flips
 *  NEXT_PUBLIC_LIVE_LOCALES. Keeps a forgotten env var from launching a locale. */
export const LAUNCH_GATED_LOCALES: readonly Locale[] = ["he"];
export const RTL_LOCALES: readonly Locale[] = ["he"];

export function parsePublicLocales(raw: string | undefined): Locale[] {
  const known = LOCALES as readonly string[];
  const listed = raw
    ? raw.split(",").map((s) => s.trim()).filter((s): s is Locale => known.includes(s))
    : LOCALES.filter((l) => !LAUNCH_GATED_LOCALES.includes(l));
  const out = listed.includes(DEFAULT_LOCALE) ? listed : [DEFAULT_LOCALE as Locale, ...listed];
  // keep canonical LOCALES order, dedupe
  return LOCALES.filter((l) => out.includes(l));
}

/** Locales visible to visitors and search engines: routing, hreflang, sitemaps,
 *  language switcher, static params, IndexNow. Build-time inlined (NEXT_PUBLIC_). */
export const PUBLIC_LOCALES: readonly Locale[] = parsePublicLocales(process.env.NEXT_PUBLIC_LIVE_LOCALES);

export function isLocale(lang: string): lang is Locale {
  return (LOCALES as readonly string[]).includes(lang);
}
export function isPublicLocale(lang: string): lang is Locale {
  return (PUBLIC_LOCALES as readonly string[]).includes(lang);
}
export function localeDir(lang: string): "rtl" | "ltr" {
  return (RTL_LOCALES as readonly string[]).includes(lang) ? "rtl" : "ltr";
}

export const BCP47: Record<Locale, string> = {
  en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU", he: "he-IL",
};

export const LOCALE_LABELS: Record<Locale, { code: string; name: string }> = {
  en: { code: "EN", name: "English" },
  de: { code: "DE", name: "Deutsch" },
  pl: { code: "PL", name: "Polski" },
  ru: { code: "RU", name: "Русский" },
  he: { code: "HE", name: "עברית" },
};

/** "de|pl|ru|he" — for the middleware/SEO regexes that used to hard-code (de|pl|ru). */
export function nonDefaultLocalePattern(locales: readonly string[] = LOCALES): string {
  return locales.filter((l) => l !== DEFAULT_LOCALE).join("|");
}

/** Prices are EUR with Western digits in every locale (Israeli convention too). */
export function fmtPrice(n: number, _lang: string): string {
  return `€${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
}

export function fmtDate(value: string | Date, lang: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const tag = isLocale(lang) ? BCP47[lang] : BCP47.en;
  return new Intl.DateTimeFormat(tag, opts).format(d);
}
```

Update the header comment: "en/de/pl/ru/he; `he` is RTL; see PUBLIC_LOCALES for what is live."

- [ ] **Step 5: Run tests**

Run: `npm test 2>&1 | tail -20`
Expected: all locale tests PASS, MCP tests unchanged.

- [ ] **Step 6: Build check and commit**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -30`
Expected: new errors ONLY in files whose types depend on `LOCALES` widening (list them — they are fixed in Tasks 4, 10, 12). If nothing else errors, proceed.

```bash
git add src/lib/locale.ts src/lib/__tests__/locale.test.ts package.json
git commit -m "feat(i18n): locale.ts as single source; add he, PUBLIC_LOCALES gating, RTL/BCP47 helpers"
```

---

### Task 2: `i18n.config.ts`, `sanity.utils.ALL_LOCALES`, `generateStaticParams`

**Files:**
- Modify: `src/i18n.config.ts:5-18`
- Modify: `src/sanity/sanity.utils.ts:885`
- Modify: `src/app/[lang]/page.tsx:12,54,66`, `src/app/[lang]/blog/[slug]/page.tsx:66`, `src/app/[lang]/case-studies/[slug]/page.tsx:27`, `src/app/[lang]/developers/[slug]/page.tsx:22`, `src/app/[lang]/[...slug]/page.tsx:130`, `src/app/preview-legal/[lang]/[doc]/page.tsx:28-40`

**Interfaces:**
- Consumes: `PUBLIC_LOCALES`, `LOCALE_LABELS`, `DEFAULT_LOCALE` from Task 1.
- Produces: `i18n.languages` now contains only public locales (so the three language switchers automatically hide `he` on production); `ALL_LOCALES` in `sanity.utils.ts` is a re-export of `PUBLIC_LOCALES`.

- [ ] **Step 1: Rewrite `src/i18n.config.ts`**

```ts
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_LABELS, PUBLIC_LOCALES } from "@/lib/locale";

// Derived from lib/locale.ts (single source). Only PUBLIC locales are listed
// here: this object drives the next-intl middleware and the language switchers.
const TITLES: Record<string, string> = { en: "English", de: "German", pl: "Polish", ru: "Russian", he: "Hebrew" };
const languages = PUBLIC_LOCALES.map((id) => ({
  id,
  title: TITLES[id] ?? LOCALE_LABELS[id].name,
  isDefault: id === DEFAULT_LOCALE,
}));

export const i18n = { languages, base: DEFAULT_LOCALE };
export const locales = languages.map((el) => el.id);
export const defaultLocale = DEFAULT_LOCALE;

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as any)) notFound();
  return { messages: undefined };
});
```

- [ ] **Step 2: `sanity.utils.ts` line 885**

Replace `export const ALL_LOCALES = ["en", "de", "pl", "ru"] as const;` with:

```ts
import { PUBLIC_LOCALES } from "@/lib/locale"; // add to the file's import block if not present
// Static-generation locale set: only locales that are live get pre-rendered.
export const ALL_LOCALES = PUBLIC_LOCALES;
```

(Check the file already imports `localizedHref` from `@/lib/locale` at the top — extend that import instead of adding a second one.)

- [ ] **Step 3: `[...slug]/page.tsx:130` and `preview-legal/[lang]/[doc]/page.tsx`**

In `src/app/[lang]/[...slug]/page.tsx` line 130 replace `const langs = i18n.languages.map((l) => l.id);` with `const langs = PUBLIC_LOCALES;` and import `PUBLIC_LOCALES` from `@/lib/locale` (remove the `i18n` import if now unused).

In `src/app/preview-legal/[lang]/[doc]/page.tsx` delete line 28 (`const LOCALES = [...] as const;`) and import `{ PUBLIC_LOCALES as LOCALES, isLocale }` from `@/lib/locale`; at line 40 replace the inline `includes` guard with `const l = isLocale(lang) ? lang : "en";` (the `CorporateLocale` type is widened in Task 4).

The other four sites (`[lang]/page.tsx`, blog, case-studies, developers) already import `ALL_LOCALES` from `sanity.utils` and need no edit.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "i18n.config|sanity.utils|\[lang\]/page|slug\]/page|preview-legal" | head`
Expected: no lines.

Run: `NEXT_PUBLIC_LIVE_LOCALES=en,de node --import tsx -e 'import("@/i18n.config").then(m=>console.log(m.locales))'` from the repo root — if module resolution of `@/` fails outside next, instead run `node --import tsx -e 'import("./src/lib/locale.ts").then(m=>console.log(m.PUBLIC_LOCALES))'` with the same env.
Expected: `[ 'en', 'de' ]`.

- [ ] **Step 5: Commit**

```bash
git add src/i18n.config.ts src/sanity/sanity.utils.ts "src/app/[lang]/[...slug]/page.tsx" "src/app/preview-legal/[lang]/[doc]/page.tsx"
git commit -m "feat(i18n): derive i18n.config and static-param locales from PUBLIC_LOCALES"
```

---

### Task 3: Middleware — imported locales, generated regexes, gated next-intl

**Files:**
- Modify: `src/middleware.ts:4,11,355,371,383,400,408-435,436-448,504-513`

**Interfaces:**
- Consumes: `PUBLIC_LOCALES`, `nonDefaultLocalePattern`, `DEFAULT_LOCALE` from `@/lib/locale`.

- [ ] **Step 1: Imports and constants**

Replace line 4 `import { defaultLocale, locales } from "@/i18n.config";` with:

```ts
import { DEFAULT_LOCALE, PUBLIC_LOCALES, nonDefaultLocalePattern } from "@/lib/locale";
```

Replace line 11 `const ALL_LOCALES = ["en", "de", "pl", "ru"];` with:

```ts
// Locales that are LIVE. A gated locale (see LAUNCH_GATED_LOCALES) is not in
// this set, so /he/... on production falls through next-intl as an unknown
// prefix and 404s in the singlepage catch-all — no hreflang, no sitemap.
const ALL_LOCALES: readonly string[] = PUBLIC_LOCALES;
const NON_DEFAULT = nonDefaultLocalePattern(PUBLIC_LOCALES); // "de|pl|ru" on prod, "de|pl|ru|he" on staging
const PREFIXED = new RegExp(`^/(?:(${NON_DEFAULT})/)?`);
```

- [ ] **Step 2: Replace the four literal regexes**

Line 355: `const propMatch = request.nextUrl.pathname.match(new RegExp(\`^/(?:(${NON_DEFAULT})/)?properties(?:/.*)?$\`));`
Line 371: `const faqMatch = request.nextUrl.pathname.match(new RegExp(\`^/(?:(${NON_DEFAULT})/)?faq$\`));`
Line 383: `const caseStudiesMatch = request.nextUrl.pathname.match(new RegExp(\`^/(?:(${NON_DEFAULT})/)?case-studies(?:/([^/]+))?$\`));`
Line 400: `const partnersMatch = request.nextUrl.pathname.match(new RegExp(\`^/(?:(${NON_DEFAULT})/)?partners$\`));`

Hoist the four `RegExp` objects to module scope (`const PROPERTIES_RE = …` etc.) so they are compiled once, and update the FAQ comment: "locale-aware for every live locale".

- [ ] **Step 3: Corporate block (lines ~408-435)**

Replace `const hasLocalePrefix = maybeLocale === "de" || maybeLocale === "pl" || maybeLocale === "ru";` with:

```ts
const hasLocalePrefix = maybeLocale !== DEFAULT_LOCALE && ALL_LOCALES.includes(maybeLocale);
const lang = hasLocalePrefix ? maybeLocale : DEFAULT_LOCALE;
```

- [ ] **Step 4: next-intl (lines 504-513)**

```ts
const handleI18nRouting = createIntlMiddleware({
  locales: [...PUBLIC_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
});
```

- [ ] **Step 5: Verify build and behaviour locally**

Run: `npm run build 2>&1 | tail -15` — Expected: build succeeds (a local build reads the production DB — that is a read, say so in the task report).

Run: `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he npm run dev -p 3005 &` then:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3005/he/faq
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3005/he
```
Expected: `/he/faq` → 200 or 404 (404 is fine until a `he` faqPage row exists — it must NOT be a 500 and must NOT redirect to `/en/he/faq`); `/he` → 404 until Task 8 (layout accepts `he`) — record the codes.

Then restart with the var unset: `/he` → 404, `/he/faq` → 404, and `curl -sI http://localhost:3005/de/faq | head -1` → 200. Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(i18n): middleware derives locale set and prefix regexes from PUBLIC_LOCALES"
```

---

### Task 4: Corporate slugs and the legal registry

**Files:**
- Modify: `src/lib/corporatePageSlugs.ts:15-35`
- Modify: `src/app/preview-legal/[lang]/[doc]/registry.ts:18-26`

**Interfaces:**
- Produces: `CORPORATE_SLUGS.*.he`; `CorporateLocale` = `Locale`.

- [ ] **Step 1: Widen the slug table**

```ts
import { LOCALES, type Locale } from "@/lib/locale";

export const CORPORATE_LOCALES = LOCALES;
export type CorporateLocale = Locale;

export type CorporatePage = "about" | "contacts" | "privacy" | "terms";

// Hebrew uses LATIN slugs (spec decision A) — hreflang carries the language.
export const CORPORATE_SLUGS: Record<CorporatePage, Record<CorporateLocale, string>> = {
  about: { en: "about-us", de: "ueber-uns", pl: "o-nas", ru: "o-nas", he: "about-us" },
  contacts: { en: "contacts", de: "kontakt", pl: "kontakty", ru: "kontakty", he: "contacts" },
  privacy: { en: "privacy-policy", de: "datenschutzrichtlinie", pl: "polityka-prywatnosci", ru: "politika-privatnosti", he: "privacy-policy" },
  terms: { en: "terms-and-conditions", de: "geschaftsbedingungen", pl: "warunki", ru: "uslovija-i-polozhenija", he: "terms-and-conditions" },
};
```

`corporateTranslations(page)` must only advertise live locales — change its map source to `PUBLIC_LOCALES` (import it) so production hreflang never lists `/he/about-us`.

- [ ] **Step 2: Legal registry — make the English fallback explicit and counted**

Open `src/app/preview-legal/[lang]/[doc]/registry.ts`. Where `privacy`/`terms` maps are built (lines ~18-19), add `he: privacyEn, // TODO(he) placeholder — real translation in Phase 5b` and `he: termsEn, // TODO(he)` so the `Record<string, LegalDoc>` becomes keyed for all five without changing its type. Keep line 26's `?? byLocale.en` fallback.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "corporatePageSlugs|registry|preview-(about|contacts|legal)" | head`
Expected: no lines.

- [ ] **Step 4: Commit**

```bash
git add src/lib/corporatePageSlugs.ts "src/app/preview-legal/[lang]/[doc]/registry.ts"
git commit -m "feat(i18n): Hebrew corporate slugs (Latin), legal registry placeholders"
```

---

### Task 5: hreflang, sitemaps and nested redirects follow `PUBLIC_LOCALES`

**Files:**
- Modify: `src/lib/seo.ts:8,73-79`
- Modify: `src/app/sitemaps/[type]/route.ts:9,15,100`
- Modify: `src/lib/nestedPageRedirects.json`, `src/lib/genNestedRedirects.mjs:16`

- [ ] **Step 1: `seo.ts`**

Change the import to `import { localizedHref, PUBLIC_LOCALES } from "./locale";` and in `staticAlternates` replace `for (const l of LOCALES)` with `for (const l of PUBLIC_LOCALES)`. Update the header comment: "de/pl/ru(/he when live) carry their prefix".

`languageAlternates` (lines 44-66) must also drop non-live locales that a `_translations` array may carry once Hebrew rows exist in the shared DB: after the loop add

```ts
for (const l of Object.keys(languages)) if (!(PUBLIC_LOCALES as readonly string[]).includes(l)) delete languages[l];
```

- [ ] **Step 2: Sitemap route**

Line 9: `import { localePrefix, localizedHref, PUBLIC_LOCALES } from "@/lib/locale";`
Line 15: `const langs = PUBLIC_LOCALES;`
Line 100: `const XDEFAULT_ORDER = PUBLIC_LOCALES;` (English is first in `LOCALES` order, so precedence is unchanged.)

Inside `buildAltIndex` (after the `findMany`), filter `rows` to live languages: `const rows: any[] = (await cfg.model.findMany({...})).filter((r: any) => (langs as readonly string[]).includes(r.language));` — otherwise a Hebrew PUBLISHED row in the shared DB would leak into production alternates.

- [ ] **Step 3: Nested redirects**

In `src/lib/nestedPageRedirects.json` add `"he": {}` as the last key. In `genNestedRedirects.mjs` line 16 replace the literal with `const langs = ["en", "de", "pl", "ru", "he"];` (plain .mjs, no TS import; add a comment "keep in sync with src/lib/locale.ts LOCALES").

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "seo.ts|sitemaps" | head` — Expected: nothing.
Run (dev server, var unset): `curl -s http://localhost:3005/sitemaps/pages | grep -c 'hreflang="he"'` — Expected: `0`. With `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he` the count may still be 0 (no Hebrew rows yet) — that is correct.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts "src/app/sitemaps/[type]/route.ts" src/lib/nestedPageRedirects.json src/lib/genNestedRedirects.mjs
git commit -m "feat(seo): hreflang/sitemaps advertise only PUBLIC_LOCALES; he key in nested redirects"
```

---

### Task 6: The remaining `(de|pl|ru)` regexes

**Files:**
- Modify: `src/app/components/Header/navShared.tsx:10-27`
- Modify: `src/app/[lang]/layout.tsx:128`
- Modify: `src/lib/seo/templateClass.ts:26-33`
- Modify: `src/lib/seo/urlCanonical.ts:98,103`
- Modify: `src/lib/seo/pagePower/classVerdicts.ts:174`
- Modify: `src/sanity/sanity.utils.ts:200`

- [ ] **Step 1: `navShared.tsx`**

Replace the `LANG_LABELS` literal with `export { LOCALE_LABELS as LANG_LABELS } from "@/lib/locale";` semantics — concretely:

```ts
import { localizedHref, localePrefix, LOCALE_LABELS, nonDefaultLocalePattern } from "@/lib/locale";
export const LANG_LABELS: Record<string, { code: string; name: string }> = LOCALE_LABELS;
const NON_DEFAULT = nonDefaultLocalePattern();
const HOME_RE = new RegExp(`^/(${NON_DEFAULT})?$`);
const PROJECTS_RE = new RegExp(`^(/(${NON_DEFAULT}))?/projects$`);
export function isDarkHeroPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return HOME_RE.test(p) || PROJECTS_RE.test(p);
}
```

(`nonDefaultLocalePattern()` with all LOCALES is correct here: a non-live prefix never reaches this code.)

- [ ] **Step 2: Inline pre-paint script in `[lang]/layout.tsx:128`**

Build the string from the same helper so it cannot drift:

```tsx
const NON_DEFAULT = nonDefaultLocalePattern();
const PREPAINT = `(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';if(/^\\/(${NON_DEFAULT})?$/.test(p)||/^(\\/(${NON_DEFAULT}))?\\/projects$/.test(p))document.documentElement.setAttribute('data-hero-dark','')}catch(e){}})()`;
```

and use `__html: PREPAINT`. Import `nonDefaultLocalePattern` from `@/lib/locale`.

- [ ] **Step 3: `templateClass.ts`, `urlCanonical.ts`, `classVerdicts.ts`, `sanity.utils.ts:200`**

In each file add `import { nonDefaultLocalePattern } from "@/lib/locale";` (or extend the existing import) and a module-level `const L = nonDefaultLocalePattern();`, then:

- `templateClass.ts`: `HOME = new RegExp(\`^/(${L})?$\`)`, `LISTING = new RegExp(\`^(?:/(${L}))?/projects$\`)`, `PROJECT = new RegExp(\`^(?:/(?:${L}))?/projects/([^/]+)$\`)`, `BLOG = new RegExp(\`^(?:/(${L}))?/blog/[^/]+$\`)`; use them in `templateClassOf`.
- `urlCanonical.ts:98` → `new RegExp(\`^((?:/(?:${L}))?)/preview-project/([^/?]+)$\`)`; `:103` → `new RegExp(\`^((?:/(?:${L}))?)/properties(?:/.*)?$\`)`.
- `classVerdicts.ts:174` → `const PROPERTY_PATH = new RegExp(\`^(?:/(?:${L}))?/projects/([^/]+)$\`);`
- `sanity.utils.ts:200` → `path.replace(new RegExp(\`^/(?:en|${L})(?=/)\`), "")`.

- [ ] **Step 4: Add a regression test**

Append to `src/lib/__tests__/locale.test.ts`:

```ts
import { templateClassOf } from "@/lib/seo/templateClass";
import { isDarkHeroPath } from "@/app/components/Header/navShared";

test("he paths classify like the other prefixed locales", () => {
  assert.equal(templateClassOf("/he"), "homepage");
  assert.equal(templateClassOf("/he/projects"), "projects-listing");
  assert.equal(templateClassOf("/he/blog/x"), "blog-post");
  assert.ok(isDarkHeroPath("/he"));
  assert.ok(isDarkHeroPath("/he/projects"));
  assert.ok(!isDarkHeroPath("/he/blog"));
});
```

If importing `navShared.tsx` under node:test fails because it imports React/JSX, move `isDarkHeroPath` + its regexes into a new `src/lib/heroPaths.ts` and re-export from `navShared.tsx`.

- [ ] **Step 5: Run tests + grep for leftovers**

Run: `npm test 2>&1 | tail -8` — Expected: PASS.
Run: `grep -rn "(de|pl|ru)" src --include='*.ts' --include='*.tsx' | grep -v "__tests__"`
Expected: no output. (If a hit remains, it is in this task's scope — fix it.)

- [ ] **Step 6: Commit**

```bash
git add src/app/components/Header/navShared.tsx "src/app/[lang]/layout.tsx" src/lib/seo/templateClass.ts src/lib/seo/urlCanonical.ts src/lib/seo/pagePower/classVerdicts.ts src/sanity/sanity.utils.ts src/lib/__tests__/locale.test.ts src/lib/heroPaths.ts
git commit -m "refactor(i18n): generate every locale-prefix regex from lib/locale"
```

---

### Task 7: Prisma — `he` enum value and Hebrew content columns (operator-applied)

**Files:**
- Modify: `prisma/schema.prisma:22-27,1400-1403,1417,1433-1436,701`
- Create: `prisma/migrations/20260914100000_locale_add_he/migration.sql`
- Create: `prisma/migrations/20260914100100_he_content_columns/migration.sql`

**Interfaces:**
- Produces: `Locale.he`; `DevelopmentOverride.descriptionHE String?`; `AreaDescription.textHE String?`; documented JSON keys `titleHE/descHE` and `signature.he`.

- [ ] **Step 1: Schema**

```prisma
enum Locale {
  en
  de
  pl
  ru
  he
}
```

`DevelopmentOverride`: after `descriptionRU String?` add `descriptionHE String?`. Update the `seo Json?` comment to `{ titleEN/DE/PL/RU/HE, descEN/DE/PL/RU/HE }`. `AreaDescription`: after `textRU` add `textHE String?`. `User.signature` comment → `{ en?, de?, pl?, ru?, he? }`.

- [ ] **Step 2: Migration 1 (own migration — Postgres forbids using a new enum value in the transaction that adds it)**

`prisma/migrations/20260914100000_locale_add_he/migration.sql`:

```sql
-- Hebrew locale. Additive; nothing references 'he' until a later migration/app write.
ALTER TYPE "Locale" ADD VALUE IF NOT EXISTS 'he';
```

- [ ] **Step 3: Migration 2**

`prisma/migrations/20260914100100_he_content_columns/migration.sql`:

```sql
ALTER TABLE "DevelopmentOverride" ADD COLUMN "descriptionHE" TEXT;
ALTER TABLE "AreaDescription" ADD COLUMN "textHE" TEXT;
```

- [ ] **Step 4: Generate the client locally (read-only) and type-check**

Run: `npx prisma generate 2>&1 | tail -2` then `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`.
Expected: generate OK; any new TS errors are `Record<Locale, …>` tables now missing `he` — those are Tasks 10/12; note them.

Do NOT run `prisma migrate deploy` / `db push` locally.

- [ ] **Step 5: Hand the migration to the operator**

Post in the task report, verbatim, for the operator to run on the VPS in `/var/www/cve-staging` after the staging rsync (Task 14):

```bash
CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate deploy
```

with the note: "Both migrations are additive (enum value + two nullable columns). Because staging and production share the database, this is a production migration; the running production app is unaffected (Prisma client there still knows only four values and never writes `he`). Postgres ≥ 12 required for `ADD VALUE` inside Prisma's transaction — check with `psql -tAc 'select version()'` first; on 11 or older, apply migration 1 by hand with `\i` outside a transaction and `prisma migrate resolve --applied 20260914100000_locale_add_he`."

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260914100000_locale_add_he prisma/migrations/20260914100100_he_content_columns
git commit -m "feat(db): Locale.he enum value; descriptionHE/textHE columns"
```

---

### Task 8: `<html dir>` in all 13 root layouts, layout locale guard, labels

**Files:**
- Modify: `src/app/[lang]/layout.tsx:24-31,100,118,209`
- Modify: `src/app/preview-about/[lang]/layout.tsx:60`, `preview-contacts/[lang]/layout.tsx:56`, `preview-faq/[lang]/layout.tsx:65`, `preview-legal/[lang]/layout.tsx:57`, `preview-partners/[lang]/layout.tsx:60`, `preview-case-studies/[lang]/layout.tsx:73`, `preview-landing/[lang]/layout.tsx:59`
- Modify: `src/app/book/layout.tsx:35`, `src/app/c/layout.tsx:41` (these render per-lead locale — see step 3)
- Modify: `src/app/components/CustomCookieConsent/CustomCookieConsent.tsx:18`

- [ ] **Step 1: `[lang]/layout.tsx`**

Line 24 import: `import { isPublicLocale, localeDir, LOCALES, type Locale } from "@/lib/locale";`
Line 100: `if (!isPublicLocale(params.lang)) notFound();`
Line 118: `<html lang={params.lang} dir={localeDir(params.lang)} suppressHydrationWarning>`
`SKIP_LINK_LABELS` → type `Record<Locale, string>` and add `he: "דלג לתוכן הראשי",` (this is the one Hebrew string allowed in this phase — it is a11y-critical and one line).
Line 209: `<CustomCookieConsent lang={params.lang as Locale} />` and in `CustomCookieConsent.tsx:18` change the prop type to `lang: Locale` (import from `@/lib/locale`); its `dictionary[lang] || dictionary.en` fallback stays.

- [ ] **Step 2: The seven `preview-*/[lang]` layouts**

In each: `import { localeDir } from "@/lib/locale";` and change the `<html lang={params.lang}` tag to `<html lang={params.lang} dir={localeDir(params.lang)}`.

- [ ] **Step 3: `book/layout.tsx` and `c/layout.tsx`**

These are outside `[lang]`; the page decides the locale from the lead. Leave `lang="en"` on `<html>` but add `dir="ltr"` explicitly, plus a code comment: "Per-lead locale (incl. RTL) is applied on the page wrapper `<div lang dir>` — Phase 7." No RTL work here now.

- [ ] **Step 4: Verify**

Run: `grep -rn "<html" src/app --include=layout.tsx | grep -v "sandbox\|style/\|preview-home\|preview-insights\|preview-projects\|admin" | grep -vc "dir="`
Expected: `0`.
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "layout.tsx|CustomCookieConsent" | head` — Expected: nothing.
Dev server with `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he`: `curl -s http://localhost:3005/he | grep -o '<html[^>]*>'` → contains `lang="he" dir="rtl"` (page body may be the 404 component until a Hebrew homepage row exists — the `<html>` tag is what is being verified; if `notFound()` fires before the layout renders, check `/he/projects` instead, which needs no SiteDocument row).

- [ ] **Step 5: Commit**

```bash
git add "src/app/[lang]/layout.tsx" src/app/preview-*/\[lang\]/layout.tsx src/app/book/layout.tsx src/app/c/layout.tsx src/app/components/CustomCookieConsent/CustomCookieConsent.tsx
git commit -m "feat(rtl): html dir attribute from localeDir in every root layout; layout guards on PUBLIC_LOCALES"
```

---

### Task 9: Hebrew fonts

**Files:**
- Create: `src/app/fonts/hebrew.ts`
- Modify: `src/app/[lang]/layout.tsx:33,120`
- Modify: the seven `preview-*/[lang]/layout.tsx` `<html className>` lists
- Modify: `src/app/header-footer.css:213,305`, `src/app/preview-legal/legal.css:27`, `src/app/preview-projects/projects.css:417,480`, `src/app/preview-project/project.css:43,148`, and `src/app/globals.css` (body rule)

- [ ] **Step 1: Font module**

```ts
// src/app/fonts/hebrew.ts — Hebrew-capable faces, loaded once and exposed as
// CSS variables. Fraunces/Mulish/Playfair have no Hebrew glyphs; the
// font-family chains fall through to these when the text is Hebrew, exactly
// the way --font-display-cyr already backs Cyrillic.
import { Frank_Ruhl_Libre, Rubik } from "next/font/google";

export const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display-he",
  display: "swap",
});

export const rubikHebrew = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body-he",
  display: "swap",
});
```

- [ ] **Step 2: Wire the variables**

`[lang]/layout.tsx`: line 33 `const rubik = Rubik({ subsets: ["latin", "cyrillic", "hebrew"] });` and body className gains `${frankRuhlLibre.variable} ${rubikHebrew.variable}` (import from `@/app/fonts/hebrew`).
Each of the seven preview layouts: append `${frankRuhlLibre.variable} ${rubikHebrew.variable}` to the `<html className>` string.

- [ ] **Step 3: CSS chains**

In the six CSS locations replace `var(--font-display), var(--font-display-cyr), serif` with `var(--font-display), var(--font-display-cyr), var(--font-display-he), serif` (a single `sed` across those files is fine; confirm with grep that no other chain form exists: `grep -rn "font-display-cyr" src/app --include='*.css' --include='*.scss'`).

In `globals.css`, where `body` sets its font (or add if the Rubik className is the only source), add:

```css
:lang(he) { font-family: var(--font-body-he), "Rubik", Arial, sans-serif; }
[dir="rtl"] { text-align: start; }
```

- [ ] **Step 4: Verify**

Run: `npm run build 2>&1 | grep -iE "font|error" | head` — Expected: no font download errors (next/font fetches at build).
Dev server: `curl -s http://localhost:3005/he/projects | grep -o -- '--font-display-he[^;"]*' | head -2` → the variable is present in the inlined font CSS.

- [ ] **Step 5: Commit**

```bash
git add src/app/fonts/hebrew.ts "src/app/[lang]/layout.tsx" src/app/preview-*/\[lang\]/layout.tsx src/app/header-footer.css src/app/preview-legal/legal.css src/app/preview-projects/projects.css src/app/preview-project/project.css src/app/globals.css
git commit -m "feat(fonts): Frank Ruhl Libre + Rubik Hebrew as --font-display-he/--font-body-he"
```

---

### Task 10: One BCP-47 map; `he` in Intl call sites

**Files:**
- Modify: `src/lib/formatMonthYear.ts:3-8,50`
- Modify: `src/lib/crm/bookingMessages.ts:51-56`
- Modify: `src/app/book/[token]/page.tsx:143`, `src/app/book/[token]/SlotPicker.tsx:118`
- Modify: `src/app/components/ProjectsMapAll/ProjectsMapAll.tsx:193-198`, `src/app/components/PropertyMap/PropertyMap.tsx:73`
- Modify: `src/app/preview-legal/[lang]/[doc]/page.tsx:101-102`

- [ ] **Step 1: Replace each local map**

- `formatMonthYear.ts`: delete `localeMap`; `const locale = isLocale(lang) ? BCP47[lang] : BCP47.en;` (import both).
- `bookingMessages.ts`: `export const INTL_LOCALE = BCP47;` (keep the export name; its `Locale` type comes from Task 12).
- `book/[token]/page.tsx:143` and `SlotPicker.tsx:118`: replace the inline object with `BCP47[locale]`.
- `ProjectsMapAll.tsx:193-198`, `PropertyMap.tsx:73`: replace `locales[lang]` with `(isLocale(lang) ? BCP47[lang] : BCP47.en)` — this also fixes the existing `undefined`-locale bug for junk `lang`.
- `preview-legal/[lang]/[doc]/page.tsx:101-102`: replace the ternary chain with `BCP47[l]`.

- [ ] **Step 2: Verify**

Run: `grep -rn '"pl-PL"' src | grep -v "lib/locale.ts"` — Expected: no output.
Run: `npm test 2>&1 | tail -5` and `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "formatMonthYear|bookingMessages|SlotPicker|ProjectsMapAll|PropertyMap|preview-legal" | head` — Expected: PASS / nothing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/formatMonthYear.ts src/lib/crm/bookingMessages.ts "src/app/book/[token]/page.tsx" "src/app/book/[token]/SlotPicker.tsx" src/app/components/ProjectsMapAll/ProjectsMapAll.tsx src/app/components/PropertyMap/PropertyMap.tsx "src/app/preview-legal/[lang]/[doc]/page.tsx"
git commit -m "refactor(i18n): single BCP47 map for every Intl call site"
```

---

### Task 11: Lead APIs and MCP accept `he`

**Files:**
- Modify: `src/app/api/leads/route.ts:15`, `src/app/api/email/route.ts:9`, `src/app/api/roi-calculator/route.ts:8`, `src/app/api/monday-newsletter/route.ts:13`
- Modify: `src/lib/mcp/tools/createLeadInput.ts:18`, `src/lib/mcp/tools/updateLead.ts:20`
- Modify: `src/lib/mcp/__tests__/createLeadInput.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mcp/__tests__/createLeadInput.test.ts` (follow the file's existing parse helper — it validates the zod schema):

```ts
test("languagePreference accepts he", () => {
  const parsed = createLeadInput.parse({ name: "Test", email: "t@example.com", languagePreference: "he" });
  assert.equal(parsed.languagePreference, "he");
});
```

(Use the schema export name the file already imports; if the minimal valid object needs more fields, copy the object from an existing passing test in that file and add `languagePreference: "he"`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npm test 2>&1 | grep -A3 "accepts he"` — Expected: FAIL (`Invalid enum value`).

- [ ] **Step 3: Implement**

- The four API routes: replace `new Set(["en", "de", "pl", "ru"])` with `new Set<string>(LOCALES)` and import `LOCALES` from `@/lib/locale`. (Accepting `he` here means a lead from a Hebrew form is stored with `languagePreference: "he"`; the auto-reply template still falls back to English until Phase 7 — verify `emailTemplates.ts:23-108` has a `default` branch → it does.)
- `createLeadInput.ts:18`, `updateLead.ts:20`: `z.enum(LOCALES)` (zod accepts a readonly tuple; import `LOCALES`).

- [ ] **Step 4: Run tests**

Run: `npm test 2>&1 | tail -6` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leads/route.ts src/app/api/email/route.ts src/app/api/roi-calculator/route.ts src/app/api/monday-newsletter/route.ts src/lib/mcp/tools/createLeadInput.ts src/lib/mcp/tools/updateLead.ts src/lib/mcp/__tests__/createLeadInput.test.ts
git commit -m "feat(leads): accept languagePreference=he on public APIs and MCP tools"
```

---

### Task 12: Exhaustive copy tables — `Locale` import and `TODO(he)` placeholders; placeholder counter

**Files:**
- Modify: `src/lib/crm/presentationMessages.ts:8,11,21,39`, `src/lib/crm/bookingMessages.ts:26-46`
- Modify: `src/lib/developmentSeo.ts:68-78,112-117`, `src/lib/developmentCopy.ts:11-13` (+ every `Record<Lang, …>` table in it)
- Modify: `src/app/c/[token]/copy.ts:1-3`, `src/app/book/[token]/copy.ts:4-6` (+ their `Record<PLocale|BLocale, …>` tables)
- Create: `scripts/qa/he-placeholders.mjs`

**Interfaces:**
- Convention produced: a placeholder Hebrew entry is always written as `he: EN, // TODO(he)` (or `he: { ...en }, // TODO(he)` for object literals that are not a named constant) — the counter greps for the literal `TODO(he)`.

- [ ] **Step 1: Retire the private `Locale`/`Lang` types**

- `presentationMessages.ts:8` → `import type { Locale } from "@/lib/locale"; export type { Locale };` (keeps `bookingMessages.ts`'s import working).
- `developmentSeo.ts:68-70` → `import { LOCALES, isLocale, type Locale as Lang } from "@/lib/locale"; const asLang = (l: string): Lang => (isLocale(l) ? l : "en");` and delete the local `LANGS`.
- `developmentCopy.ts:11-13` → same pattern; keep the exported name `asDevLang`.
- `c/[token]/copy.ts:1-3` → `import { LOCALES, isLocale, type Locale } from "@/lib/locale"; export type PLocale = Locale; export const P_LOCALES = LOCALES; export const asPLocale = (v) => (v && isLocale(v) ? v : "en");`
- `book/[token]/copy.ts:4-6` → same with `BLocale`/`B_LOCALES`/`asBLocale`.

- [ ] **Step 2: Run tsc and fix every "Property 'he' is missing" error with a placeholder**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "'he' is missing"` — this is the count of tables to touch.

For each error location add the `he` entry as a copy of the English entry, marked `// TODO(he)`. Examples:

`presentationMessages.ts` (`WHATSAPP_MSG`, `WHATSAPP_UPDATED_MSG`, `PRESENTATION_EMAIL_TEMPLATE`):
```ts
  he: (name, url) => `Hello ${name}, I have prepared your personal property selection: ${url}`, // TODO(he)
```
`developmentSeo.ts` `TYPE_LABEL`: `villa: { en: "Villa", de: "Villa", pl: "Willa", ru: "Вилла", he: "Villa" /* TODO(he) */ },` — same for apartment/house/townhouse/generic; `LABELS`: `he: { ...LABELS_EN }, // TODO(he)` where you first extract the `en` object into `const LABELS_EN = { in: "in", … }` and reference it as `en: LABELS_EN`.
`developmentCopy.ts`, `c/[token]/copy.ts`, `book/[token]/copy.ts`: each `Record<…>` literal gets `he: EN, // TODO(he)` when the English object is a named constant; otherwise extract it first.

Repeat until `npx tsc --noEmit -p tsconfig.json` prints nothing.

- [ ] **Step 3: Placeholder counter**

`scripts/qa/he-placeholders.mjs`:

```js
#!/usr/bin/env node
// Counts Hebrew placeholder markers. Every `he:` copy entry that still equals
// English is tagged `TODO(he)`; Phase 4 drives this to zero and Phase 8's
// launch check refuses to pass while any remain.
import { execSync } from "node:child_process";
const out = execSync(`grep -rn "TODO(he)" src --include='*.ts' --include='*.tsx' || true`, { encoding: "utf8" }).trim();
const lines = out ? out.split("\n") : [];
const byFile = {};
for (const l of lines) { const f = l.split(":")[0]; byFile[f] = (byFile[f] ?? 0) + 1; }
for (const [f, n] of Object.entries(byFile).sort()) console.log(String(n).padStart(4), f);
console.log(`\nTODO(he) placeholders: ${lines.length}`);
if (process.argv.includes("--strict") && lines.length) process.exit(1);
```

- [ ] **Step 4: Verify**

Run: `node scripts/qa/he-placeholders.mjs` — Expected: a per-file list and a total (record the number in the task report; it is the Phase 4 backlog).
Run: `npm test 2>&1 | tail -4` — PASS. Run: `npm run build 2>&1 | tail -5` — success.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm/presentationMessages.ts src/lib/crm/bookingMessages.ts src/lib/developmentSeo.ts src/lib/developmentCopy.ts "src/app/c/[token]/copy.ts" "src/app/book/[token]/copy.ts" scripts/qa/he-placeholders.mjs
git commit -m "chore(i18n): exhaustive Locale tables with TODO(he) placeholders + counter script"
```

---

### Task 13: Prompt brief, nginx, docs, env example, spec sync

**Files:**
- Modify: `src/lib/ai/projectBrief.ts:23`
- Modify: `ops/nginx/cyprusvipestates.conf:171`
- Modify: `DEPLOYMENT.md` (env section), `.env.example`
- Modify: `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` (section 3.1 env name)

- [ ] **Step 1: `projectBrief.ts:23`**

Replace `"Four locales: en (prefix-less URLs), de, pl, ru."` with `"Five locales: en (prefix-less URLs), de, pl, ru, he (Hebrew, RTL; Latin slugs)."`

- [ ] **Step 2: nginx**

Line 171: `location ~ ^/(de|pl|ru|he)(/|$) {` with a comment above: `# he added 2026-09-14 (Hebrew locale). Harmless before launch: the app answers 404 for /he while NEXT_PUBLIC_LIVE_LOCALES excludes it.`

- [ ] **Step 3: Docs and env**

`.env.example`: add
```
# Locales visible to visitors/search engines. Unset = all except launch-gated (he).
# Staging: NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he
NEXT_PUBLIC_LIVE_LOCALES=
```
`DEPLOYMENT.md`: in the environment-variables section add a row for `NEXT_PUBLIC_LIVE_LOCALES` ("build-time inlined; changing it needs a rebuild; production launch of a locale = set var + nginx line + deploy").
Spec section 3.1: replace `NEXT_PUBLIC_PUBLIC_LOCALES` with `NEXT_PUBLIC_LIVE_LOCALES`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/projectBrief.ts ops/nginx/cyprusvipestates.conf DEPLOYMENT.md .env.example docs/superpowers/specs/2026-09-13-hebrew-localization-design.md
git commit -m "docs(i18n): five-locale prompt brief, nginx he prefix, NEXT_PUBLIC_LIVE_LOCALES documented"
```

---

### Task 14: Staging deploy and smoke check

**Files:**
- Create: `scripts/qa/he-smoke.sh`

- [ ] **Step 1: Smoke script**

```bash
#!/usr/bin/env bash
# Hebrew locale smoke check. Usage: scripts/qa/he-smoke.sh [https://design.cyprusvipestates.com]
# On staging (he live) expects RTL html and 2xx/404-but-not-500; on production
# (he gated) expects /he to 404 and no hreflang="he" anywhere.
set -euo pipefail
HOST="${1:-https://design.cyprusvipestates.com}"
code() { curl -s -o /dev/null -w "%{http_code}" -L "$HOST$1"; }
fail=0
echo "host: $HOST"
for p in /he /he/projects /he/faq /he/blog /he/developers; do
  c=$(code "$p"); echo "$c  $p"
  [ "$c" = "500" ] && fail=1
done
html=$(curl -s -L "$HOST/he/projects" | grep -o '<html[^>]*>' | head -1)
echo "html tag: $html"
echo "$html" | grep -q 'dir="rtl"' && echo "rtl: yes" || echo "rtl: no"
he_alts=$(curl -s "$HOST/sitemaps/pages" | grep -c 'hreflang="he"' || true)
echo "hreflang=he entries in /sitemaps/pages: $he_alts"
for p in /de/faq /projects /blog; do c=$(code "$p"); echo "$c  $p (regression)"; [ "$c" != "200" ] && fail=1; done
exit $fail
```

`chmod +x scripts/qa/he-smoke.sh`.

- [ ] **Step 2: Operator steps (report them; do not SSH yourself)**

1. Add `NEXT_PUBLIC_LIVE_LOCALES=en,de,pl,ru,he` to `/var/www/cve-staging/.env` (the deploy script never syncs `.env`).
2. From the worktree branch checkout: `./scripts/deploy-staging.sh`.
3. In `/var/www/cve-staging`: `CVP_CONFIRM_PROD_MIGRATE=yes ./scripts/migrate-deploy-safe.sh migrate deploy` (Task 7), then `pm2 reload cve-staging --update-env`.

- [ ] **Step 3: Verify staging**

Run: `scripts/qa/he-smoke.sh https://design.cyprusvipestates.com`
Expected: no 500s; `rtl: yes`; `/he/projects` 200; regressions all 200; hreflang=he count 0 (no Hebrew rows yet).

- [ ] **Step 4: Verify the production gate locally**

Run (var unset): `npm run build && npm start -p 3006 &` then `scripts/qa/he-smoke.sh http://localhost:3006`
Expected: every `/he*` path 404, `rtl: no` (the 404 page is English), hreflang=he 0, regressions 200. Kill the server.

- [ ] **Step 5: Commit, push, PR**

```bash
git add scripts/qa/he-smoke.sh
git commit -m "test(i18n): Hebrew locale smoke script"
git push origin HEAD
gh pr create --title "Hebrew locale — Phase 1: locale plumbing (gated by NEXT_PUBLIC_LIVE_LOCALES)" --body "$(cat <<'EOF'
Implements Phase 1 of docs/superpowers/specs/2026-09-13-hebrew-localization-design.md.

- lib/locale.ts single source (LOCALES incl. he; PUBLIC_LOCALES env-gated)
- middleware / hreflang / sitemaps / static params follow PUBLIC_LOCALES
- every (de|pl|ru) regex generated from lib/locale
- Prisma: Locale.he + descriptionHE/textHE (operator-applied)
- html dir from localeDir in 13 layouts; Hebrew fonts
- one BCP47 map; APIs/MCP accept he; TODO(he) placeholders counted by scripts/qa/he-placeholders.mjs

Production behaviour unchanged while NEXT_PUBLIC_LIVE_LOCALES is unset (verified with scripts/qa/he-smoke.sh).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Record in the PR description: the placeholder count from Task 12 and the staging smoke output.

---

## Self-review

- **Spec coverage (Phase 1 list in spec §5):** 1 single source ✔ T1/T2; 2 `PUBLIC_LOCALES` gating ✔ T2/T3/T5 (IndexNow fan-out lives in `developments/[id]/actions.ts:473,637` and is admin code → Phase 3); 3 regexes ✔ T3/T6, nested redirects ✔ T5; 4 migrations + validators ✔ T7/T11; 5 `dir` + guard + inline script + consent cast ✔ T6/T8; 6 fonts + `BCP47`/`fmtPrice`/`fmtDate` ✔ T9/T10 (replacing the ~15 `toLocaleString("en-US")` price sites with `fmtPrice` is Phase 2 with the `<bdi>` wrapping — helper exists now); 7 corporate slugs ✔ T4; 8 nginx ✔ T13; 9 prompt brief ✔ T13; placeholder counter ✔ T12; acceptance ✔ T14.
- **Placeholders:** the only `TODO(he)` markers are the deliberate, counted copy placeholders; no plan step defers its own content.
- **Type consistency:** `Locale`, `PUBLIC_LOCALES`, `LOCALES`, `isLocale`, `isPublicLocale`, `localeDir`, `BCP47`, `LOCALE_LABELS`, `nonDefaultLocalePattern`, `fmtPrice`, `fmtDate` are defined in T1 and used with those exact names in T2–T12. `ALL_LOCALES` keeps its name in `sanity.utils.ts` as a re-export of `PUBLIC_LOCALES`.
