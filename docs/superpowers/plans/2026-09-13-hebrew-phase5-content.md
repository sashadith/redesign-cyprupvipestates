# Hebrew Localization — Phase 5 (Content) + Phase 6 (Blog Index) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page in spec §4.1/§4.2 gets a Hebrew content version — authored as versioned files in the repo, validated by a gate, and seeded into the shared database from the staging server — plus a server-side translation queue for the volume content (developments, areas, developers) and the cross-locale Hebrew blog index.

**Architecture:** Content is *authored in git* (`content/he/**` JSON + `scripts/faq-translations/he.json` + legal `*.he.ts`), never written to the database from a laptop (the local DB is production). A read-only export script snapshots the English source rows once (declared production read); Pass A/B translation agents write the Hebrew files; `scripts/qa/he-content-check.mjs` validates structure, style rules and links; `scripts/he-content/seed.mjs` upserts the pack idempotently and runs only on the staging server behind an explicit confirm flag. Volume content (200+ development descriptions, area texts, 88 developer profiles) is translated EN→HE by a new `translateHe` generator through `AiGenerationQueue`, processed by a cron route on the server and steered from a small admin page. Phase 6 adds the cross-locale blog index (EN articles under `/he/blog`, `noindex` while `he` has < 5 articles).

**Tech Stack:** Next.js 14 App Router, Prisma 5/Postgres (staging and production share one DB; `he` is a launch-gated locale, so seeded rows are invisible in production), Anthropic SDK (`src/lib/ai/*`, `heContext.ts`), node:test via tsx, plain `.mjs` scripts (self-contained, no `src/` imports).

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` — §1.3 (storage patterns), §3.5 (quality gate), §3.6 (SEO rules), §4.1/§4.2 (inventory), §5 Phase 5 + Phase 6, §6 (staging rules). Keyword page list: `docs/i18n/he-keyword-map.md` §4. Predecessor: `docs/superpowers/plans/2026-09-13-hebrew-phase4-copy.md` (its Global Constraints apply verbatim).

## Global Constraints

- Everything in the Phase 4 plan's Global Constraints (source = English, styleguide incl. §11, glossary wins, `bidiIsolate`/`ltrIsolate`, no `—`, Western digits, meta ≤ 60/≤ 155, LTR locales unchanged, gates, pathspec commits, reviewers read-only, never `node_modules`).
- **Database rule (spec §6):** no task writes to the database. The only local DB access is `scripts/he-content/export-en.mjs` (read-only `findMany`/`findUnique`, run once by the controller and labelled as a production read). Seeding happens on the staging server via `scripts/he-content/seed.mjs`, which refuses to run unless `CVP_CONFIRM_CONTENT_SEED=yes` and prints a dry-run first. Translation of volume content runs through the cron route on the server. Tests use in-memory fakes.
- **Pass C deferred (user decision 2026-09-13):** rows are seeded as `PUBLISHED` (the gated locale keeps them invisible in production); every content file carries `"review": "pending"` metadata; protocols are "light" (`docs/i18n/reviews/c-<pack>.md`: file, page, Pass B summary, open questions) — no per-key tables.
- **No invented facts:** figures (prices, yields, tax rates, timelines, counts) may appear only if present in the English source or in `docs/i18n/he-keyword-map.md`/glossary; evergreen texts follow the "no digits" rule of `src/lib/ai/projectDescription.ts`. Cyprus reality (lawyer, not notary; VAT and transfer-fee statements only as EN states them).
- **Slugs are Latin (decision A)**; landing page slugs exactly as in the keyword map §4; internal links only within `/he/**` (hub↔spoke) or to EN blog articles (decision C).
- **Homepage H2s** must equal the Hebrew H2 texts documented in `docs/i18n/reviews/wp3.md` ("Phase-6-CMS-Brief") so `ACCENTS_BY_LANG.he` matches.
- New gate: `node scripts/qa/he-content-check.mjs` (Task 1) must pass before every content commit.
- Branch: `worktree-he-phase5-content`, stacked on `worktree-he-phase4-copy` (PR #44). One PR at the end.

## File map

- Create `content/he/README.md` — pack layout, how files map to DB rows, seeding instructions.
- Create `content/he/source/**` — English source snapshots (export output; committed).
- Create `content/he/site-documents/{homepage,header,footer,notFoundPage,projectsPage,blogPage,caseStudiesPage,formStandardDocument}.he.json`.
- Create `scripts/faq-translations/he.json`; modify `scripts/seed-faq-translations.mjs` (add `he`, confirm guard).
- Create `content/he/case-studies/<slug>.he.json` (3), `content/he/singlepages/<slug>.he.json` (17 landing pages + about + contacts rows).
- Create `src/app/preview-legal/[lang]/[doc]/privacy.he.ts`, `terms.he.ts`; modify `registry.ts`.
- Create `scripts/he-content/export-en.mjs`, `scripts/he-content/seed.mjs`, `scripts/he-content/lib.mjs` (pure helpers), `scripts/qa/he-content-check.mjs`, tests in `scripts/qa/__tests__/he-content.test.mjs` (node:test, plain JS).
- Create `src/lib/heStyleRules.ts`, `src/lib/ai/translateHe.ts` (+ `src/lib/__tests__/translateHe.test.ts`), `src/app/api/cron/he-translate/route.ts`, `src/app/admin/(panel)/content/hebrew/{page.tsx,actions.ts}`.
- Modify `src/app/[lang]/blog/BlogInsights.tsx`, `src/app/[lang]/blog/page.tsx`, `src/sanity/sanity.utils.ts` (published-only count), sitemap route under `src/app/sitemaps/[type]/route.ts` (exclude `/he/blog*` while noindex).
- Create `docs/i18n/acceptance/phase-5.md`, `docs/i18n/reviews/c-*.md`.

---

### Task 1: Content-pack tooling — export (read-only), gate, seeder skeleton

**Files:**
- Create: `content/he/README.md`, `scripts/he-content/lib.mjs`, `scripts/he-content/export-en.mjs`, `scripts/he-content/seed.mjs`, `scripts/qa/he-content-check.mjs`, `scripts/qa/__tests__/he-content.test.mjs`
- Modify: `package.json` only if the `npm test` glob does not already include `scripts/qa/__tests__/*.test.mjs` (check the `"test"` script; if it only runs `src/lib/__tests__`, add a second glob rather than moving files).

**Interfaces:**
- Produces `lib.mjs`: `mirrorCheck(enValue, heValue, path) → string[]` (same keys, same array lengths, same `_type`s, same portable-text block/mark structure, string fields non-empty and containing Hebrew where EN had letters, non-text fields (`_key`, `_ref`, `url`, `slug`, `href`, numbers, booleans) identical), `styleCheck(str, path) → string[]` (forbidden: `—`, `–`, `!`, curly quotes, slash forms `/ת` `/ה`, `הכול`, `בטעינה`, `בשליחה`, `נוטריון`, `ממ"ד`, `חברות בנייה`; required: `נדל"ן` spelled with `"`), `linkCheck(href, packSlugs) → string|null` (allowed: `/he/<known pack slug>`, `/he/projects…`, `/he/blog…`, `/blog/…` EN article, absolute `https://cyprusvipestates.com/he/…`, mailto/tel; forbidden: `/de/`, `/pl/`, `/ru/`, bare `/en/`), `metaCheck(seo) → string[]` (≤ 60 / ≤ 155 graphemes via `Intl.Segmenter`), `walkStrings(json, fn)`.
- Produces `he-content-check.mjs`: loads every file under `content/he/**/*.he.json` + `scripts/faq-translations/he.json`, finds the matching source (`content/he/source/<same relative path>.en.json`; files without a source — freshly authored landing pages — skip `mirrorCheck` but run all other checks), runs all checks, prints `he-content: OK (N files, M strings)` or the violations with paths; exit 1 on violations. `--only <path>` filter.
- Produces `export-en.mjs`: read-only; writes `content/he/source/site-documents/<type>.en.json` (types listed in the file map), `content/he/source/case-studies/<slug>.en.json` (PUBLISHED EN case studies with `relatedProjects` slugs), `content/he/source/singlepages/<slug>.en.json` for `about-us`, `contacts` and every EN singlepage whose slug matches one of the keyword-map slugs (unmatched map slugs get no source and are authored fresh), `content/he/source/developers.en.json` (id, slug, title, excerpt, seo, description — 88 rows), `content/he/source/inventory.json` (per city/district: counts of PUBLISHED developments, price-from min/max, types — read from `Development`/`DevelopmentOverride`; used ONLY as fact basis, never copied into evergreen text as digits). Prints a banner `READ-ONLY EXPORT — production database` and never calls `create/update/upsert/delete`; a static test greps the file for those words.
- Produces `seed.mjs` skeleton: `--dry-run` (default) prints the plan (row → upsert/insert/skip with reason); real run requires `CVP_CONFIRM_CONTENT_SEED=yes`; `--only <kind>`; kinds: `site-documents`, `faq`, `case-studies`, `singlepages`, `legal-check` (no DB), each implemented in Task 9 except `site-documents` which this task implements fully (upsert on `type_language`, `sanityId: "<type>-he"`). Uses `@prisma/client` directly (self-contained). Exports a pure `planSeed(pack, existingRows) → Plan[]` that the tests call instead of spawning Prisma. Row-level guard: refuses to touch any row whose `language !== "he"`.

- [ ] **Step 1: Write failing tests** for `mirrorCheck`, `styleCheck`, `linkCheck`, `metaCheck` in `scripts/qa/__tests__/he-content.test.mjs` (≥ 12 cases: matching structures pass; missing key, extra key, array length drift, `_key` changed, EN letters but HE empty, `—`, `!`, `/de/` link, 61-grapheme title all fail; `/he/limassol` with pack slug `limassol` passes; `/blog/some-en-article` passes).
- [ ] **Step 2: Run** `node --test scripts/qa/__tests__/he-content.test.mjs` → fails (module missing).
- [ ] **Step 3: Implement** `scripts/he-content/lib.mjs` and make the tests pass.
- [ ] **Step 4: Implement** `he-content-check.mjs`, `export-en.mjs` (with the read-only static test), `seed.mjs` skeleton with the `site-documents` kind + dry-run + confirm flag; test `planSeed` for site documents (insert vs update vs skip, refusal on non-`he` rows).
- [ ] **Step 5: Write** `content/he/README.md` (layout, one paragraph per kind, the seeding command sequence for the operator, the "never run seed locally" rule).
- [ ] **Step 6: Gates** — `npm test` green, `node scripts/qa/he-content-check.mjs` prints OK for an empty pack, `npx tsc --noEmit -p tsconfig.json` clean.
- [ ] **Step 7: Commit** (pathspec) `tooling(he-content): export/check/seed scaffolding for the Hebrew content pack`.

**Controller step after Task 1 (not the implementer):** run `node scripts/he-content/export-en.mjs` locally (declared production read), inspect sizes, commit `content/he/source/**`.

---

### Task 2: Legal 5b — privacy and terms in Hebrew

**Files:**
- Create: `src/app/preview-legal/[lang]/[doc]/privacy.he.ts`, `terms.he.ts`
- Modify: `src/app/preview-legal/[lang]/[doc]/registry.ts` (replace the two `TODO(he)` EN aliases), the page component if a per-locale "binding language" note slot does not exist yet (add `bindingNote?: string` to the document shape, rendered under the H1; EN/DE/PL/RU leave it undefined → no change).

**Interfaces:** consumes `PRIVACY_EN`/`TERMS_EN` shapes (`LegalSection { id, heading, paragraphs[] }` — keep `id`s); produces `PRIVACY_HE`, `TERMS_HE` with identical section ids/counts and `bindingNote` = the glossary §5 "English binding" sentence (add it to the glossary §5 if missing: `הנוסח האנגלי של מסמך זה הוא הנוסח המחייב; התרגום לעברית נועד לנוחות בלבד.`).

- [ ] **Step 1: Pass A** (opus): translate both documents section by section; legal register (formal, impersonal, no marketing), Latin names (`Cyprus VIP Estates`, GDPR, Google Analytics, cookie names) isolated, e-mails/phones `ltrIsolate()`. Mark the tables `// REVIEW(he)`.
- [ ] **Step 2: Pass B** (fresh opus, read-only): critique file `.superpowers/sdd/2026-09-13-hebrew-phase5-content/task-2-passB.md`; apply rewrites.
- [ ] **Step 3: Gates** — `node scripts/qa/he-placeholders.mjs` → TODO(he) 0; tsc; tests; `he-meta-length` (legal meta pairs); protocol `docs/i18n/reviews/c-legal.md` (light).
- [ ] **Step 4: Commit** `i18n(he): legal documents — privacy and terms (Phase 5b)`.

---

### Task 3: SiteDocuments — homepage, header, footer, 404, projects page, blog page, case-studies page, form document

**Files:**
- Create: `content/he/site-documents/*.he.json` (8 files)
- Consumes: `content/he/source/site-documents/*.en.json`, types in `src/types/{homepage,header,footer,notFoundPage,projectsPage,blogPage,caseStudiesPage}.ts` and the `formStandardDocument` shape read at `src/sanity/sanity.utils.ts:741`.

- [ ] **Step 1: Pass A** (opus): for each document produce the Hebrew JSON mirroring the EN structure exactly (same keys, `_key`s, image refs; link targets rewritten to `/he/...` equivalents that exist in this pack or in code routes; navigation labels from glossary §4; homepage section H2s verbatim from `docs/i18n/reviews/wp3.md` "Phase-6-CMS-Brief"; hero H1 carrying `נדל"ן בקפריסין` naturally; SEO pairs within limits; the 404 document consistent with `NotFoundPageComponent` copy; header/footer link labels consistent with `NavWrapper.copy.ts`/`Footer.copy.ts`).
- [ ] **Step 2: Pass B** (fresh opus): critique + apply.
- [ ] **Step 3: Gate** `node scripts/qa/he-content-check.mjs --only content/he/site-documents` → OK; accent check: a 10-line node script asserts each `ACCENTS_BY_LANG.he` word is a whole-word substring of the corresponding H2 in `homepage.he.json`.
- [ ] **Step 4:** protocol `docs/i18n/reviews/c-site-documents.md`; commit `content(he): site documents (homepage, header, footer, 404, projects, blog, case studies, form)`.

---

### Task 4: FAQ — 60 questions and answers

**Files:**
- Create: `scripts/faq-translations/he.json` (mirrors `en.json`: same category slugs, item ids, answer paragraph counts)
- Modify: `scripts/seed-faq-translations.mjs` (`for (const lang of ["en","de","pl","ru","he"])`; add the same `CVP_CONFIRM_CONTENT_SEED` guard as `seed.mjs`), `src/app/preview-faq/[lang]/copy.ts` only if a `he` key is missing (should be complete from WP5).

- [ ] **Step 1: Pass A** (opus): translate every category label/description and Q&A; questions phrased as Israelis search (`מס רכישה בקפריסין`, `תושבות`, `רילוקיישן`); answers within EN facts — where EN states a notary appointment, render the Cyprus reality (signing at the lawyer's) and list the deviation in the protocol; terminology per glossary §3.
- [ ] **Step 2: Pass B** (fresh opus): critique + apply.
- [ ] **Step 3: Gate** `node scripts/qa/he-content-check.mjs --only scripts/faq-translations/he.json` (source `en.json`); FAQ JSON-LD: confirm the FAQ page emits `inLanguage` for `he` (read `src/app/preview-faq/[lang]/page.tsx`; add `inLanguage: BCP47[lang]` to the JSON-LD if absent — LTR output gains the same field, acceptable and noted).
- [ ] **Step 4:** protocol `docs/i18n/reviews/c-faq.md`; commit `content(he): FAQ — 60 Q&A, seeder extended to he`.

---

### Task 5: Case studies ×3 and the About/Contacts singlepage rows

**Files:**
- Create: `content/he/case-studies/<slug>.he.json` (3: title, fullTitle, excerpt, category, seo, clientOverview, caseDetails, mainContent portable text; `relatedProjects` by EN development slug — the seeder resolves them), `content/he/singlepages/about-us.he.json`, `content/he/singlepages/contacts.he.json` (the rows `src/app/preview-about/[lang]/data.ts` and `src/app/preview-contacts/[lang]/data.ts` read: team, reviews, previewImage refs — only text fields translated; the team's spoken-language strings stay as stored).

- [ ] **Step 1: Pass A** (opus) — stories in the register of the WP6 copy; client names and Latin project names isolated; prices/yields only as EN states; portable-text marks preserved.
- [ ] **Step 2: Pass B** (fresh opus): critique + apply.
- [ ] **Step 3: Gate** `node scripts/qa/he-content-check.mjs --only content/he/case-studies` and for the two singlepage files.
- [ ] **Step 4:** protocol `docs/i18n/reviews/c-case-studies.md`; commit `content(he): case studies ×3, about and contacts rows`.

---

### Task 6a: Landing pages 1–9 (cornerstone, apartments, investment, prices, Limassol hub, Limassol new projects, Paphos hub, Paphos apartments, Paphos villas)

**Files:**
- Create: `content/he/singlepages/<slug>.he.json` for keyword-map rows 1–9 (slugs from `docs/i18n/he-keyword-map.md` §4 without the `/he/` prefix; nested `limassol/new-projects`, `paphos/apartments`, `paphos/villas` carry `"parentSlug"` pointing at the hub file — the seeder resolves `parentSanityId`).

**Interfaces:** each file: `{ "slug", "title", "excerpt", "seo": {metaTitle, metaDescription}, "allowIntroBlock": true, "previewImage": <ref copied from the EN counterpart or from the hub>, "contentBlocks": [...], "relatedLandingPages": ["<pack slug>", ...], "translationGroupSlugEn": "<EN slug or null>", "parentSlug": "<pack slug or null>", "review": "pending" }`. Block types exactly those the EN landing pages use (read two EN sources first: `landingIntroBlock`, `landingTextStart/First/Second`, `landingProjectsBlock` with a city/type filter, `faqBlock`/`landingFaqBlock` with ≥ 4 Q&A, `buttonBlock` CTA). Portable text authored in the same shape the EN sources show (`_type: "block"`, `style`, `children[{_type:"span", text, marks}]`, `markDefs`), fresh `_key`s (12-char random).

- [ ] **Step 1: Author** (opus, Pass A): per page: H1 = map column "H1 (HE)" (adjust only for grammar), intro (120–180 words) with the primary keyword once and the secondary ones naturally, 2–3 text blocks specific to the page's inventory (use `content/he/source/inventory.json` for *which* cities/types exist — no figures unless EN pages carry them), a projects block filtered to the page's city/type, an FAQ block (4–6 Q&A), a CTA button to `/he/contacts`, `relatedLandingPages` = hub↔spoke per the map's "Hub/Spoke" column, meta title/description within limits carrying the primary keyword.
- [ ] **Step 2: Pass B** (fresh opus): critique against styleguide §7/§11, keyword naturalness (no stuffing), factual restraint, link graph (every spoke links its hub and the hub links all spokes); apply rewrites.
- [ ] **Step 3: Gate** `node scripts/qa/he-content-check.mjs --only content/he/singlepages` (link graph: every `relatedLandingPages`/`parentSlug` exists in the pack or in code routes).
- [ ] **Step 4:** protocol `docs/i18n/reviews/c-landing-a.md`; commit `content(he): landing pages 1–9`.

### Task 6b: Landing pages 10–17 (villas hub, seafront villas, houses, buying process, relocation, permanent residency, tax, Limassol investment apartments)

Same shape and steps as Task 6a for keyword-map rows 10–17. Extra rules: buying-process/residency/tax pages are informational-commercial — accurate to EN sources in the repo (`content/he/source/**`, FAQ `en.json`; blog articles are NOT sources for figures); where EN has no page, the text states the process qualitatively (steps, roles, documents) and links `/he/contacts`; the tax page must not state rates or treaty articles beyond what the EN FAQ says. Protocol `docs/i18n/reviews/c-landing-b.md`; commit `content(he): landing pages 10–17`.

---

### Task 7: EN→HE translation queue for developments, areas, developers

**Files:**
- Create: `src/lib/heStyleRules.ts`, `src/lib/ai/translateHe.ts`, `src/lib/__tests__/translateHe.test.ts`, `src/app/api/cron/he-translate/route.ts`, `src/app/admin/(panel)/content/hebrew/page.tsx`, `src/app/admin/(panel)/content/hebrew/actions.ts`
- Modify: `src/lib/ai/heContext.ts` (add kind `"translation"` if the existing kinds don't fit), the admin content index page (where FAQ/forms are listed) to link the new page, `scripts/he-content/lib.mjs` (its `styleCheck` list must equal `heStyleRules.ts` — a test asserts equality by reading both files).

**Interfaces:**
- `translateHe(input: { kind: "developmentDescription" | "developmentSeo" | "areaText" | "developerProfile"; en: { text?: string; title?: string; description?: string; excerpt?: string; portableText?: unknown }; facts?: string[] }, deps?: { client?: AnthropicLike }) → Promise<{ he: same shape; critique: string[]; attempts: number }>`: two model calls — Pass A translation with `heSystemBlock` + glossary, Pass B self-critique with the §11 rules returning a corrected version; guards from `localeTextGuards.ts` (`hasHebrew`, `scriptLeaks`) plus `heStyleRules`; one retry on violation, then throw. Portable text: translate span texts only, keep `_key`/marks/markDefs. Meta: ≤ 60 / ≤ 155 graphemes enforced with a retry.
- Queue: `AiGenerationQueue` rows with `entityType` in `development-description-he | development-seo-he | area-text-he | developer-profile-he`, `locale: "he"`, `status: PENDING|DONE|FAILED`, `result` = `{ he, critique, attempts, error? }`.
- Cron route `GET /api/cron/he-translate?limit=N` guarded like `src/app/api/cron/psi-sync/route.ts` (`CRON_SECRET` string compare; wrong key → 401): processes up to `limit` (default 10) PENDING rows oldest-first via a pure `processQueue(rows, deps)`, writes `DevelopmentOverride.descriptionHE` / `seo.titleHE+descHE` / `AreaDescription.textHE` / a `Developer` `he` row (translation group of the EN row, Latin slug = EN slug, `excerpt`, `description`, `seo`), marks DONE with `processedAt`; never overwrites an existing non-empty HE value unless the queue row has `prompt: "force"`; FAILED rows keep the error message.
- Admin page `/admin/content/hebrew` (English UI): counts (developments published / with HE, areas / with HE, developers / with HE), buttons "Enqueue missing (developments | areas | developers)", "Enqueue 15 sample" (deterministic: first 15 published developments by name), queue status table (pending/done/failed, last error), a sample view listing the 15 sample outputs EN vs HE side by side (`dir="rtl"` on the HE column) with a "Reject → re-enqueue with force" button. Server actions write only queue rows.

- [ ] **Step 1: Tests first** (`translateHe.test.ts` with a fake client): Pass A + Pass B calls happen in order; a critique that changes text is applied; a `scriptLeaks` violation triggers exactly one retry; portable text keeps `_key`s and mark structure; developer slug stays Latin; `heStyleRules` rejects `—`; `processQueue` writes the right field per entity type, respects the no-overwrite rule, marks FAILED with the error message.
- [ ] **Step 2: Implement** `heStyleRules.ts`, `translateHe.ts`, the equality test against `scripts/he-content/lib.mjs`.
- [ ] **Step 3: Cron route** + `processQueue`.
- [ ] **Step 4: Admin page + actions.**
- [ ] **Step 5: Gates** tsc, tests, `node scripts/qa/he-admin-fields-check.mjs`; commit `feat(he): EN→HE translation queue for developments, areas, developers + admin page + cron route`.

---

### Task 8: Phase 6 — Hebrew blog index (cross-locale)

**Files:**
- Modify: `src/app/[lang]/blog/BlogInsights.tsx`, `src/app/[lang]/blog/page.tsx` (+ `page/[n]` route), `src/sanity/sanity.utils.ts` (`getTotalBlogPostsByLang` counts `PUBLISHED` only — LTR-visible fix, listed in the acceptance doc), the sitemap route (`src/app/sitemaps/[type]/route.ts`), `src/app/[lang]/blog/blogI18n.ts` (new key `englishBadge`, EN `"In English"`, DE/PL/RU translated, `he` `באנגלית` with `REVIEW(he)`; register/refresh the snapshot with `--write --only`).
- Test: `src/lib/__tests__/blogCrossLocale.test.ts`.

**Interfaces:** `blogIndexMode(lang: string, heCount: number) → { sourceLang: "he" | "en"; noindex: boolean }` in a new `src/lib/blogIndexMode.ts` — for `lang === "he"` with `heCount < 5`: `{ sourceLang: "en", noindex: true }`; otherwise `{ sourceLang: lang, noindex: false }`. Cards from EN carry the badge and `href` to the EN article path (`/blog/<slug>`, no `/he/` prefix). Counter line uses the WP4 plural function with the EN count. Sitemap: `/he/blog` and `/he/blog/page/N` excluded while `noindex`; `generateMetadata` returns `robots: { index: false, follow: true }` in that mode.

- [ ] **Step 1: Tests** for `blogIndexMode` (he/0, he/4, he/5, en/0) and for the sitemap filter helper.
- [ ] **Step 2: Implement** the mode in `BlogInsights.tsx` (server component: fetch EN posts when `sourceLang === "en"`), metadata robots, sitemap exclusion, published-only count.
- [ ] **Step 3: Gates** tsc, tests, `node --import tsx scripts/qa/copy-snapshot.mjs --check`, `node scripts/qa/he-placeholders.mjs`.
- [ ] **Step 4: Commit** `feat(he): cross-locale blog index for he — EN articles with badge, noindex below 5 own articles, sitemap exclusion`.

---

### Task 9: Seeder completion, acceptance doc, operator runbook

**Files:**
- Modify: `scripts/he-content/seed.mjs` (kinds `faq` → the `he` upsert exactly as `seed-faq-translations.mjs` does; `case-studies` → upsert by `(language:"he", slug)`, `translationGroupId` from the EN row named by `translationGroupSlugEn`, `relatedProjects` resolved by development slug, `status: PUBLISHED`, `publishedAt: now` on insert only; `singlepages` → same, plus `parentSanityId` from `parentSlug`, `relatedLandingPages` resolved to `[{_ref: sanityId}]` of the seeded `he` rows (two passes: insert all, then link), `sanityId: "he-<slug>"`; `legal-check` → asserts `registry.ts` has no `TODO(he)`); `--dry-run` lists every row and the resolved references; idempotent (second run = 0 changes).
- Create: `docs/i18n/acceptance/phase-5.md` — gate numbers, operator steps in order: (1) deploy the branch to staging (stacked on #44), (2) `node scripts/he-content/seed.mjs --dry-run` in `/var/www/cve-staging` → read → `CVP_CONFIRM_CONTENT_SEED=yes node scripts/he-content/seed.mjs --yes` (both the env flag and `--yes` are required; without `--yes` it stays a dry run), (3) `CVP_CONFIRM_CONTENT_SEED=yes node scripts/seed-faq-translations.mjs --yes`, (4) open `/admin/content/hebrew`, "Enqueue 15 sample", trigger the cron route once with `limit=15`, read the samples, then "Enqueue missing" for all three kinds and add the staging crontab line (documented) to drain the queue, (5) `scripts/qa/he-smoke.sh https://design.cyprusvipestates.com live` + `node scripts/qa/rtl-matrix.mjs` + walk the 17 landing pages, FAQ, case studies, `/he/blog` (EN cards, noindex), (6) what stays deferred (Pass C, Phase 7, 8, 2b, 9).
- Modify: `docs/i18n/reviews/README.md` — add the content packs (`c-*.md`) to the reviewer's list.

- [ ] **Step 1: Tests** for `planSeed` per kind with fakes (insert vs update vs skip; nested parent resolution; related-pages two-pass linking; refusal on non-`he` rows; idempotency = second plan has zero writes).
- [ ] **Step 2: Implement** the kinds; `--dry-run` default; confirm flag.
- [ ] **Step 3: Full gate run**: `node scripts/qa/he-content-check.mjs` over the whole pack, `npm test`, tsc, `node scripts/qa/he-placeholders.mjs` (TODO 0), `node --import tsx scripts/qa/copy-snapshot.mjs --check`, `node --import tsx scripts/qa/he-meta-length.mjs`.
- [ ] **Step 4: Write** the acceptance doc; commit `docs(he): Phase 5 acceptance + seeder completion`.

---

## Self-review

- Spec coverage: 5a (Tasks 3 + 4), 5b (Task 2), 5c (Task 5), 5d (Tasks 6a/6b), 5e (Task 7 + operator runbook in Task 9), Phase 6 (Task 8), §3.6 SEO rules (Latin slugs, hub↔spoke links, JSON-LD `inLanguage` in Task 4, noindex/sitemap in Task 8), §6 DB rule (Task 1 export read-only; seeding server-side). Developer profiles: Task 7 queue (spec 4.3 "KI + Stichprobe" → 15-sample admin view).
- Placeholder scan: none; every task names files, shapes and commands.
- Type consistency: the style list lives once (`heStyleRules.ts`, equality test against `lib.mjs`), `planSeed(pack, existingRows)` is produced in Task 1 and completed in Task 9, `blogIndexMode` is defined and consumed in Task 8, `translateHe` kinds match the queue `entityType`s in Task 7.
