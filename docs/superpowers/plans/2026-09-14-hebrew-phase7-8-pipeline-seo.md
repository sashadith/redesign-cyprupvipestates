# Hebrew Localization — Phase 7 (Lead Pipeline) + Phase 8 (SEO Hardening + Phase 2b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hebrew lead flows end to end (form → API → CRM with `languagePreference: he` → Hebrew auto-reply → Telegram alert showing HE → Hebrew booking/presentation), every locale-aware SEO/analytics path treats `/he/` correctly, the public `he` pages carry complete hreflang/`og:locale`/`inLanguage`, the RTL physical-declaration debt is zero, and a launch guard script tells the operator when `he` may go live.

**Architecture:** Phase 4 (WP7) already localized the transactional copy; Phase 7 closes the remaining code gaps in the lead intake (project interest lookup, Telegram alert, e-mail signature) and proves them with tests. Phase 8 replaces every hard-coded four-locale list in the SEO/GSC stack with the single source in `src/lib/locale.ts` (parse with `LOCALES`, fan out with `PUBLIC_LOCALES`), adds the missing head signals, a curl-based hreflang sampler, and the launch guard `scripts/qa/he-launch-check.mjs`. Phase 2b drives `scripts/qa/rtl-physical-count.mjs --strict` to zero with the existing codemod plus manual fixes, LTR pixel-identical.

**Tech Stack:** Next.js 14 App Router, Prisma 5 (shared prod/staging DB — no local writes), node:test via tsx, plain `.mjs` QA scripts, SCSS modules, `scripts/codemods/rtl-logical.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.6 (SEO rules for `he`), §5 Phase 7, Phase 8, Phase 9, §6 (staging rules); decisions A–J. Predecessors: Phase 4 plan (Global Constraints apply), Phase 5 plan.

## Global Constraints

- Phase 4 Global Constraints apply (styleguide/glossary for any Hebrew string, `REVIEW(he)` marker on new `he` strings, LTR byte-identical via `copy-snapshot.mjs --check`, pathspec commits, reviewers read-only, no `node_modules`, no builds, no Prisma commands, no deploys).
- **Database rule:** no task writes to the database; the test lead is an operator step on staging (spec Phase 7). Tests use fakes.
- **Single source of locales:** parsing incoming paths/data uses `LOCALES`/`isLocale` (a `/he/` URL in GSC data is Hebrew even while `he` is gated); anything that *emits* URLs or fans out (sitemap, IndexNow, hreflang, alternates, presentations) uses `PUBLIC_LOCALES`. No new hard-coded locale arrays anywhere in `src/`; a test greps for `["en", "de", "pl", "ru"]` / `"en" | "de" | "pl" | "ru"` outside `src/lib/__tests__/` and fails on any hit.
- **Admin/internal copy stays English** (Telegram alerts, audit logs).
- **RTL work is LTR pixel-identical:** every physical→logical change goes through `scripts/codemods/rtl-logical.mjs` where possible; centring anchors (`left: 50%` + translate) stay physical (Phase 2 ruling, invariant in `rtl-physical-count.mjs --strict`); exceptions are documented in `scripts/qa/rtl-exceptions.txt` with a reason.
- Branch: `worktree-he-phase7-8`, stacked on `worktree-he-phase5-content` (PR #45). One PR at the end. Ledger: `.superpowers/sdd/2026-09-14-hebrew-phase7-8-pipeline-seo/progress.md`.

## File map

- Modify `src/app/api/leads/route.ts` (project interest for `he` via Development slug), `src/lib/leadNotify.ts` (Telegram alert language tag), `src/lib/emailSignature/resolve.ts` + the admin e-mail settings UI (signature `he` key), tests under `src/lib/__tests__/`.
- Modify `src/lib/gsc/client.ts` (`deriveLocale`), `src/lib/seo/urlCanonical.ts` (`localeOfPath`), `src/lib/seo/queries.ts` (two arrays), `src/lib/seo/pagePower/inventory.ts` (`LOCALES`), `src/lib/seo/pagePower/templateClass.ts` / `classVerdicts.ts` (verify), `src/lib/indexnow.ts` (fan-out), `src/app/sitemaps/[type]/route.ts` (he PUBLISHED-only, blog exclusion already in Phase 6), `src/lib/seo.ts` + `src/app/[lang]/layout.tsx` and the preview layouts (`og:locale`, `inLanguage`).
- Create `scripts/qa/hreflang-check.mjs` (curl + parse sampler over a URL list, `[host]` argument), `scripts/qa/he-launch-check.mjs` (launch guard), `scripts/qa/__tests__/he-launch.test.mjs`.
- Modify SCSS modules/CSS listed by `scripts/qa/rtl-physical-count.mjs` (107 declarations) + `scripts/qa/rtl-exceptions.txt`.
- Create `docs/i18n/acceptance/phase-7-8.md`, `docs/i18n/launch-checklist.md` (Phase 9, operator-only).

---

### Task 1: Lead pipeline — project interest for `he`, Telegram tag, signature `he`

**Files:**
- Modify: `src/app/api/leads/route.ts` (~lines 94–100 project lookup), `src/lib/leadNotify.ts`, `src/lib/emailSignature/resolve.ts`, the admin e-mail settings page that edits `UserEmailSettings.signature` (find via `grep -rn "signature" src/app/admin`), `src/lib/crm/createLead.ts` only if it narrows the locale.
- Test: `src/lib/__tests__/leadPipelineHe.test.ts` (pure helpers with fakes).

**Interfaces:**
- Produces `resolveProjectInterest({ projectSlug, lang, prisma }) → { projectInterestId: string | null; developmentId: string | null; source: "PROJECT_ENQUIRY" | null }` in a new `src/lib/leads/projectInterest.ts`: for every locale first try the legacy `Project` row `(slug, language: lang)` (today's behaviour, byte-identical for en/de/pl/ru); when none exists (always for `he`, decision H), resolve the `Development` by slug (Latin, locale-agnostic — read how `src/app/[lang]/projects/[slug]/page.tsx` resolves a slug to a Development) and, if the lead schema can store a development interest (check `Lead` for a development relation; if only `projectInterestId` exists, fall back to the EN legacy `Project` sibling of that Development via `supersededByDevelopmentId`, exactly as `mapProjectRowsToLang`'s `he` fallback does), set `source: "PROJECT_ENQUIRY"`.
- `leadNotify.ts`: the Telegram alert (English) prints the language as the upper-cased locale code from `LOCALE_LABELS` (`HE`) — verify it does not special-case four codes.
- `emailSignature/resolve.ts`: `resolveSignature(userId, locale)` reads `signature[locale]` for any `Locale` incl. `he`, EN fallback unchanged; the admin settings UI shows a `he` tab (`dir="rtl"` textarea) driven by `LOCALES` like the Phase 3 editors.

- [ ] **Step 1: Tests first** — `resolveProjectInterest`: legacy row found (unchanged path); no legacy row + Development found + EN sibling → id + source; nothing found → nulls; `he` never queries `Project` with `language: "he"` for interest AFTER the legacy miss (it may try once; assert the fallback). Telegram formatter with `languagePreference: "he"` renders `HE`. Signature resolve for `he` with and without a saved value.
- [ ] **Step 2: Implement**; wire the route; keep the route's response/blocked codes unchanged.
- [ ] **Step 3: Gates** `npx tsc --noEmit -p tsconfig.json`, `npm test`, `node --import tsx scripts/qa/copy-snapshot.mjs --check`, `node scripts/qa/he-admin-fields-check.mjs`.
- [ ] **Step 4: Commit** `feat(he): lead pipeline — project interest via Development for he, Telegram locale tag, signature he`.

---

### Task 2: SEO/GSC locale plumbing from the single source

**Files:**
- Modify: `src/lib/gsc/client.ts` (`deriveLocale`), `src/lib/seo/urlCanonical.ts` (`localeOfPath`), `src/lib/seo/queries.ts` (lines ~115, ~295), `src/lib/seo/pagePower/inventory.ts` (line 47), `src/lib/seo/pagePower/templateClass.ts`, `classVerdicts.ts` (verify `nonDefaultLocalePattern` usage covers `he` when public), `src/lib/indexnow.ts`, `src/lib/locale.ts` only to add a helper (`localeFromPath(path): Locale` using `LOCALES`).
- Test: `src/lib/__tests__/seoLocalePlumbing.test.ts` + the no-hard-coded-locale-array grep test.

**Interfaces:** `localeFromPath("/he/x") === "he"` regardless of `PUBLIC_LOCALES`; `deriveLocale` and `localeOfPath` delegate to it (LTR results unchanged: `/de/...` → de, `/de` → de, `/x` → en); `queries.ts` and `inventory.ts` iterate `LOCALES` for reading stored metrics and `PUBLIC_LOCALES` for anything that emits URLs; `indexnow.ts` fans out only over `PUBLIC_LOCALES` (verify Phase 1/3 already did; add a test).

- [ ] **Step 1: Tests first** (path parsing for all five locales incl. bare `/he`; grep test; IndexNow fan-out with `NEXT_PUBLIC_LIVE_LOCALES` unset excludes `he`, with `he` included includes it).
- [ ] **Step 2: Implement**; run `node scripts/verify-page-power.mjs` is NOT possible locally (needs a probe route) — instead read `inventory.ts` consumers and add a unit test that the inventory's locale loop yields five entries when `he` is public.
- [ ] **Step 3: Gates** tsc, tests, snapshot.
- [ ] **Step 4: Commit** `feat(he): SEO/GSC locale plumbing from lib/locale — he paths parsed, fan-out gated by PUBLIC_LOCALES`.

---

### Task 3: Head signals + hreflang sampler + sitemap rules

**Files:**
- Modify: `src/lib/seo.ts` (`languageAlternates`/`staticAlternates` already gate on `PUBLIC_LOCALES` — verify; add `ogLocale(lang)` → `he_IL`/`en_GB`… from `BCP47`), `src/app/[lang]/layout.tsx` + the preview layouts (`openGraph.locale`), JSON-LD emitters (grep `"@type"` under `src/app` for WebPage/Organization/Product/Article/FAQPage schemas) → `inLanguage: BCP47[lang]` where missing (LTR gains the same field — list in the acceptance doc), `src/app/sitemaps/[type]/route.ts` (he rows only when `status: PUBLISHED` and `he` public; landing pages, case studies, developers, projects; blog per Phase 6).
- Create: `scripts/qa/hreflang-check.mjs [host] [--json]` — fetches a URL list (the `rtl-matrix.mjs` list + the 17 landing slugs + one item per type), parses `<link rel="alternate" hreflang>` and `<link rel="canonical">`, `og:locale`, `robots`, JSON-LD `inLanguage`, asserts: `x-default` → en, every `he` URL has a reciprocal `he` alternate on its `en` page and vice versa, `he_IL` og:locale on `/he/*`, `noindex` only where intended (`/he/blog*`, gated pages), `inLanguage: he-IL`. Prints a table; exit 1 on failures. No browser.
- Test: `scripts/qa/__tests__/hreflang-check.test.mjs` for the parser/assertion helpers with HTML fixtures.

- [ ] **Step 1: Tests first** (parser: alternates map, canonical, og:locale, robots, JSON-LD inLanguage; assertions with a fixture pair en/he).
- [ ] **Step 2: Implement** signals + sampler; run the sampler against `http://localhost:3000` only if a dev server is already running (do not start one); otherwise document the staging command.
- [ ] **Step 3: Gates** tsc, tests, snapshot (JSON-LD/og additions are LTR-visible metadata, not copy — list them).
- [ ] **Step 4: Commit** `feat(he): og:locale, JSON-LD inLanguage, sitemap he rules, hreflang sampler`.

---

### Task 4: Phase 2b — physical declarations to zero, font double-load check

**Files:**
- Modify: every file `node scripts/qa/rtl-physical-count.mjs` lists (107 declarations; top: `PropertyIntro.module.scss` 11, `ModalBrochure.module.scss` 8, `HeroSlide.module.scss` 7, `BlogSlide.module.scss` 7, `CaseStudyIntro.module.scss` 6, `preview-insights/articleForm.css` 5, `ProjectLink.module.scss` 5, …), `scripts/qa/rtl-exceptions.txt` (only for genuine physical needs: centring anchors, transforms, background positions tied to imagery — each with a one-line reason), `src/app/[lang]/layout.tsx` (verify `Rubik` with `hebrew` subset and `rubikHebrew` from `fonts/hebrew.ts` do not load the same family twice; keep one, document).
- Test: `scripts/qa/rtl-physical-count.mjs --strict` exits 0.

- [ ] **Step 1:** run the codemod `node scripts/codemods/rtl-logical.mjs --dry-run` on the listed files, inspect, apply; manual passes for what the codemod skips (`float`, `text-align` with centring, `border-*-radius` corners → logical `border-start-start-radius` etc., positioned `left/right` → `inset-inline-*` except centring anchors).
- [ ] **Step 2:** `node scripts/qa/rtl-physical-count.mjs --strict` → 0; `npm test`; `tsc`; snapshot clean (CSS only). Font check: a small test that `[lang]/layout.tsx` references each Google font family once.
- [ ] **Step 3: Commit** `style(rtl): Phase 2b — physical declarations to zero; single Hebrew font load`.

---

### Task 5: Launch guard, Phase 9 checklist, acceptance doc

**Files:**
- Create: `scripts/qa/he-launch-check.mjs` (read-only; no DB by default): checks `he-placeholders.mjs` → TODO 0; every `content/he/**` file has `review` metadata and a `c-*.md` protocol exists per pack; `rtl-physical-count.mjs --strict` 0; `he-content-check.mjs` OK; the nginx rule in `ops/nginx/cyprusvipestates.conf` matches `(de|pl|ru|he)`; with `--host <staging>` additionally runs `hreflang-check.mjs` and `he-smoke.sh`; prints a launch table and exit code. Test `scripts/qa/__tests__/he-launch.test.mjs` for the pure checks with fixtures.
- Create: `docs/i18n/launch-checklist.md` (Phase 9, operator-only; the spec's list: nginx reload, `NEXT_PUBLIC_LIVE_LOCALES` in production, deploy, GSC property, sitemap resubmission, IndexNow ping for all `he` URLs, first 6 URLs manually in GSC (quota), 14-day monitoring with the known false-alarm classes; plus: add Hebrew to the terms §12 language list in all four LTR versions at launch, Pass C decision revisit, `REVIEW(he)` markers removal policy).
- Create: `docs/i18n/acceptance/phase-7-8.md` (gates, operator test-lead steps on staging: submit a Hebrew form with `[TEST]` in the name, verify CRM language HE, Hebrew auto-reply, Telegram tag, booking page, then trash the lead; hreflang sampler against staging; deferred items).

- [ ] **Step 1:** tests for the launch-check helpers; implement; run locally (no host).
- [ ] **Step 2:** docs; gates; commit `docs+qa(he): launch guard, Phase 9 checklist, Phase 7-8 acceptance`.

---

## Self-review

- Spec coverage: Phase 7 (forms/API/languagePreference/auto-reply/booking/presentation/signature/playbook/Telegram) — copy done in Phase 4 WP7; code gaps closed in Task 1; test lead = operator. Phase 8 (hreflang sampling, sitemap rules, robots, inLanguage, og:locale, GSC/queries/page-power/templateClass/classVerdicts, IndexNow, fonts, launch guard) — Tasks 2, 3, 4, 5. Phase 9 — checklist doc only (Task 5). Phase 2b — Task 4.
- Placeholder scan: none.
- Type consistency: `localeFromPath` (Task 2) used by `deriveLocale`/`localeOfPath`; `resolveProjectInterest` signature fixed in Task 1; `ogLocale` in Task 3; the grep test in Task 2 also covers Tasks 1/3/4 files.
