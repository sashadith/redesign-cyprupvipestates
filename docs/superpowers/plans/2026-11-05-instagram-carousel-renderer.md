# Instagram Carousel Renderer: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The MCP tool `render_instagram_carousel` renders the two approved carousel designs ("project" dark, "cyprus" light) from strict JSON into 6 JPGs (1080×1350) plus a preview sheet under `/uploads/social/…`. Layout rules are enforced before anything is saved. `crm_get_project` gains `gallery`, `amenities` and `vatNote`.

**Architecture:** The Next.js process never imports Playwright. The tool handler validates input, builds HTML from the approved templates, and spawns a separate Node worker (`scripts/social/carousel-worker.mjs`) under a cross-process lock and a hard 60 s timeout. The worker runs in its own process group, so a timeout kills the worker and Chromium together. The worker renders from `file://` only: fonts, brand assets and images are local files, and all network requests are aborted. It applies and measures the layout rules on real rendered pixels, shrinks headings if needed, and returns PNG buffers plus a measurement report. The parent writes JPGs atomically, or returns an error and writes nothing.

**Tech Stack:** Next 14.2.35, `@modelcontextprotocol/server`, zod, Prisma, `playwright-core` (Chromium headless shell), sharp 0.33, node test runner (`npm test`), tsx for QA scripts.

**Spec:** the operator's request of 2026-11-05 (chat), plus the approved designs in `assets/social-templates/` (templates/, reference-renders/, README.md). Operator decisions from 2026-11-05:
- Chromium may be installed on production; every server change is documented in DEPLOYMENT.md.
- One render at a time, hard timeout 60 s per carousel, Chromium always closed.
- A re-render of the same slug in the same week overwrites the old one.
- The tool is registered with the write tools.
- The folder week comes from the optional `postingDate`, as the ISO week in Europe/Nicosia; the render time is used only if `postingDate` is missing.
- The reference renders are the acceptance standard. A deviation of more than a few pixels in position or size fails.

## Global Constraints

- Do not redesign. CSS is copied verbatim from the approved HTML. Only text, images and the rule-driven adjustments (gap, heading size) vary.
- Fonts load from `assets/social-templates/fonts/*.ttf` via `file://` only. If a font fails to load, the render errors; it never falls back silently.
- These are static and never part of the input: logos, portrait, phone `+357 99 278 285`, the four advantages on slide 6, frame, footer/band, "Swipe/Weiter", slide numbers, pill "New development/Neubauprojekt", the slide-6 CTA, and the second eyebrows "Inside the apartments" and "Resort facilities".
- Images:
  - Accepted: `https://cyprusvipestates.com/uploads/…`, or URLs that `crm_get_project` returns for the project. Those are the same `/uploads` URLs.
  - Each image is resolved to a local file under the uploads root and must `realpath` inside it.
  - Rejected: `..`, query strings, `/uploads/social/…` (no slides inside slides), missing files, and non-images.
- Number format: DE `850.000 €`, EN `€850,000`.
- Admin/internal copy is English. Slide copy is EN/DE.
- No `u` regex flag in TS (tsconfig has no target). Tests must not break `next lint`.
- Deploy only after operator approval, with `CVP_RUN_MIGRATE=1` (new column).

## Decisions requested in the plan review (defaults in brackets)

- **D1 Rule 1 measurement [layout boxes]:**
  - The references were built with the content box bottom at y=1204 and the Swipe line box top at y=1246, a box gap of exactly 42.
  - Measured on ink, the references show about 50 px (content ink ends ≈1200–1202, Swipe ink starts at 1252).
  - Enforcing 42 px on ink would move all content ≈8 px down and fail the reference comparison.
  - Default: rule 1 on layout boxes (matches the references); rule 2 on ink pixels, as specified.
- **D2 Rule 2 value [44 on ink]:**
  - The references measure 42–43 px between eyebrow ink and heading ink, with an antialias threshold of 38/255.
  - Enforcing 44 moves the eyebrow 1–2 px up. That is inside the tolerance, so it is not a failure.
- **D3 Folder per language [`<slug>-<lang>`]:** EN and DE of the same project in the same week would otherwise overwrite each other. Example: `/uploads/social/2026-w46/soho-resort-east-tower-de/01.jpg`.
- **D4 `vatNote: "included"` text [EN "incl. VAT", DE "inkl. MwSt."]:** same style as "+ VAT".
- **D5 Cyprus in EN [allowed, no reference]:**
  - Only a DE design exists. EN uses the project-EN wording for the static parts: "Swipe", "Source:", "Why talk to us first" plus the four EN advantages, and "More in our <mark>Journal</mark><br>on our website." with "cyprusvipestates.com".
  - It cannot be pixel-compared; only the rules apply.
- **D6 Upper limit for text [first text ink ≥ y=520]:** Because text is anchored to the bottom line, long text pushes upward and the photo shrinks. Below 520 px of photo the rule fails ("photo too small"). The references stay ≥ 626 on split slides.
- **D7 Comparison tolerance ["a few pixels" = 3 px]:** for position and size per element.
- **D8 Project identification [`slug` of a published development, required for template=project]:** used for the image allow-list and the folder. For `cyprus`, the input requires a free kebab-case `slug`, e.g. `warum-zypern`.
- **D9 Cache-busting [returned URLs carry `?v=<renderId>`]:** the file paths stay stable (overwrite), but a re-render is not served stale.

---

## File Structure

| File | Responsibility |
|---|---|
| `assets/social-templates/**` | Approved originals as delivered: templates, fonts, brand, sample-images, reference-renders, README. Never edited. |
| `src/lib/social/carousel/schema.ts` | zod input schemas (`project`, `cyprus`), text limits, `markedWords` must occur exactly once in `headline`, `\n` = line break. |
| `src/lib/social/carousel/format.ts` | `formatPrice(n, lang)`, `vatText(vatNote, lang)`, `isoWeekFolder(postingDate?, now)` (Europe/Nicosia, ISO week-year), `outputDir(...)`. |
| `src/lib/social/carousel/imagePolicy.ts` | `resolveImage(url, uploadsRoot)` → `{ fileUrl }` or `ToolError("image_rejected", …)`. |
| `src/lib/social/carousel/staticCopy.ts` | The fixed EN/DE strings, copied from the approved templates (plus D5 EN cyprus). |
| `src/lib/social/carousel/css/project.css`, `css/cyprus.css` | The `<style>` blocks extracted verbatim from `project-dark-en.html` (plus the DE nowrap override) and from `cyprus-light-de.html` merged with the `slide6-final` additions. |
| `src/lib/social/carousel/templates.ts` | `buildProjectHtml(data, lang, assets)` / `buildCyprusHtml(...)`: markup per slide, identical to the originals, every value HTML-escaped, `data-role` attributes for measurement. |
| `scripts/social/carousel-worker.mjs` | Plain ESM worker: Playwright launch, network block, font check, rule pass (`fit`), measurement screenshots, final PNGs; prints a JSON report; `finally { browser.close() }`. |
| `scripts/social/carouselFit.js` | In-page script: shrinks headings in 2 px steps, sets the eyebrow gap from the measured ink. |
| `src/lib/social/carousel/render.ts` | Lock, spawn (detached process group, 60 s SIGKILL), report validation, JPG + preview sheet via sharp, atomic directory swap, orphan sweep. |
| `src/lib/mcp/tools/renderInstagramCarousel.ts` | MCP tool registration and handler. |
| `src/lib/mcp/toolNames.ts`, MCP server registry | Add the tool to `WRITE_TOOL_NAMES`; register it. |
| `src/lib/developmentGallery.ts` | `pageGallery(d)` and `pageAmenities(d)`: extracted from the project page, so page and connector share one source of order. |
| `src/app/preview-project/ProjectPageBody.tsx` (+ page loader) | Use the extracted helpers (no visible change). |
| `src/lib/mcp/tools/getProject.ts` | Add `gallery` (≤40, largest mirrored tier, absolute), `amenities`, `vatNote`; published projects only, otherwise `null`. |
| `prisma/schema.prisma` + `prisma/migrations/2026110510xxxx_development_vat_note/` | `Development.vatNote String?` with CHECK (`plus`, `included`); no sync writes it. |
| `src/app/admin/(panel)/developments/[id]/…` | Select "VAT on price: not shown / plus VAT / VAT included" + server action with its own admin guard. |
| `src/lib/__tests__/carousel*.test.ts` | Unit tests (schema, format, week, image policy, escaping, marked words). |
| `scripts/qa/carousel-testbed.mts` | Testbed verification (gated by `assert-not-prod-db`). |
| `DEPLOYMENT.md` | New section "Instagram carousel renderer (Chromium on the VPS)". |

---

### Task 1: Assets in the repo + extracted CSS

**Files:** Create `assets/social-templates/**` (from the zip, unchanged), `src/lib/social/carousel/css/project.css`, `css/cyprus.css`.

- [ ] Copy the zip contents unchanged (done locally: `scratchpad/wt-carousel/assets/social-templates/`, 55 files, 9.5 MB).
- [ ] Extract the `<style>` from `project-dark-en.html` to `project.css` byte-for-byte; append the DE block `.mark-word, .h-num, .vat { white-space:nowrap; }` (the DE template has it; for EN it is enforced by rule 4 anyway, so it is set for both languages).
- [ ] `cyprus.css` = the style of `cyprus-light-de.html` plus the additions from `cyprus-light-de-slide6-final.html` (`.hdr6`, `.phone6`, `.person6`, `.chk`).
- [ ] Font URLs in the CSS become placeholders `{{FONT_DIR}}`, filled with an absolute `file://` path at build time.
- [ ] Test: `css/*.css` equals the original `<style>` content apart from the placeholders and the documented additions (a diff test against the zip files).
- [ ] Commit.

### Task 2: Schema, formatting, week folder

**Files:** `schema.ts`, `format.ts`, tests.

**Interfaces (produces):**
```ts
type Lang = "en" | "de";
type Img = string; // absolute https://cyprusvipestates.com/uploads/... URL
type Marked = { headline: string; markedWords: string }; // headline may contain "\n"
type ProjectData = {
  name: [string, string]; location: string; heroImage: Img;
  slide2: Marked & { eyebrow: string; body: string; tiles: [Tile, Tile, Tile] };      // Tile = { image: Img; caption: string }
  slide3: Marked & { eyebrow: string; layouts: [Layout, Layout, Layout] };          // Layout = { layout: string; size: string }
  slide4: Marked & { eyebrow: string; image: Img; facilities: [Fac, Fac, Fac] };     // Fac = { facilityImage: Img; caption: string }
  slide5: { image: Img; priceFrom: number; vatNote: "plus" | "included" | null; rows: { label: string; value: string }[] /* 0..3 */ };
};
type CyprusData = {
  cover: { image: Img; chip: string; title: string; accentWord: string; subtitle: string };
  slides: [CySlide, CySlide, CySlide, CySlide]; // CySlide = Marked & { image; eyebrow; checks: [string,string,string]; source?: string }
};
type RenderInput = { template: "project"; lang: Lang; slug: string; postingDate?: string; data: ProjectData }
                 | { template: "cyprus";  lang: Lang; slug: string; postingDate?: string; data: CyprusData };
formatPrice(850000, "de") === "850.000 €"; formatPrice(850000, "en") === "€850,000";
vatText("plus","en")==="+ VAT"; vatText("plus","de")==="zzgl. MwSt."; vatText("included", …) per D4; vatText(null, …)===null;
isoWeekFolder("2026-11-09") === "2026-w46"; isoWeekFolder(undefined, new Date("2026-11-08T22:30:00Z")) === "2026-w46"; // 00:30 Monday in Nicosia
```
- [ ] Failing tests first:
  - `.strict()` objects (unknown keys rejected).
  - `markedWords` must occur in `headline` exactly once; 0× or 2× is an error naming the slide.
  - `accentWord` must occur in `title`.
  - `priceFrom` is a positive integer.
  - `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - `postingDate` matches `YYYY-MM-DD`.
  - Year boundary: `2027-01-01` → `2026-w53`.
- [ ] Implement, run `npm test`, commit.

### Task 3: Image policy

**Files:** `imagePolicy.ts`, test.

- [ ] Tests:
  - Accepted: `https://cyprusvipestates.com/uploads/developments/x/a_large.webp` → a file under the root.
  - Rejected: `https://evil.com/a.jpg`, `http://…` (non-https), `https://www.cyprusvipestates.com…` (only if not on the allow-list; to be confirmed via `absoluteUrls()`), `/uploads/../.env`, `%2e%2e` variants, `?x=1`, `/uploads/social/…`, a symlink out of the root, missing file, a text file named `.jpg` (sharp metadata check).
- [ ] Implementation: `new URL()`, host check, `decodeURIComponent`, `path.resolve`, `fs.realpath` prefix check, `sharp(file).metadata()`.
- [ ] Uploads root comes from the same resolution as `imageMirror.ts` (`process.cwd()/public/uploads`, the symlink to `/var/www/shared-uploads` in prod; a real directory in the testbed), overridable by `SOCIAL_UPLOADS_ROOT` for the testbed.
- [ ] Commit.

### Task 4: HTML templates

**Files:** `staticCopy.ts`, `templates.ts`, test.

- [ ] Markup per slide transcribed from the originals; the structure is identical.
  - Values are inserted escaped.
  - `markedWords` → `<span class="mark-word">` (project) / `<span class="mark">` (cyprus).
  - `\n` → `<br>`.
  - `name[1]` → `<em class="gold">`.
  - `accentWord` → `<span style="color:#E8CF98">`.
- [ ] `data-role` markers for measurement: `content`, `eyebrow`, `heading`, `price`, `swipe`, `text` (every text element), `portrait`.
- [ ] The photo-height script from the originals (`ph.style.height = …`) is applied unchanged.
- [ ] The cyprus slide 6 comes from `slide6-final`, not the older slide 6 in `cyprus-light-de.html`.
- [ ] Tests:
  - `<script>` in an input appears as text.
  - Every static string from the originals is present in the output.
  - Building the template with the reference texts and sample images yields the same DOM text as the original file. Normalised text comparison per slide.
- [ ] Commit.

### Task 5: Worker + layout rules

**Files:** `scripts/social/carousel-worker.mjs`, `scripts/social/carouselFit.js`.

**Process per slide:**
1. Load the page: `viewport 1080×1350`, `deviceScaleFactor 1`. `page.route("**/*")` → `abort()` for everything except `file://`. Wait for `document.fonts.ready`. Check `document.fonts.check()` for Fraunces 400/600 and Mulish 400/700, otherwise error `fonts_missing`.
2. **Rule 1 (bottom line):** the content block is anchored with `bottom` so that the content box bottom = Swipe box top − 42 (per D1; in the template this is `bottom:146px`). The value is measured, not assumed: `swipe.getBoundingClientRect().top − content.getBoundingClientRect().bottom === 42`. The photo height follows from the original script.
3. **Rule 2 (eyebrow → heading 44 px ink):**
   - Measurement screenshot of only `eyebrow` + `heading`/`price` on a flat background (all other elements `visibility:hidden`, photo off).
   - Row scan in node: first/last row with ≥2 pixels deviating by more than 38/255 from the background.
   - Correct the eyebrow position by `44 − measured`, measure again, require exactly 44.
4. **Rule 3/4 (price, marking):** `white-space:nowrap`; the element's right edge ≤ the content area's right edge (984), otherwise a violation. VAT text sits as an inline span on the digit baseline (`align-items:baseline`, as in the original). With `vatNote=null` the span is absent.
5. **Rule 5 (portrait/frame):**
   - Ink mask of all `text` elements (measurement screenshot) ∩ alpha mask of the portrait (`sascha.png` at its rendered position) = 0.
   - The bounding box of all text ink lies inside the frame (inset 36 px) and inside the 96 px content area.
6. **D6:** first text ink ≥ y=520.
7. **Rule 6 (fit):** if 3–6 fail, set `heading` (h1/h2/price) smaller in 2 px steps and repeat 2–6. If the size goes below `round(0.72 × template size)`, return a report `{ ok:false, slide, rule, detail }`.
8. When all rules pass: a final PNG screenshot of the slide.

- [ ] Output JSON on stdout: `{ ok, slides:[{ png:base64, headingPx, templatePx, gaps:{ eyebrowHeading, contentSwipe }, checks:{…} }] }` or `{ ok:false, slide, rule, detail }`.
- [ ] Chromium is started with `--user-data-dir=/tmp/cve-carousel-<renderId>`, which marks it for the orphan sweep. `try { … } finally { await browser.close() }`. `process.on("SIGTERM")` closes too.
- [ ] Test-only hook `CAROUSEL_TEST_HANG=1`, honoured only when `NODE_ENV !== "production"`, to test the timeout path.
- [ ] Commit.

### Task 6: Orchestration, lock, storage

**Files:** `render.ts`, test.

- [ ] Lock: `fs.open("/tmp/cve-carousel.lock","wx")` with `{pid, startedAt}`. Wait for the lock up to 75 s, then error `renderer_busy`. A stale lock (pid dead or older than 120 s) is cleared. This works across both pm2 cluster instances.
- [ ] Spawn: `spawn(process.execPath, [worker], { detached:true, stdio:["pipe","pipe","pipe"] })`. On timeout, after 60 s: `process.kill(-child.pid,"SIGKILL")` and error `render_timeout`. In `finally`: kill the process group, `pkill -f cve-carousel-<renderId>`, `rm -rf /tmp/cve-carousel-<renderId>`, release the lock.
- [ ] Only when `ok:true` for all 6 slides:
  - sharp PNG → JPG (q 90, mozjpeg, chroma 4:4:4).
  - Preview sheet 3×2 at 540×675 → `preview.jpg`.
  - Write to `<dir>.tmp-<renderId>`, then rename the old dir to `.old-<renderId>`, rename tmp → final, remove `.old`.
  - On error, the old state stays untouched.
- [ ] Return: `{ slides:[6 absolute URLs ?v=renderId], preview, folder, report:[per slide headingPx/templatePx/reduced] }`.
- [ ] Tests (without Chromium, with a fake worker):
  - A timeout kills the process group.
  - An error writes no directory and leaves an existing one untouched.
  - The lock is released after an error.
- [ ] Commit.

### Task 7: MCP tool

**Files:** `renderInstagramCarousel.ts`, `toolNames.ts`, registry, `toolRegistry.test.ts`.

- [ ] Input: `RenderInput` (Task 2).
  - For `project`: the development with `slug` must be `published`, otherwise `not_found`.
  - Images: `imagePolicy`. Additionally, the project's gallery URLs are allowed (identical to `/uploads`).
- [ ] The tool description says: 6 JPGs + preview, rules, what is static, that `crm_get_project` provides the gallery/amenities/vatNote, and that the folder week comes from `postingDate`.
- [ ] Run through `runTool(...)` (audit like the other write tools); add it to `WRITE_TOOL_NAMES`.
- [ ] Extend `toolRegistry.test.ts`.
- [ ] Commit.

### Task 8: Extend crm_get_project + vatNote

**Files:** `developmentGallery.ts`, `ProjectPageBody.tsx`/loader, `getProject.ts`, Prisma schema + migration, admin page + action, tests.

- [ ] `pageGallery(d)`:
  - Extract the existing logic of the project page (`finalGallery`: override before feed, order, dedupe).
  - The page uses it, so there is no second source.
  - Output: ≤40 absolute URLs at the largest mirrored tier, like `heroImageUrl()`.
- [ ] `pageAmenities(d)`: the same logic as `ProjectPageBody.tsx:139` (amenities, else features of the units, without distance claims).
- [ ] `getProject`: `gallery`, `amenities`, `vatNote` only when `publishStatus === "published"`, otherwise `null`. Remove the old comment "never the gallery itself" and adjust the tool description.
- [ ] Migration: `ALTER TABLE "Development" ADD COLUMN "vatNote" TEXT; ADD CONSTRAINT … CHECK ("vatNote" IN ('plus','included'))`. Check with `prisma migrate diff` that nothing else changes.
- [ ] Admin: a select in the development detail page plus a server action with its own admin guard; copy in English.
- [ ] Tests:
  - Gallery order = page order (fixture).
  - At most 40 entries.
  - Unpublished → `null`.
  - The action rejects invalid values.
- [ ] Commit.

### Task 9: DEPLOYMENT.md + server preparation (Chromium)

- [ ] Document the following as a new section, then carry it out on the VPS (approved by the operator on 2026-11-05):
  - `playwright-core` pinned in `dependencies`.
  - Browser path `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (outside `/var/www`, survives releases), set in the pm2 ecosystem env.
  - `npx playwright-core install --with-deps chromium-headless-shell` as root.
  - Before installing, `--dry-run` lists every apt package. The list and the versions go verbatim into DEPLOYMENT.md, together with how to remove them.
  - Lock `/tmp/cve-carousel.lock`, temp `/tmp/cve-carousel-<id>`, 60 s timeout, process-group kill, orphan sweep.
  - How to check that no Chromium is left running: `pgrep -fa cve-carousel`.
- [ ] Without the browser, the tool returns a clear error `renderer_not_installed` and never crashes.
- [ ] Commit.

### Task 10: Testbed verification (`/opt/cvp-testbed`)

**File:** `scripts/qa/carousel-testbed.mts`. It imports `assert-not-prod-db` first and aborts against the prod DB.

1. `/opt/cvp-testbed/refresh.sh claude/instagram-carousel`, then `db-testbed-up.sh`. `SOCIAL_UPLOADS_ROOT=/opt/cvp-testbed/repo/public/uploads` is a real directory with no symlink to `/var/www`. The required source images are copied in read-only:
   - the Soho East Tower hashes from `/var/www/shared-uploads` (`cp`, no link);
   - the cyprus sample images to `uploads/social-sources/`.
2. **Stage A, pipeline check:**
   - Render the original approved HTML files unchanged (with sample images) in the testbed's Chromium.
   - Compare pixel-wise with `reference-renders/*.jpg`.
   - Expected: only JPEG noise. Otherwise, report the Chromium/font differences before continuing.
3. **Stage B, from data:**
   - `crm_get_project` (handler directly) for `soho-resort-east-tower` → check `gallery`/`amenities`/`vatNote`.
   - Gallery order against the live public page (`curl`, image order in the HTML).
   - Render Soho East Tower EN and DE, and Why Cyprus DE, from JSON. The texts are those of the reference renders; the images are the real `/uploads` URLs of the same hashes.
4. **Comparison against the references:**
   - Element geometry of each render (`data-role` boxes) vs. the DOM of Stage A. Tolerance 3 px in position and size (D7); anything larger fails.
   - Pixel diff vs. the reference JPG in 24×24 blocks. Regions with a noticeable difference (mean |Δ| > 12/255) are listed with coordinates, plus a heatmap image per slide.
   - Expected differences are only the 1–2 px eyebrow shift (D2) and source-image tier.
5. **Failure path:**
   - A headline too long → error `slide 3, rule 6 (heading at minimum 72 %)` or the specific rule; no directory written; an existing directory unchanged.
   - `pgrep -fa cve-carousel` is empty; the lock is released.
   - Timeout path via `CAROUSEL_TEST_HANG=1` → `render_timeout` after ≤61 s, no orphans.
   - Image rejection: external URL, traversal, `/uploads/social/`.
6. Results: a report Artifact for the operator with references, renders and heatmaps side by side, plus the measured values per slide.

### Task 11: Review, PR, deploy (only after approval)

- [ ] `npm test`, `npx tsc --noEmit`, `next lint` (worktree `__tests__` lint).
- [ ] code-reviewer agent on the diff.
- [ ] Remove the `node_modules` symlink before committing.
- [ ] Open a PR.
- [ ] After the operator's OK: merge.
  - Install Chromium on the VPS (Task 9) **before** the deploy.
  - The operator runs the deploy with `CVP_RUN_MIGRATE=1 CVP_PROD_REF=origin/main ./scripts/deploy-prod.sh --yes` (quiet windows apply).
- [ ] Verification on prod:
  - Symlink/BUILD_ID, migration applied.
  - A real render of a published project to a test week folder (e.g. `postingDate` far in the future), URLs reachable, `pgrep` empty.
  - Delete the test folder only with the operator's OK.
- [ ] Tell the operator: **reconnect the CVE MCP connector** so the new tool and the new `crm_get_project` fields appear.
