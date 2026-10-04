# Hebrew Localization — Phase 4: UI-Chrome Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every inline UI copy table on the public site has a genuine Hebrew entry produced by the two-pass process (translation + independent critique against `docs/i18n/he-styleguide.md` and `he-glossary.md`), marked `REVIEW(he)` until the native reviewer signs it off; a missing or placeholder entry is a compile-time or gate error, never a silent English fallback.

**Architecture:** (1) Type hardening first: every copy table becomes `Record<Locale, T>`; ternary-chain copy is lifted into tables; four-locale unions become `Locale`; wrong fallbacks fixed. This makes the compiler enumerate the work and turns the `TODO(he)` counter into a real gate. (2) Seven translation work packages (WP1–WP7), each: Pass A translation → Pass B critique diff → apply → `docs/i18n/reviews/<wp>.md` side-by-side protocol for Pass C (native reviewer). (3) Markers: `TODO(he)` = untranslated placeholder; `REVIEW(he)` = translated, awaiting native review; the counter reports both; Phase 8's launch gate needs both at 0. (4) Meta-length gate for Hebrew SEO strings.

**Tech Stack:** Next.js 14, TypeScript, node:test via tsx; translation by Claude subagents with the style guide + glossary as context; no external translation API.

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.5 (quality gate), §4.1 (page list), §5 "Phase 4". Inventory: `docs/i18n/he-copy-inventory.md` (this branch).

## Global Constraints

- Translation source is **English** (never German). Every Hebrew string follows `docs/i18n/he-styleguide.md` (register §1–3, ktiv male, straight quotes, `נדל"ן` with gershayim, no `—`, Western digits, `€` before the number, masculine plural or nominal address) and `docs/i18n/he-glossary.md` (place names, property terms, UI labels, boilerplate). Glossary wins on conflicts; a needed term missing from the glossary is added to `docs/i18n/he-glossary.md` §6 in the same commit.
- Marker convention: an English placeholder carries `// TODO(he)`; a translated entry carries `// REVIEW(he)` until Pass C; after native sign-off the marker is removed (Phase 8). `node scripts/qa/he-placeholders.mjs` prints both counts; `--strict` fails while either is > 0.
- Interpolated strings keep their placeholders/functions intact (`${…}`, `(n) => …`); Hebrew plurals use the dual/plural forms correctly; Latin names inside Hebrew sentences are wrapped with `bidiIsolate()` (string) or `<Bdi>` (JSX) in the `he` entry only; phone/e-mail tokens in `he` strings use `ltrIsolate()`.
- Do not translate: brand/company/developer/project names, URLs, slugs, asset paths, query `value`s, `LegalSection.id`s, `numLocale` (stays `"en-US"`), `PRICE_FORMAT.he`.
- Out of scope here: legal documents (`privacy`/`terms` → Phase 5b; registry keeps the EN alias), Partners page copy (decision J), blog articles, admin UI.
- SEO strings in `he`: meta title ≤ 60 characters, meta description ≤ 155, H1 = natural-language intent with the primary keyword from `docs/i18n/he-keyword-map.md` where a mapped page exists.
- LTR locales unchanged: refactors (table extraction, type widening) must not alter any en/de/pl/ru string; a test compares a snapshot of the EN/DE/PL/RU leaf strings before and after (`scripts/qa/copy-snapshot.mjs`).
- Local gates: `npx tsc --noEmit -p tsconfig.json`, `npm test`, `node scripts/qa/he-placeholders.mjs`, `node scripts/qa/he-meta-length.mjs`, `node scripts/qa/copy-snapshot.mjs --check`. No `npm run build`, no Prisma, no deploy. Commit on `worktree-he-phase4-copy` with pathspec commits, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Reviewers strictly read-only. Never touch `node_modules`.

---

## File map

| File | Responsibility |
|---|---|
| `scripts/qa/he-placeholders.mjs` (modify) | counts `TODO(he)` and `REVIEW(he)` separately; `--strict` fails on either |
| `scripts/qa/copy-snapshot.mjs` (create) | `--write` dumps all en/de/pl/ru leaf strings of the copy modules listed in `scripts/qa/copy-modules.json` to `scripts/qa/copy-snapshot.json`; `--check` diffs |
| `scripts/qa/copy-modules.json` (create) | list of copy module paths + export names (from the inventory) |
| `scripts/qa/he-meta-length.mjs` (create) | imports the copy modules via tsx and checks every `he` `metaTitle`/`metaDescription`/`title` used in metadata for the length limits |
| ~55 `Record<string,…>` copy tables (modify) | typed `Record<Locale, T>` with `he: EN, // TODO(he)` placeholders; fallbacks fixed |
| 34 ternary-chain files (modify) | copy lifted into `const COPY: Record<Locale, …>` tables at the top of each file |
| 26 four-locale union sites (modify) | `Locale`/`LOCALES`/`isLocale` |
| WP1–WP7 files (modify) | Hebrew entries with `REVIEW(he)` |
| `docs/i18n/reviews/README.md`, `docs/i18n/reviews/wp1.md … wp7.md` (create) | Pass C protocol: EN ↔ HE side by side, Pass B notes, open questions for the reviewer |
| `docs/i18n/he-glossary.md` (modify) | new terms in §6 → §1–5 |
| `docs/i18n/acceptance/phase-4.md` (create) | acceptance |

---

### Task 1: Gates — placeholder counter (two markers), copy snapshot, meta-length check

**Files:** modify `scripts/qa/he-placeholders.mjs`; create `scripts/qa/copy-modules.json`, `scripts/qa/copy-snapshot.mjs`, `scripts/qa/he-meta-length.mjs`, `scripts/qa/__tests__/copy-snapshot.test.mjs` (add `scripts/qa/__tests__/*.test.mjs` to the `npm test` glob).

**Interfaces:**
- `he-placeholders.mjs` output: per-file table with two columns, then `TODO(he): N  REVIEW(he): M`; `--strict` exits 1 if N+M > 0; `--todo-only` exits 1 only on N.
- `copy-modules.json`: `[{ "path": "src/app/[lang]/blog/blogI18n.ts", "exports": ["BLOG_STRINGS"] }, …]` covering every table in the inventory §1 (the executor fills it from `docs/i18n/he-copy-inventory.md`; ternary-chain files are added in Task 2 as they gain tables).
- `copy-snapshot.mjs`: loads each module with `tsx` (`node --import tsx`), walks the exported object for locales `en|de|pl|ru`, collects leaf strings (functions are invoked with fixed sample args `("Sample", "https://x", 3)` and their return string recorded), writes `scripts/qa/copy-snapshot.json` (`--write`) or compares (`--check`, exit 1 on any diff, printing the first 20 differences). Pure helper `collectLeaves(obj, locale)` unit-tested with a fixture.
- `he-meta-length.mjs`: for each module in `copy-modules.json`, if the `he` entry has keys matching `/^(metaTitle|title)$/` (used for `<title>`) or `/^metaDescription$/`, check ≤ 60 / ≤ 155 chars (grapheme count via `Intl.Segmenter`); prints violations; exit 1 on any.

- [ ] Steps: write the `collectLeaves` test → RED → implement → GREEN; generate `copy-snapshot.json` from the current tree (`--write`) and commit it (it is the LTR regression baseline for every later task); run `he-meta-length.mjs` (no `he` entries yet → 0 checks, exit 0). Commit `test(i18n): Phase 4 gates — two-marker placeholder counter, LTR copy snapshot, Hebrew meta-length check`.

---

### Task 2: Type hardening — exhaustive tables, lifted unions, fixed fallbacks (no Hebrew yet)

**Files:** every `Record<string, …>` copy table and every union in inventory §1/§3 (excluding legal, Partners tables keep `Record<string>` + EN fallback but gain an explicit `he: EN // TODO(he)`? — NO: Partners is out of scope by decision J; give Partners tables an explicit `he: …en` entry WITHOUT a marker and a comment `// decision J: Partners stays English for he`), `preview-landing/blockCopy.ts` (add fallback + he placeholder), six `PartnersPage/*` fallbacks `.de` → `.en`, `psi-sync/route.ts:17` `he: "/he"`, `inventorySearch.ts:50,78` `he` URL, `blog/[slug]/page.tsx:307` explicit EN image fallback for `he`.

Rules: the EN object becomes a named constant if inline (`const EN: T = {...}`), `he: EN, // TODO(he)`; type `Record<Locale, T>`; resolver functions keep their signature but lose the `?? EN` only where the type now guarantees the key (keep a defensive `?? EN` for junk `lang`). Unions → `import type { Locale }`; guards → `isLocale(lang)`.

- [ ] Steps: apply per file; after each batch of ~10 files run `node scripts/qa/copy-snapshot.mjs --check` (must be clean — no en/de/pl/ru string changed) and `npx tsc --noEmit`; finally `node scripts/qa/he-placeholders.mjs` (expect TODO(he) ≈ 60–70; record). Commit `refactor(i18n): exhaustive Record<Locale> copy tables with TODO(he) placeholders; unions lifted; fallbacks fixed`.

---

### Task 3: Ternary-chain copy lifted into tables (no Hebrew yet)

**Files:** the 34 files in inventory §5 addendum, heaviest first: `PropertyDistances.tsx` (24), `FormRoi.tsx` (24), `FormStatic.tsx` (20), `roi-calculator/RoiResults.tsx` (17), `RoiInputs.tsx` (11), `RoiChart.tsx` (9), `FormPartners.tsx` (8), `FormFull.tsx` (8), `RoiCalculator.tsx` (7), `[lang]/projects/[slug]/page.tsx` (4), `FormStandard.tsx` (4), `FormMinimalBlockComponent.tsx` (4), `pdf/ProjectPdfDocument.tsx` (2), `ModalRoi*.tsx`, `ModalPartners.tsx`, `CaseStudyIntro.tsx`, `BlogSlide.tsx`, and the 14 single-string files.

Pattern: at the top of the file `const COPY: Record<Locale, { key: string; … }> = { en: {...}, de: {...}, pl: {...}, ru: {...}, he: EN /* TODO(he) */ }` (`const EN` named), `const t = COPY[isLocale(lang) ? lang : "en"]`, replace each ternary with `t.key`. Strings must be moved verbatim (the snapshot gate catches drift). Add each new module to `scripts/qa/copy-modules.json` and regenerate the snapshot with `--write` ONLY for the newly added modules (the script supports `--write --only <path>`; add that flag in this task if missing).

- [ ] Steps: batch by package (forms, ROI, rest); `copy-snapshot.mjs --check` after each batch; tsc; tests; placeholder count recorded. Commit per batch: `refactor(i18n): lift ternary copy into Record<Locale> tables (forms|roi|misc)`.

---

### Tasks 4–10: Translation work packages WP1–WP7

Each WP task has the same shape; the executor is a translation-capable model (opus for Pass A and Pass B).

**Inputs:** `docs/i18n/he-styleguide.md`, `docs/i18n/he-glossary.md`, `docs/i18n/he-keyword-map.md` (for SEO strings), the WP's file list from `docs/i18n/he-copy-inventory.md`, the EN entries (source), the DE entries (reference only for tone — never translate from DE).

**Pass A (translate):** for every `he: EN, // TODO(he)` in the WP, write the Hebrew object following the guide; keep keys, placeholders and function signatures; wrap Latin names/phones/e-mails as required; SEO strings within length; record every new glossary term.
**Pass B (critique, separate agent, fresh context):** reads only the `he` entries + EN source + style guide/glossary; produces a list of violations (§7 forbidden patterns, gender agreement, calques, register, length) and rewrites; the controller applies the rewrites via the implementer.
**Marker:** each translated entry gets `// REVIEW(he)` (replace `TODO(he)`).
**Protocol:** `docs/i18n/reviews/wpN.md` — table: key · EN · HE · Pass B note · open question; plus a header with page(s), screenshots-to-check, and reviewer instructions (German).
**Gates per WP:** tsc, tests, `copy-snapshot.mjs --check` (LTR unchanged), `he-meta-length.mjs` (0 violations), `he-placeholders.mjs` (TODO(he) decreased by the WP's count).

- [ ] **Task 4 — WP1** Chrome/forms/consent/newsletter (~150). Includes `ltrIsolate()` on phone/e-mail tokens in the four marked dictionaries (`he` entries only).
- [ ] **Task 5 — WP2** Projects listing + Development page (~215). SEO: `developmentSeo.ts` labels/type labels feed every Development meta title — keep `fit()` budgets; `projectsI18n.ts` H1/meta.
- [ ] **Task 6 — WP3** Homepage (~90). `ACCENTS_BY_LANG`: add `he` accent word per section, chosen from the translated H2; ensure the accent is a whole word present in the Hebrew title.
- [ ] **Task 7 — WP4** Blog/insights/developers (~40). `PAGE_TITLE_SUFFIX`/`FALLBACK_DESC` are SEO.
- [ ] **Task 8 — WP5** About/Contacts/FAQ (~170). Contact page honesty line from the glossary §5 (Entscheidung E). Consultant language labels in `languages.ts` gain a `he` row (labels for en/de/ru/pl/es/fr/nl/el/kk/uz in Hebrew).
- [ ] **Task 9 — WP6** Case studies + landing chrome (~65).
- [ ] **Task 10 — WP7** Booking/presentation/CRM/e-mail/ROI (~250). `emailTemplates.ts` and ROI mail: `dir="rtl"` + `lang="he"` on `<html>`/`<body>` when `lang === "he"`, table-based layout untouched; ROI mail body labels move into the `t` table (fixing the EN-only gap for all locales — LTR strings identical); `ProjectPdfButton` hidden for `he` (spec: PDF not offered in Phase 1–4); CRM playbook `by-language.md` gets a Hebrew section (register, salutation, consulting-language note).

---

### Task 11: Glossary consolidation, reviewer handbook, acceptance

**Files:** `docs/i18n/he-glossary.md` (move §6 decisions into the tables), `docs/i18n/reviews/README.md` (how the native reviewer works: open each `wpN.md`, mark ✓/✗ per row, write the corrected Hebrew in a fourth column, return the file; the controller applies and removes `REVIEW(he)`), `docs/i18n/acceptance/phase-4.md` (numbers: TODO(he) 0, REVIEW(he) = total translated, meta-length 0 violations, snapshot clean, tests; what is deferred: legal 5b, Partners J, article translations; operator steps: staging deploy, walk `/he/*` pages listed in `scripts/qa/rtl-matrix.mjs`, read the Hebrew).

---

## Self-review

- Spec §5 Phase 4 coverage: all copy tables in §1.4/§4.1 ✔ (WP1–WP7); process §3.5 passes A/B ✔, C as protocol ✔; placeholder gate to 0 ✔ (TODO) with REVIEW as the new honest state; screenshot matrix re-run → acceptance doc points to `rtl-matrix.mjs`.
- Scope decisions restated: legal → 5b; Partners → J; PDF hidden for he.
- Names consistent: `copy-modules.json`, `copy-snapshot.mjs --write|--check|--only`, `he-meta-length.mjs`, markers `TODO(he)`/`REVIEW(he)`, `docs/i18n/reviews/wpN.md`.
