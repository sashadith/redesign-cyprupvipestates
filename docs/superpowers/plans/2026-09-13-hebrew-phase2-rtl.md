# Hebrew Localization — Phase 2: RTL Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public site renders correctly mirrored under `<html dir="rtl">` for `he` — logical CSS properties, direction-aware icons/carousels/menus, bidi-isolated numbers and Latin names, Hebrew typography rules — with zero visual change for en/de/pl/ru.

**Architecture:** (1) A repo-owned codemod converts the regex-safe physical properties (margin/padding/border-left|right, text-align, float) to logical ones across the in-scope stylesheets; a counting script with an exceptions allowlist becomes the acceptance gate. (2) The "hot core" stylesheets (nav, footer, forms, three flagship page types) get manual fixes for positioning, dropdown anchoring, slide-ins, select arrows and the reversed compact price. (3) Components with directional semantics (breadcrumb arrows, lightbox/pager glyphs and keys, Swiper, motion slide-ins, maps) become direction-aware. (4) Bidi isolation: a `<Bdi>` component, `ltrIsolate()` for plain strings, one `fmtPrice` (Phase 1 helper) replacing eight local copies. (5) `src/app/rtl.css` grows: Hebrew display headings, letter-spacing/text-transform neutralisation, isolate utilities, icon-flip utility.

**Tech Stack:** Next.js 14, CSS + SCSS modules (Tailwind only incidental), Swiper 11, GSAP/framer-motion, MapLibre/Leaflet, node:test via tsx, PostCSS (already a dependency) for the codemod.

**Spec:** `docs/superpowers/specs/2026-09-13-hebrew-localization-design.md` §3.2 and §5 "Phase 2". Inventory source: the Phase 2 RTL exploration (2026-09-13) summarised in this plan's task notes.

## Global Constraints

- Scope: `src/app/[lang]/**`, the seven `preview-*/[lang]` trees, and the shared trees they consume (`preview-home/sections|anim|tokens.css`, `preview-insights/*`, `preview-projects/{ProjectCard,ProjectsExplorer,ProjectsMap,PxSelect,projects.css}`, `preview-project/*`, `src/app/components/**` except dead files), `header-footer.css`, `globals.css`, `rtl.css`. OUT: `admin`, `sandbox*`, `style/`, `book/`, `c/` (both `dir="ltr"`), standalone `preview-{home,insights,projects}/{layout,page}.tsx`, and the dead components `NewListnigs`, `ProjectLinkAll`, `BrochureBlock`, `CitiesHomepage`, `LocaleSwitcher`, `DeveloperIntro`, `BlogIntro`, `AnimatedPreview`, `HomepageHero`.
- LTR locales must be pixel-identical: logical properties resolve to the same physical side in LTR; every RTL-only rule is scoped by `[dir="rtl"]` or `:lang(he)`.
- Never edit `margin: 0 auto` / `padding: a b c d` shorthands by regex; only `margin-(left|right):`, `padding-(left|right):`, `border-(left|right)(-width|-style|-color)?:`, `text-align: (left|right)`, `float: (left|right)`.
- Decorative atmosphere blobs (`::before/::after` clouds) stay physical and are listed in `scripts/qa/rtl-exceptions.txt`.
- Maps stay LTR (`dir="ltr"` on their containers).
- Hebrew typography: display headings use `--font-display-he` first; `letter-spacing: normal` and `text-transform: none` under `:lang(he)`.
- Bidi: prices, phone numbers, e-mails, URLs and Latin names inside Hebrew sentences are isolated (`<Bdi>` in JSX, `ltrIsolate()` in strings).
- Visual QA (screenshot matrix Desktop 1440 / Mobile 390, EN↔HE) needs a browser; this session runs browser tools only on explicit instruction, so Task 6 produces the URL matrix + checklist and the operator (or an explicitly authorised session) captures it after the staging deploy.
- Local gates: `npx tsc --noEmit -p tsconfig.json`, `npm test`, `node scripts/qa/rtl-physical-count.mjs --strict`. No `npm run build`, no Prisma, no deploy. Commit on `worktree-he-phase2-3`, explicit paths, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. No Telegram from tasks.
- This plan executes in the same worktree as the Phase 3 plan (admin files). Files are disjoint; commit-holds as in Phase 1 when both run.

---

## File map

| File | Responsibility |
|---|---|
| `scripts/codemods/rtl-logical.mjs` (create) + `scripts/codemods/__tests__/rtl-logical.test.mjs` (create) | `transformCss(src)` pure function + CLI (`--dry`, file list) |
| `scripts/qa/rtl-physical-count.mjs` (create), `scripts/qa/rtl-exceptions.txt` (create) | counts remaining physical declarations in scope, allowlist by `file:selector-or-line-fragment`, `--strict` |
| `src/app/rtl.css` (modify) | headings font, tracking/case neutralisation, `.bidi-isolate`, `.ltr-isolate`, `.icon-dir` flip |
| `src/app/components/Bdi.tsx` (create) | `<Bdi ltr?>` wrapper |
| `src/lib/locale.ts` (modify) | `ltrIsolate(s)` (U+2066 … U+2069), `fmtPrice` unchanged |
| 8 `fmtPrice` sites (modify) | import from `@/lib/locale`, wrap in `<Bdi ltr>` |
| in-scope CSS/SCSS (≈60 files, modify) | codemod output |
| hot core CSS (modify): `preview-home/tokens.css`, `header-footer.css`, `components/Header/Header.module.scss`, `preview-project/project.css`, `preview-insights/insights.css`, `preview-projects/projects.css`, `globals.css`, `Form{Full,Standard,Partners,MinimalBlockComponent}.module.scss`, `FormStatic.module.scss` | manual positioning fixes |
| TSX (modify): `Breadcrumbs*.module.scss`, `preview-project/Lightbox.tsx`, `preview-landing/LandingBody.tsx`, `PropertyPhotoGallery.tsx`, 9 Swiper components, 5 `*Motion.tsx`, `map/MapLibre.tsx`, `ProjectsMapAll.tsx`, `PropertyMap.tsx` | direction-aware behaviour |
| bidi sites (modify): `ContactChannels.tsx`, `Footer/FooterContact.tsx`, `preview-home/sections/FooterContact.tsx`, `preview-home/sections/Form.tsx`, `formFeedbackCopy.ts`, `QualificationForm.tsx`, `preview-contacts/[lang]/copy.ts`, `ContactFullBlockComponent`, `ContactLink`, `developmentSeo.ts:174,207`, `developers/[slug]/DeveloperProjectsGrid.tsx`, `preview-projects/ProjectsExplorer.tsx`, `ProjectPageBody.tsx`, `UnitsView.tsx`, `ProjectLink.tsx`, `BlogSlide.tsx`, `PropertyFeatures.tsx` | `<Bdi>` / `ltrIsolate` |
| `docs/i18n/rtl-qa-checklist.md`, `scripts/qa/rtl-matrix.mjs`, `docs/i18n/acceptance/phase-2.md` (create) | visual QA matrix + acceptance |

---

### Task 1: Foundations — rtl.css, `<Bdi>`, `ltrIsolate`, one `fmtPrice`, counting script, codemod (with tests)

**Files:** create `scripts/codemods/rtl-logical.mjs`, `scripts/codemods/__tests__/rtl-logical.test.mjs`, `scripts/qa/rtl-physical-count.mjs`, `scripts/qa/rtl-exceptions.txt`, `src/app/components/Bdi.tsx`; modify `src/app/rtl.css`, `src/lib/locale.ts`, `src/lib/__tests__/locale.test.ts`, `package.json` (test glob adds `scripts/codemods/__tests__/*.test.mjs`), and the 8 local `fmtPrice` sites: `preview-projects/ProjectCard.tsx:75`, `preview-projects/ProjectsMap.tsx:27`, `preview-project/ProjectPageBody.tsx:45`, `preview-project/UnitsView.tsx:64`, `preview-home/sections/FeaturedSlider.tsx:20`, `preview-home/sections/LatestDevelopments.tsx:12`, `components/ProjectLink/ProjectLink.tsx:101`, `components/BlogSlide/BlogSlide.tsx:86`, `components/PropertyFeatures/PropertyFeatures.tsx:242`.

**Interfaces:**
- `transformCss(src: string): string` — replaces, property-anchored (`/(^|[;{\s])(margin|padding)-(left|right)\s*:/g` → `$1$2-inline-$3→start|end:`), `border-(left|right)(-width|-style|-color)?` → `border-inline-(start|end)$suffix`, `text-align\s*:\s*(left|right)` → `start|end`, `float\s*:\s*(left|right)` → `inline-start|inline-end`. Never touches `margin:`/`padding:` shorthands, `*-radius`, `left:`/`right:`, `background-position`, `translateX`.
- CLI: `node scripts/codemods/rtl-logical.mjs [--dry] <files…>`; prints per-file replacement counts.
- `rtl-physical-count.mjs`: scans the in-scope CSS/SCSS list (hard-coded scope globs + the dead-file exclusion list from Global Constraints), counts `margin|padding|border-(left|right)`, `text-align: left|right`, `float: left|right`, `(^|\s)(left|right)\s*:`, `translateX(`, `row-reverse`, `background-position:\s*right`; subtracts lines matching an entry of `rtl-exceptions.txt` (format `path :: substring`); prints per-file table + total; `--strict` exits 1 if total > 0. Report the baseline number in the task report.
- `ltrIsolate(s: string): string` → `"⁦" + s + "⁩"` (LRI…PDI) — for phone numbers/e-mails/prices inside plain copy strings; test in `locale.test.ts`.
- `<Bdi ltr?: boolean>` → `<bdi className={ltr ? "ltr-isolate" : "bidi-isolate"}>{children}</bdi>`.
- `rtl.css` additions:
```css
.bidi-isolate { unicode-bidi: isolate; }
.ltr-isolate { direction: ltr; unicode-bidi: isolate; }
[dir="rtl"] .icon-dir { transform: scaleX(-1); }
:lang(he) :is(h1, h2, h3, h4, .display, .h1, .h2, .h3) { font-family: var(--font-display-he, serif), var(--font-display), serif; }
:lang(he) *:not(.keep-tracking) { letter-spacing: normal !important; }
:lang(he) *:not(.keep-case) { text-transform: none !important; }
```

- [ ] Step 1: tests for `transformCss` (fixtures: `margin-left: auto` → `margin-inline-start: auto`; `margin: 0 auto` untouched; `border-left-color: red` → `border-inline-start-color`; `border-top-left-radius` untouched; `text-align: right` → `end`; `left: 0` untouched; SCSS nested block preserved) and for `ltrIsolate` → RED.
- [ ] Step 2: implement all; `npm test` GREEN; `node scripts/qa/rtl-physical-count.mjs` prints a baseline (expect ≈500; record it).
- [ ] Step 3: replace the 8 local `fmtPrice` copies with `import { fmtPrice } from "@/lib/locale"` and wrap the rendered value in `<Bdi ltr>` (keep each component's existing "price on request" branch). `ProjectLink.tsx`, `BlogSlide.tsx`, `PropertyFeatures.tsx` switch from the `1 234 €` suffix form to `fmtPrice` (prefix `€1,234`) — the spec's convention — note it in the report as an intentional EN/DE/PL/RU visual change and list the three files.
- [ ] Step 4: `npx tsc --noEmit` clean; commit `feat(rtl): foundations — rtl.css utilities, Bdi, ltrIsolate, single fmtPrice, codemod + physical-count gate`.

---

### Task 2: Run the codemod over the in-scope stylesheets

**Files:** all in-scope `.css`/`.scss` (list generated by `rtl-physical-count.mjs --list`, add that flag if missing) minus the dead files and `book/`/`c/`.

- [ ] Step 1: `node scripts/codemods/rtl-logical.mjs --dry $(node scripts/qa/rtl-physical-count.mjs --list)` — review the per-file counts (expected ≈141 replacements over ≈45 files).
- [ ] Step 2: run without `--dry`; `git diff --stat`; spot-check 5 files (`tokens.css`, `header-footer.css`, `insights.css`, `FormStatic.module.scss`, `Header.module.scss`) that nothing but the six property families changed.
- [ ] Step 3: `npx tsc --noEmit`, `npm test`; `node scripts/qa/rtl-physical-count.mjs` → total dropped by ≈141; commit `refactor(css): logical inline properties via rtl-logical codemod (LTR-identical)`.

---

### Task 3: Hot-core manual CSS fixes

**Files:** `preview-home/tokens.css`, `header-footer.css`, `components/Header/Header.module.scss`, `preview-project/project.css`, `preview-insights/insights.css`, `preview-projects/projects.css`, `globals.css`, `FormFull|FormStandard|FormPartners|FormMinimalBlockComponent|FormStatic .module.scss`, `WhatsAppButton.module.scss`, `CustomCookieConsent.module.scss`, `StyledProjectFilters.module.scss`, `Breadcrumbs.module.scss`, `BreadcrumbsBlog.module.scss`, `SliderReviewsFull.module.scss:258`, `ProjectsMapAll.module.scss:11`; `scripts/qa/rtl-exceptions.txt`.

Fix list (each: convert or scope with `[dir="rtl"]`):
1. Dropdown/menu anchoring: `.nav__dropdown { left: 0 }` → `inset-inline-start: 0`; `.lang__menu { right: 0 }` → `inset-inline-end: 0` (header-footer.css:132,158 and the duplicates tokens.css:230,257).
2. Mobile menu (live `[lang]` tree): `Header.module.scss:65-88` `.navWrapper { left: 200vw; right: 0 }` / `.navWrapperOpen { left: 0 }` → `inset-inline-start: 200vw` / `0`; `.subLinks { left: -10px }` (299) and `:224` → `inset-inline-start`; `.chevron { margin-right }` (399) → `margin-inline-end`.
3. Underline `::after { left: 0 }` growth (Header.module.scss:221-228, 355-364; header-footer.css:113; tokens.css:211) → `inset-inline-start: 0`.
4. Badges/overlay chips (tokens.css:560,763; projects.css card overlays) → `inset-inline-start`.
5. Floating CTAs: `WhatsAppButton` (`right:1rem`), tokens.css:1168, `.pp-note` (project.css:51), cookie consent (`left: 20px`) → logical `inset-inline-*` so they mirror consistently.
6. `background-position: right …` select arrows (tokens.css:986, projects.css:40 with `padding-right: 34px`) → add `[dir="rtl"] … { background-position: left …; padding-inline-start: 34px; padding-inline-end: …original }`.
7. **Compact price** `projects.css:449 .prj--compact .prj__price { flex-direction: row-reverse }` → keep for LTR, add `[dir="rtl"] .prj--compact .prj__price { flex-direction: row; }` AND ensure the price node is `<Bdi ltr>` (Task 1) so `€1,234` never reorders.
8. Drop-cap `insights.css:346 float: left` → codemod handles `float: inline-start`; verify.
9. `msub__list { padding: 0 0 12px 6px }` (header-footer.css:231, tokens.css:332) → `padding: 0 0 12px; padding-inline-start: 6px`.
10. `translateX` slide-ins: audit the 20 sites; those paired with `left: 50%` centring stay; genuine slide-ins get `[dir="rtl"]` mirrored values.
11. Decorative blobs (tokens.css:618,620,738,740,831,833,1085,1086; header-footer.css:280,281; about.css; project.css): add to `rtl-exceptions.txt` with a comment line, leave physical.
12. Symmetric `left:0; right:0` pairs: convert to `inset-inline: 0` where trivial, else exception-list.

- [ ] Verify: `node scripts/qa/rtl-physical-count.mjs` total (report); `npx tsc --noEmit`; `npm test`. Commit `feat(rtl): hot-core CSS — menus, dropdowns, badges, CTAs, select arrows, compact price, exceptions list`.

---

### Task 4: Direction-aware components (arrows, keys, Swiper, motion, maps)

**Files:** `Breadcrumbs.module.scss:24`, `BreadcrumbsBlog.module.scss:26` (`[dir="rtl"] & { content: "←" }` via `:global` or a nested `[dir="rtl"] &` selector in SCSS modules), `preview-project/Lightbox.tsx:33-34,95,97`, `preview-landing/LandingBody.tsx:179-200`, `PropertyPhotoGallery.tsx:121,150-155`, the 9 Swiper components (`FeaturedProjectsSlider`, `ProjectCardSlider`, `ProjectSlider`, `PropertyPhotoGallery`, `PropertySlider`, `SliderMain`, `SliderReviews`, `SliderReviewsFull`, `preview-home/sections/FeaturedSlider.tsx`), 5 motion files (`AboutMotion.tsx:86`, `ArticleMotion.tsx:34`, `PreviewMotion.tsx:100`, `LegalMotion.tsx:38`, `CaseStudyMotion.tsx:34`), `map/MapLibre.tsx:141`, `ProjectsMapAll.tsx` `.mapWrap`, `PropertyMap.tsx` `.propertyMap`.

**Interfaces:** a tiny client hook `useIsRtl()` in `src/app/components/useIsRtl.ts` (`typeof document !== "undefined" && document.documentElement.dir === "rtl"`, SSR-safe default `false`, re-evaluated on mount) — used by Lightbox/pager/gallery/motion; Swiper gets `dir={isRtl ? "rtl" : "ltr"}` (Swiper accepts the `dir` attribute on the container) — for server components pass `localeDir(lang)` down instead.

- [ ] Step 1: `useIsRtl` + unit test of the pure `isRtlDoc(doc)` helper.
- [ ] Step 2: glyph swaps: prev/next glyph strings chosen by `isRtl` (`‹ ›`, `❮ ❯`), keyboard: `ArrowRight` → prev when rtl, `ArrowLeft` → next when rtl; breadcrumb arrow via CSS `[dir="rtl"]` rule; `PropertyPhotoGallery` `left-0`→`start-0`, `right-2`→`end-2`.
- [ ] Step 3: Swiper `dir` on all nine; motion `x: isRtl ? 40 : -40` pattern (keep magnitudes).
- [ ] Step 4: maps: `dir="ltr"` on the three containers; MapLibre control position stays `bottom-right`.
- [ ] Verify: `npx tsc --noEmit`, `npm test`; `grep -rn "<Swiper" src/app --include='*.tsx' | grep -vc "dir="` → 0 for the nine. Commit `feat(rtl): direction-aware arrows, keys, Swiper, motion, LTR maps`.

---

### Task 5: Bidi isolation of prices, phones, e-mails, Latin names

**Files:** `ContactChannels.tsx:21-22`, `Footer/FooterContact.tsx`, `preview-home/sections/FooterContact.tsx`, `ContactFullBlockComponent`, `ContactLink`, `preview-home/sections/Form.tsx:61-90`, `formFeedbackCopy.ts:25-43`, `QualificationForm.tsx:22-25`, `preview-contacts/[lang]/copy.ts:266-267`, `preview-partners/[lang]/copy.ts` phone lines, `developmentSeo.ts:174,207`, `developers/[slug]/DeveloperProjectsGrid.tsx:41`, `preview-projects/ProjectsExplorer.tsx:296,351`, `ProjectPageBody.tsx:168`, `UnitsView.tsx:71`.

Rules: JSX values → `<Bdi ltr>` for phone/e-mail/price, `<Bdi>` for Latin names; plain strings (copy tables, generated sentences) → `ltrIsolate("+357 …")` / for names in generated Hebrew sentences `"⁨" + name + "⁩"` (FSI…PDI) via a new `bidiIsolate(s)` helper next to `ltrIsolate` (add + test). Do not touch the `privacy.*.ts` legal texts (Phase 5b rewrites them).

- [ ] Verify: `grep -rn "+357" src/app/components src/app/preview-home/sections | grep -vc "ltrIsolate\|Bdi"` → only definitions/constants remain; `npx tsc --noEmit`, `npm test`. Commit `feat(rtl): bidi-isolate prices, phones, e-mails and Latin names`.

---

### Task 6: Visual QA matrix, checklist, acceptance

**Files:** create `docs/i18n/rtl-qa-checklist.md`, `scripts/qa/rtl-matrix.mjs` (prints EN↔HE URL pairs × viewports for the page types: home, projects list, project (Development), developers list/profile, blog index, blog article (EN under /he/blog per decision C — note), about, contacts, FAQ, legal, case study, landing page; host from argv), `docs/i18n/acceptance/phase-2.md`.

Checklist sections: header/nav/lang menu, mobile menu slide, breadcrumbs, cards + badges, carousels (order, arrows), forms (labels, phone input, error copy), footer, prices/phones (no reordering), maps LTR, typography (no letter-spacing/uppercase artefacts, Hebrew headings in Frank Ruhl Libre), motion direction, 404 page. Acceptance: `rtl-physical-count.mjs --strict` = 0 (with exceptions), tests/tsc green, matrix captured by the operator after the staging deploy (browser tools only on explicit instruction).

- [ ] Commit `docs(i18n): RTL QA checklist, screenshot matrix script, Phase 2 acceptance`.

---

## Self-review

- Spec §3.2 coverage: (1) dir attribute — Phase 1 ✔; (2) Tailwind — T1/T4 (only 3 sites exist) ✔; (3) SCSS codemod + manual list ✔ T1–T3; (4) directional components ✔ T4; (5) bidi islands + fmtPrice ✔ T1/T5; (6) maps LTR ✔ T4; (7) visual QA ✔ T6 (operator-captured). Typography (§3.3 spirit) ✔ T1.
- Placeholders: none; every rule has file:line targets from the inventory.
- Type/name consistency: `transformCss`, `ltrIsolate`, `bidiIsolate`, `<Bdi ltr>`, `useIsRtl`/`isRtlDoc`, `rtl-physical-count.mjs --list/--strict`, `rtl-exceptions.txt` format `path :: substring` — used consistently across tasks.
