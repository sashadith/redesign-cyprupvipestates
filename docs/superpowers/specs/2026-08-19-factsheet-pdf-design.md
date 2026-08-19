# Project Factsheet PDF — Design

**Date:** 2026-08-19
**Status:** approved design, pre-implementation
**Example/reference project:** GALAXY RESIDENCES by Aristo (`dev: aristo`)

## Purpose

A branded, multi-page A4 PDF factsheet per **Development** (project level), generated
on demand from live DB data. Replaces nothing — the legacy Sanity project PDF at
`src/app/api/projects/[lang]/[slug]/pdf/route.tsx` stays as-is for legacy content;
this is a new system for feed-based Developments in the current brand language.

Three delivery surfaces share **one renderer**:

1. **Public** — download button on the project page (`/projects/[slug]`), where the
   per-unit "Factsheet PDF (soon)" placeholder currently sits
   (`src/app/preview-project/UnitsView.tsx`). This project-level factsheet replaces
   that placeholder button for now (the button moves out of the unit card into the
   page-level actions; a per-unit variant may follow later as a separate project).
2. **Admin/CRM** — generated from the admin (Lead Cockpit / Property Matching
   context) with an advisor's contact card instead of office contact, for sending
   to leads via email/WhatsApp.
3. **Personal Selection** — download link per property on `/c/[token]`; advisor and
   locale come from the `ClientPresentation`, alias names are respected.

## Non-goals

- No per-unit factsheet in this iteration (layout should not preclude it later).
- No caching/pre-generation — on-demand render only (~200ms), with a "as of DATE"
  stamp for transparency.
- No external PDF services, no headless browser.

## Rendering approach

`@react-pdf/renderer` (already a dependency, pattern proven by the legacy route),
rendered server-side in the Node runtime (`runtime = "nodejs"`).

### Fonts

Brand fonts as **static TTF instances** (react-pdf does not handle variable fonts
reliably) committed to `public/fonts/pdf/`:

- **Fraunces** (display; regular + semibold) — Latin only
- **Mulish** (body; regular + semibold + italic) — includes Cyrillic
- **Playfair Display** (display for RU; regular + semibold) — Cyrillic

All three are OFL-licensed. RU pages use Playfair for display type and Mulish for
body — the same pairing the web frontend uses (`--font-display-cyr`). Font files are
read from the local filesystem via `Font.register` (no network fetch at render
time), same as the legacy route's DejaVuSans setup.

### Visual language

Ported from the redesign token set (`src/app/design-tokens.css`), dark theme:

- Background `#081512` (sea-deep), body text `#EFE9DB` (ivory)
- Accent `#C29A5E` (champagne) for price, eyebrows, dividers, QR frame
- Soft text `rgba(239,233,219,0.72)`, faint `rgba(239,233,219,0.45)`
- Hairlines `rgba(239,233,219,0.16)`, gold hairline `rgba(194,154,94,0.45)`
- Eyebrow style: Mulish semibold, uppercase, wide letterspacing, caption size
- Generous whitespace; no boxed/carded clutter — hairline-separated sections

## Page structure (A4, typically 4–5 pages)

**Page 1 — Cover.** Full-bleed hero image (resolved gallery[0], i.e.
`override.mainImage` first) with a sea-deep gradient scrim bottom-up; logo top-left;
eyebrow ("PROJECT FACTSHEET" localized + location line District · Area); project
name large in display font; developer label; "Price from €X"; status/completion
chips; gold hairline signature element.

**Page 2 — Overview.** Localized description (override text for the locale,
fallback EN override, fallback feed text — exactly `mapRowToVM`'s resolution);
key-facts grid (type/category, stage, completion, energy class, VAT note from
`vatApplies`, available units count from `computeAvailability`); distances row with
minutes (beach, restaurants, shops, airport, hospital, school, city center, golf —
only keys present in `distances`).

**Page 3 — Gallery + amenities.** 3–5 curated images (resolved gallery, skipping
the cover image) in a calm grid; amenities as a check-mark list in 2–3 columns.

**Page 4 — Location + floor plans.** Static location map with a champagne pin
(see "Static map" below) when coordinates exist; 1–2 floor-plan images from
project-level `plans` when present. Either half is omitted cleanly if data is
missing; if both are missing the page is skipped entirely.

**Page 5 — Units + closing.** Table of **available units only**, with real prices
(same disclosure policy as the public project page): ref/label, type, beds, area
built, floor, price. Capped at 15 rows; if more, a "+N more units — on request"
line. Sold/reserved units are excluded entirely. Below: contact block (office or
advisor variant), QR code linking to the public project page, footer with
"as of DATE" stamp and a prices-subject-to-change disclaimer (localized).

### Contact block variants

- **Office (default):** Cyprus VIP Estates, +357 25 257 575,
  office@cyprusvipestates.com, cyprusvipestates.com.
- **Advisor:** advisor name, photo (if available on the User record), phone/email —
  the same data the Personal Selection closing section uses. Falls back to office
  when the advisor record lacks contact data.

## Architecture

```
src/lib/factsheet/
  buildFactsheetData.ts   — (slugOrId, locale, opts) → FactsheetData
  FactsheetDocument.tsx   — react-pdf <Document>, pure function of FactsheetData
  copy.ts                 — localized labels (en/de/pl/ru)
  staticMap.ts            — OSM tile stitch + pin via sharp → PNG buffer
  fonts.ts                — Font.register calls (idempotent)
```

- `buildFactsheetData` wraps the existing resolution layer — `getDbProjectBySlug` /
  `mapRowToVM` (`src/lib/developmentRender.ts`) and `computeAvailability`
  (`src/lib/developmentAvailability.ts`). It never reads `unitsAvailable`/
  `unitsTotal` cache columns. It converts mirrored image URLs to local file paths
  under `public/` with the legacy route's path-traversal guard (extract that helper
  into the factsheet lib or a shared util rather than duplicating it).
- `FactsheetDocument` receives plain data only — no DB access, no fetches — so it
  can be unit-tested and later reused for a per-unit variant.
- QR code: `qrcode` (existing dep) → data URI.
- Number formatting locale-aware (`toLocaleString` with the page locale; prices as
  `€1.234.567` in de, `€1,234,567` in en, etc.).

### Static map (`staticMap.ts`)

Server-side stitch of OpenStreetMap raster tiles (3×2 grid around the project
coordinates at a fixed zoom ~14), composited with a champagne pin using `sharp`
(existing dep). Requirements:

- Proper `User-Agent` header per OSM tile usage policy; sequential or low-
  concurrency tile fetches.
- In-memory LRU cache of stitched maps keyed by rounded lat/lng (maps don't
  change); avoids hammering tiles on repeated downloads.
- Attribution line "© OpenStreetMap contributors" rendered under the map (legally
  required).
- Any fetch failure → return null → the factsheet omits the map half cleanly.
  The map must never fail the whole PDF.

## Routes

All three return `application/pdf` with `Content-Disposition: attachment;
filename="<slug>-factsheet-<lang>.pdf"`.

1. **Public:** `GET /api/factsheet/[lang]/[slug]`
   - 404 unless the Development exists and `publishStatus === "published"`.
   - `lang` validated against en/de/pl/ru.
   - Office contact variant.
   - Wired to the project page's factsheet button (replacing the "soon"
     placeholder; button moves to page-level actions).
2. **Admin:** `GET /api/admin/developments/[id]/factsheet?lang=de&advisorId=…`
   - Session-gated like other admin routes; works for unpublished developments too
     (admins may want a factsheet pre-publish).
   - `advisorId` optional → advisor contact variant.
3. **Presentation:** `GET /c/[token]/factsheet/[developmentId]`
   - Token must resolve to an active, unexpired `ClientPresentation` containing
     `developmentId` among its items (same validation the page itself performs).
   - Locale from `presentation.locale`; advisor from `presentation.advisor`;
     `aliasName` (item-level) overrides the project name; noindex semantics
     (`X-Robots-Tag: noindex`).
   - **Middleware:** `/c/[token]/factsheet/...` lives outside `[lang]` — verify the
     existing middleware carve-out for `/c/` covers the nested path (see the
     recurring outside-`[lang]` middleware gotcha documented for `/book/[token]`).

## Error handling

- Missing hero image → cover renders with a plain sea-deep background (no broken
  image); missing gallery → gallery section omitted; missing description → overview
  shows facts only. Every section is presence-guarded; an empty page is skipped.
- Image files referenced in DB but missing on disk → skip that image (react-pdf
  throws on unreadable sources — guard with `fs.existsSync` at data-build time).
- Render failure → 500 with a plain-text body; log the development id + error.

## i18n

All client-facing strings localized en/de/pl/ru in `factsheet/copy.ts` (same
four-locale table style as `developmentCopy.ts` — reuse its strings where labels
already exist there, e.g. unit fact labels, "Price on request", VAT suffix).
The factsheet is client-facing → fully localized per project conventions.

## Testing

- Unit tests for `buildFactsheetData` (override precedence, availability filtering,
  unit-table cap, missing-data omissions) if a test runner exists; otherwise a
  script-based check.
- A dev script `scripts/render-factsheet.mjs <slug> <lang> [out.pdf]` that renders
  a factsheet to a local file — used to verify GALAXY RESIDENCES output in all four
  locales during implementation (requires the DB tunnel on localhost:5433).
- Visual verification: render GALAXY RESIDENCES (en + de + ru for the Cyrillic
  display path), open the PDFs, check typography/pagination with realistic data,
  including a development with many units (cap behaviour) and one with sparse data
  (section omission).

## Open items for the implementation plan

- Confirm which User fields exist for the advisor card (photo/phone) — reuse the
  Personal Selection closing-section source.
- Confirm the exact placement/markup of the page-level factsheet button on the
  project page (replacing the per-unit placeholder), including its four-locale
  label already present in `developmentCopy.ts` (`factsheetPdf`).
- Download the six static TTF files and commit them (with a note on OFL licensing).
