# Project Factsheet PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A branded multi-page A4 factsheet PDF per Development, rendered on demand from live DB data, served through three routes (public project page, admin/CRM, personal-selection page).

**Architecture:** One pure react-pdf document (`FactsheetDocument`) fed by one data builder (`buildFactsheetData`) that wraps the existing `mapRowToVM` resolution layer. Images (mirrored WebP) are transcoded to JPEG buffers with sharp at build time because react-pdf cannot decode WebP. A static OSM map is stitched server-side with sharp. Three thin route handlers share the renderer.

**Tech Stack:** `@react-pdf/renderer` (existing dep), `sharp` (existing), `qrcode` (existing), Prisma, Next.js App Router route handlers (`runtime = "nodejs"`).

**Spec:** `docs/superpowers/specs/2026-08-19-factsheet-pdf-design.md`

**Verification model:** No test runner exists in this repo. Every task ends with `npx tsc --noEmit` (must stay clean) and, for routes, an HTTP check against the local dev server (`npm run dev`, port 3000) per the repo's established verify-via-node-fetch convention. Live-data renders require the DB tunnel on `localhost:5433` — the operator opens it; if it is down, route verification steps are blocked, not skippable.

**Reference project:** GALAXY RESIDENCES by Aristo. Look its slug up once the tunnel is open:

```bash
set -a; source .env.local; set +a; node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.development.findFirst({ where: { publicName: { contains: 'GALAXY', mode: 'insensitive' } }, select: { id: true, slug: true, publishStatus: true } })
  .then(d => { console.log(d); return p.\$disconnect(); });
"
```

Record the printed `slug` and `id`; the verification steps below refer to them as `<SLUG>` and `<ID>`.

---

## File structure

```
scripts/fetch-pdf-fonts.mjs                       — one-off font downloader (committed for reproducibility)
public/fonts/pdf/                                  — 7 static TTFs + OFL note
src/lib/factsheet/
  types.ts             — FactsheetData + sub-types (no imports from the rest of the lib)
  copy.ts              — localized labels en/de/pl/ru (reuses developmentCopy where labels exist)
  fonts.ts             — idempotent Font.register calls
  images.ts            — path-traversal-guarded local file resolution + sharp transcode (+ LOCAL_PREVIEW fetch fallback)
  staticMap.ts         — OSM tile stitch + champagne pin, in-memory LRU
  buildFactsheetData.ts — VM → FactsheetData (all DB/file/network access lives here)
  FactsheetDocument.tsx — pure react-pdf document, function of FactsheetData only
src/app/api/factsheet/[lang]/[slug]/route.tsx      — public route
src/app/api/admin/developments/[id]/factsheet/route.tsx — admin route
src/app/c/[token]/factsheet/[developmentId]/route.tsx   — presentation route
```

Modified: `src/app/preview-project/ProjectPageBody.tsx` (page-level button), `src/app/preview-project/UnitsView.tsx` (remove placeholder), `src/lib/developmentCopy.ts` (remove dead `soon` key), `src/app/preview-project/project.css` (anchor variant of `.pp-pdf`).

---

### Task 1: Font assets + registration

**Files:**
- Create: `scripts/fetch-pdf-fonts.mjs`
- Create: `public/fonts/pdf/OFL-NOTE.md`
- Create: `src/lib/factsheet/fonts.ts`

react-pdf needs static-instance TTFs (variable fonts are unreliable). Google's css2 API serves static TTF instances when the request carries a blank User-Agent.

- [ ] **Step 1: Write the fetch script**

```js
// scripts/fetch-pdf-fonts.mjs — one-off: downloads the static TTF instances
// the factsheet PDF renderer registers (react-pdf can't use variable fonts).
// Re-run only if a weight/family is added. Files land in public/fonts/pdf/.
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "fonts", "pdf");
fs.mkdirSync(OUT, { recursive: true });

// css2 with a blank UA returns plain @font-face blocks with static .ttf URLs.
const FAMILIES = [
  { q: "family=Fraunces:wght@400;600", name: "Fraunces" },
  { q: "family=Mulish:ital,wght@0,400;0,600;1,400", name: "Mulish" },
  { q: "family=Playfair+Display:wght@400;600", name: "PlayfairDisplay" },
];

for (const f of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${f.q}`, {
    headers: { "User-Agent": "" },
  })).text();
  // Each block: font-style, font-weight, src url(...ttf)
  const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
  const seen = new Set();
  for (const b of blocks) {
    const style = /font-style:\s*(\w+)/.exec(b)?.[1] ?? "normal";
    const weight = /font-weight:\s*(\d+)/.exec(b)?.[1] ?? "400";
    const url = /url\((https:[^)]+\.ttf)\)/.exec(b)?.[1];
    if (!url) continue;
    const file = `${f.name}-${weight}${style === "italic" ? "italic" : ""}.ttf`;
    if (seen.has(file)) continue; // css2 may repeat per subset; first block covers the full charset
    seen.add(file);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, file), buf);
    console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}
console.log("done →", OUT);
```

- [ ] **Step 2: Run it and verify the 7 files exist**

Run: `node scripts/fetch-pdf-fonts.mjs && ls -la public/fonts/pdf/`

Expected files: `Fraunces-400.ttf`, `Fraunces-600.ttf`, `Mulish-400.ttf`, `Mulish-600.ttf`, `Mulish-400italic.ttf`, `PlayfairDisplay-400.ttf`, `PlayfairDisplay-600.ttf`. Each > 50 KB.

Sanity-check Cyrillic coverage (Mulish + Playfair must contain U+0410 "А"):

```bash
node -e "
const fs=require('fs');
for (const f of ['Mulish-400.ttf','PlayfairDisplay-400.ttf']) {
  const b=fs.readFileSync('public/fonts/pdf/'+f);
  // cheap heuristic: file must be > 100KB (Latin-only subsets are ~40-60KB)
  console.log(f, b.length, b.length > 100_000 ? 'OK (likely full charset)' : 'SUSPICIOUS — verify manually');
}"
```

If a file is flagged SUSPICIOUS, download that family's full TTF from its upstream GitHub repo instead (Mulish: googlefonts/mulish, Playfair: clauseggers/Playfair) — do not proceed with a Latin-only file; the RU factsheet depends on it.

- [ ] **Step 3: Write the license note**

```markdown
<!-- public/fonts/pdf/OFL-NOTE.md -->
# Font licensing

Fraunces, Mulish and Playfair Display are licensed under the SIL Open Font
License 1.1 (OFL). Static TTF instances fetched via scripts/fetch-pdf-fonts.mjs
for server-side PDF rendering (src/lib/factsheet/). OFL permits bundling and
embedding; the fonts are not sold standalone.
```

- [ ] **Step 4: Write `src/lib/factsheet/fonts.ts`**

```ts
// Font registration for the factsheet PDF renderer. Static TTF instances only
// (react-pdf mis-renders variable fonts) — fetched by scripts/fetch-pdf-fonts.mjs.
// RU uses Playfair Display for display type (Fraunces has no Cyrillic), the
// same pairing the web frontend makes via --font-display-cyr.
import path from "path";
import { Font } from "@react-pdf/renderer";

const DIR = path.join(process.cwd(), "public", "fonts", "pdf");

let registered = false;

export function registerFactsheetFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "Fraunces",
    fonts: [
      { src: path.join(DIR, "Fraunces-400.ttf"), fontWeight: 400 },
      { src: path.join(DIR, "Fraunces-600.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Mulish",
    fonts: [
      { src: path.join(DIR, "Mulish-400.ttf"), fontWeight: 400 },
      { src: path.join(DIR, "Mulish-600.ttf"), fontWeight: 600 },
      { src: path.join(DIR, "Mulish-400italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "PlayfairDisplay",
    fonts: [
      { src: path.join(DIR, "PlayfairDisplay-400.ttf"), fontWeight: 400 },
      { src: path.join(DIR, "PlayfairDisplay-600.ttf"), fontWeight: 600 },
    ],
  });
  // Long project names and German compounds: wrap whole words, never hyphenate.
  Font.registerHyphenationCallback((word) => [word]);
}

export const displayFamily = (locale: string) =>
  locale === "ru" ? "PlayfairDisplay" : "Fraunces";
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-pdf-fonts.mjs public/fonts/pdf src/lib/factsheet/fonts.ts
git commit -m "Factsheet PDF: static brand fonts + registration"
```

---

### Task 2: Types and localized copy

**Files:**
- Create: `src/lib/factsheet/types.ts`
- Create: `src/lib/factsheet/copy.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
// Data contract between buildFactsheetData (all I/O) and FactsheetDocument
// (pure rendering). Everything is pre-formatted display strings or image
// buffers — the document component does no formatting, fetching or fallbacks.

export type FactsheetLocale = "en" | "de" | "pl" | "ru";

export type FactsheetImage = { data: Buffer; format: "jpg" | "png" };

export type FactsheetFact = { label: string; value: string };

export type FactsheetUnitRow = {
  label: string;   // unit display label (label || name || ref)
  type: string;
  beds: string;
  area: string;    // areaBuilt normalized with the locale's m² symbol
  floor: string;
  price: string;   // pre-formatted, or the localized "on request"
};

export type FactsheetContact =
  | { variant: "office" }
  | {
      variant: "advisor";
      name: string;
      phone: string | null;
      email: string | null;
      photo: FactsheetImage | null;
    };

export type FactsheetData = {
  locale: FactsheetLocale;
  name: string;              // publicName (aliasName already applied by the caller)
  developer: string;         // display developer label, may be ""
  locationLine: string;      // e.g. "Paphos · Kato Paphos"
  priceFrom: string | null;  // pre-formatted "€690,000"
  chips: string[];           // stage label, completion, energy — present ones only
  logo: FactsheetImage | null;
  hero: FactsheetImage | null;
  description: string;       // localized, may be ""
  facts: FactsheetFact[];
  distances: FactsheetFact[]; // value pre-formatted "12 min"
  gallery: FactsheetImage[]; // max 5, hero excluded
  amenities: string[];
  map: FactsheetImage | null;
  plans: FactsheetImage[];   // max 2
  units: FactsheetUnitRow[]; // available only, capped at 15
  unitsMore: number;         // available units beyond the cap
  contact: FactsheetContact;
  qrDataUri: string | null;  // PNG data URI, links to projectUrl
  projectUrl: string;        // shown as text under the QR
  generatedAt: string;       // localized "19 August 2026"
};

export const UNIT_TABLE_CAP = 15;
```

- [ ] **Step 2: Write `copy.ts`**

Client-facing → fully localized en/de/pl/ru (project convention). Unit fact labels, price-on-request and the m² symbol are reused from `developmentCopy` (already four-locale); this file adds only factsheet-specific strings.

```ts
// Factsheet-specific localized strings. Unit-level labels (beds, m², price on
// request, …) come from developmentCopy — do not duplicate them here.
import type { FactsheetLocale } from "./types";

export type FactsheetStrings = {
  eyebrow: string;          // "PROJECT FACTSHEET"
  priceFrom: string;
  overview: string;
  keyFacts: string;
  factType: string;
  factStage: string;
  factCompletion: string;
  factEnergy: string;
  factAvailable: string;    // "Available units"
  factVat: string;
  vatYes: string;
  vatNo: string;
  distances: string;
  distanceLabels: Record<string, string>; // keyed by Development.distances keys
  minutes: string;          // "min"
  gallery: string;
  amenities: string;
  location: string;
  mapAttribution: string;   // legally required, not translated
  floorPlans: string;
  unitsHeading: string;     // "Available units"
  colUnit: string;
  colType: string;
  colBeds: string;
  colArea: string;
  colFloor: string;
  colPrice: string;
  moreUnits: (n: number) => string;
  contactHeading: string;
  officeName: string;
  officeTagline: string;
  asOf: string;             // "As of"
  disclaimer: string;
  scanHint: string;         // "Scan for the full project page"
};

const EN: FactsheetStrings = {
  eyebrow: "Project Factsheet",
  priceFrom: "Price from",
  overview: "Overview",
  keyFacts: "Key facts",
  factType: "Type",
  factStage: "Construction stage",
  factCompletion: "Completion",
  factEnergy: "Energy class",
  factAvailable: "Available units",
  factVat: "VAT",
  vatYes: "VAT applies",
  vatNo: "No VAT",
  distances: "Distances",
  distanceLabels: {
    beach: "Beach", restaurants: "Restaurants", shops: "Shops",
    airport: "Airport", hospital: "Hospital", school: "School",
    cityCenter: "City center", golf: "Golf course",
  },
  minutes: "min",
  gallery: "Impressions",
  amenities: "Amenities",
  location: "Location",
  mapAttribution: "© OpenStreetMap contributors",
  floorPlans: "Floor plans",
  unitsHeading: "Available units",
  colUnit: "Unit",
  colType: "Type",
  colBeds: "Beds",
  colArea: "Area",
  colFloor: "Floor",
  colPrice: "Price",
  moreUnits: (n) => `+ ${n} more available units — details on request`,
  contactHeading: "Your contact",
  officeName: "Cyprus VIP Estates",
  officeTagline: "Local expertise for Cyprus property decisions",
  asOf: "As of",
  disclaimer:
    "Prices and availability are subject to change without notice. This factsheet is for information only and does not constitute an offer.",
  scanHint: "Scan for the full project page",
};

const DE: FactsheetStrings = {
  eyebrow: "Projekt-Factsheet",
  priceFrom: "Preis ab",
  overview: "Überblick",
  keyFacts: "Eckdaten",
  factType: "Typ",
  factStage: "Baustatus",
  factCompletion: "Fertigstellung",
  factEnergy: "Energieklasse",
  factAvailable: "Verfügbare Einheiten",
  factVat: "MwSt.",
  vatYes: "zzgl. MwSt.",
  vatNo: "keine MwSt.",
  distances: "Entfernungen",
  distanceLabels: {
    beach: "Strand", restaurants: "Restaurants", shops: "Supermarkt",
    airport: "Flughafen", hospital: "Klinik", school: "Schule",
    cityCenter: "Zentrum", golf: "Golfplatz",
  },
  minutes: "Min.",
  gallery: "Impressionen",
  amenities: "Ausstattung",
  location: "Lage",
  mapAttribution: "© OpenStreetMap contributors",
  floorPlans: "Grundrisse",
  unitsHeading: "Verfügbare Einheiten",
  colUnit: "Einheit",
  colType: "Typ",
  colBeds: "SZ",
  colArea: "Fläche",
  colFloor: "Etage",
  colPrice: "Preis",
  moreUnits: (n) => `+ ${n} weitere verfügbare Einheiten — Details auf Anfrage`,
  contactHeading: "Ihr Ansprechpartner",
  officeName: "Cyprus VIP Estates",
  officeTagline: "Lokale Expertise für Immobilienentscheidungen auf Zypern",
  asOf: "Stand",
  disclaimer:
    "Preise und Verfügbarkeit können sich jederzeit ändern. Dieses Factsheet dient nur der Information und stellt kein Angebot dar.",
  scanHint: "Scannen für die vollständige Projektseite",
};

const PL: FactsheetStrings = {
  eyebrow: "Karta projektu",
  priceFrom: "Cena od",
  overview: "Przegląd",
  keyFacts: "Kluczowe dane",
  factType: "Typ",
  factStage: "Etap budowy",
  factCompletion: "Ukończenie",
  factEnergy: "Klasa energetyczna",
  factAvailable: "Dostępne lokale",
  factVat: "VAT",
  vatYes: "plus VAT",
  vatNo: "bez VAT",
  distances: "Odległości",
  distanceLabels: {
    beach: "Plaża", restaurants: "Restauracje", shops: "Sklepy",
    airport: "Lotnisko", hospital: "Szpital", school: "Szkoła",
    cityCenter: "Centrum miasta", golf: "Pole golfowe",
  },
  minutes: "min",
  gallery: "Galeria",
  amenities: "Udogodnienia",
  location: "Lokalizacja",
  mapAttribution: "© OpenStreetMap contributors",
  floorPlans: "Rzuty",
  unitsHeading: "Dostępne lokale",
  colUnit: "Lokal",
  colType: "Typ",
  colBeds: "Syp.",
  colArea: "Powierzchnia",
  colFloor: "Piętro",
  colPrice: "Cena",
  moreUnits: (n) => `+ ${n} kolejnych dostępnych lokali — szczegóły na życzenie`,
  contactHeading: "Twój kontakt",
  officeName: "Cyprus VIP Estates",
  officeTagline: "Lokalna wiedza wspierająca decyzje dotyczące nieruchomości na Cyprze",
  asOf: "Stan na",
  disclaimer:
    "Ceny i dostępność mogą ulec zmianie bez uprzedzenia. Karta ma charakter wyłącznie informacyjny i nie stanowi oferty.",
  scanHint: "Zeskanuj, aby zobaczyć pełną stronę projektu",
};

const RU: FactsheetStrings = {
  eyebrow: "Факт-лист проекта",
  priceFrom: "Цена от",
  overview: "Обзор",
  keyFacts: "Ключевые факты",
  factType: "Тип",
  factStage: "Стадия строительства",
  factCompletion: "Завершение",
  factEnergy: "Класс энергоэффективности",
  factAvailable: "Доступные юниты",
  factVat: "НДС",
  vatYes: "плюс НДС",
  vatNo: "без НДС",
  distances: "Расстояния",
  distanceLabels: {
    beach: "Пляж", restaurants: "Рестораны", shops: "Магазины",
    airport: "Аэропорт", hospital: "Клиника", school: "Школа",
    cityCenter: "Центр города", golf: "Гольф-поле",
  },
  minutes: "мин",
  gallery: "Галерея",
  amenities: "Инфраструктура",
  location: "Расположение",
  mapAttribution: "© OpenStreetMap contributors",
  floorPlans: "Планировки",
  unitsHeading: "Доступные юниты",
  colUnit: "Юнит",
  colType: "Тип",
  colBeds: "Сп.",
  colArea: "Площадь",
  colFloor: "Этаж",
  colPrice: "Цена",
  moreUnits: (n) => `+ ещё ${n} доступных юнитов — детали по запросу`,
  contactHeading: "Ваш контакт",
  officeName: "Cyprus VIP Estates",
  officeTagline: "Локальная экспертиза для решений по недвижимости на Кипре",
  asOf: "По состоянию на",
  disclaimer:
    "Цены и наличие могут быть изменены без предварительного уведомления. Факт-лист носит информационный характер и не является офертой.",
  scanHint: "Сканируйте, чтобы открыть полную страницу проекта",
};

const ALL: Record<FactsheetLocale, FactsheetStrings> = { en: EN, de: DE, pl: PL, ru: RU };

export const factsheetCopy = (locale: FactsheetLocale): FactsheetStrings => ALL[locale];

export const OFFICE_CONTACT = {
  phone: "+357 25 257 575",
  email: "office@cyprusvipestates.com",
  website: "cyprusvipestates.com",
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/factsheet/types.ts src/lib/factsheet/copy.ts
git commit -m "Factsheet PDF: data contract and four-locale copy"
```

---

### Task 3: Image loading helper

**Files:**
- Create: `src/lib/factsheet/images.ts`

Two jobs: (a) the legacy route's path-traversal guard, extracted; (b) WebP→JPEG/PNG transcode via sharp, because react-pdf cannot decode WebP (all mirrored development images are `.webp`). Plus a `LOCAL_PREVIEW` fetch fallback: on a local checkout `public/uploads/` does not exist (uploads live on the VPS; next.config proxies them in dev), so the loader falls back to fetching from the live site when the local file is absent.

- [ ] **Step 1: Write `images.ts`**

```ts
// Image loading for the factsheet renderer. react-pdf cannot decode WebP —
// every mirrored development image is WebP — so everything is transcoded to
// JPEG (or PNG when transparency matters: logo, advisor cutout) via sharp and
// handed to react-pdf as a raw buffer.
import path from "path";
import fs from "fs";
import sharp from "sharp";
import type { FactsheetImage } from "./types";

const PUBLIC_DIR = fs.realpathSync(path.join(process.cwd(), "public"));

// Same guard as the legacy PDF route: resolve and confirm the path stays
// within public/ (defends against `../` traversal).
export function toLocalFile(u?: string | null): string | null {
  if (!u) return null;
  const rel = u.replace(/^https?:\/\/[^/]+/, "");
  const resolved = path.resolve(PUBLIC_DIR, "." + (rel.startsWith("/") ? rel : "/" + rel));
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

// Local preview: public/uploads lives on the VPS, not in the checkout —
// next.config proxies /uploads in the browser, but this renderer reads the
// filesystem, so fall back to fetching the live file. Never active in prod.
const REMOTE_FALLBACK_ORIGIN =
  process.env.LOCAL_PREVIEW === "1" ? "https://cyprusvipestates.com" : null;

async function loadSource(url: string): Promise<Buffer | null> {
  const local = toLocalFile(url);
  if (local) return fs.promises.readFile(local);
  if (REMOTE_FALLBACK_ORIGIN && url.startsWith("/uploads/")) {
    try {
      const res = await fetch(`${REMOTE_FALLBACK_ORIGIN}${url}`);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

// url → resized JPEG buffer, or null on any failure (missing file, corrupt
// image). Callers treat null as "omit this image" — an image must never fail
// the whole PDF.
export async function loadJpeg(
  url: string | null | undefined,
  maxWidth: number,
): Promise<FactsheetImage | null> {
  if (!url) return null;
  const src = await loadSource(url);
  if (!src) return null;
  try {
    const data = await sharp(src)
      .rotate() // honor EXIF orientation
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return { data, format: "jpg" };
  } catch {
    return null;
  }
}

// PNG variant — keeps transparency (brand logo, advisor photo cutout).
export async function loadPng(
  url: string | null | undefined,
  maxWidth: number,
): Promise<FactsheetImage | null> {
  if (!url) return null;
  const src = await loadSource(url);
  if (!src) return null;
  try {
    const data = await sharp(src)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .png()
      .toBuffer();
    return { data, format: "png" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/factsheet/images.ts
git commit -m "Factsheet PDF: guarded image loader with WebP transcode and local-preview fallback"
```

---

### Task 4: Static OSM map

**Files:**
- Create: `src/lib/factsheet/staticMap.ts`

Stitches raster tiles from tile.openstreetmap.org around the project coordinates (zoom 14, 768×512 canvas), composites a champagne pin, returns a JPEG buffer. LRU-cached in memory (maps for the same coordinates never change within a process lifetime). Any failure returns null — the factsheet then omits the map cleanly. OSM policy: identifying User-Agent, low concurrency (tiles are fetched sequentially), attribution is rendered as text next to the map by the document (string in `copy.ts`).

- [ ] **Step 1: Write `staticMap.ts`**

```ts
// Server-side static map: OSM raster tiles stitched with sharp + champagne
// pin. No API key, no external map service. Returns null on ANY failure —
// the factsheet must render without a map rather than fail.
//
// OSM tile usage policy: identifying UA, no bulk scraping — one 768×512 map
// is ≤ 12 tiles, fetched sequentially, and cached per coordinate.
import sharp from "sharp";

const ZOOM = 14;
const W = 768;
const H = 512;
const TILE = 256;
const UA = "CyprusVIPEstates-Factsheet/1.0 (office@cyprusvipestates.com)";

const cache = new Map<string, Buffer>(); // insertion-ordered → simple LRU
const CACHE_MAX = 30;

const PIN_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
  <path d="M24 2C13 2 4 11 4 22c0 15 20 40 20 40s20-25 20-40C44 11 35 2 24 2z"
        fill="#C29A5E" stroke="#081512" stroke-width="2.5"/>
  <circle cx="24" cy="22" r="7.5" fill="#081512"/>
</svg>`);

export async function renderStaticMap(lat: number, lng: number): Promise<Buffer | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) {
    // refresh recency
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  try {
    // slippy-map fractional tile coordinates
    const n = 2 ** ZOOM;
    const xt = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yt = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    // global pixel of the center; canvas top-left in global pixels
    const cx = xt * TILE;
    const cy = yt * TILE;
    const left = Math.round(cx - W / 2);
    const top = Math.round(cy - H / 2);

    const composites: sharp.OverlayOptions[] = [];
    for (let tx = Math.floor(left / TILE); tx * TILE < left + W; tx++) {
      for (let ty = Math.floor(top / TILE); ty * TILE < top + H; ty++) {
        const res = await fetch(
          `https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`,
          { headers: { "User-Agent": UA } },
        );
        if (!res.ok) return null;
        composites.push({
          input: Buffer.from(await res.arrayBuffer()),
          left: tx * TILE - left,
          top: ty * TILE - top,
        });
      }
    }
    // pin tip points at the center
    composites.push({ input: PIN_SVG, left: Math.round(W / 2 - 24), top: Math.round(H / 2 - 62) });

    const out = await sharp({
      create: { width: W, height: H, channels: 3, background: { r: 8, g: 21, b: 18 } },
    })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toBuffer();

    cache.set(key, out);
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return out;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Smoke-test it standalone** (network required)

```bash
node -e "
require('ts-node');" 2>/dev/null; npx tsx -e "
import { renderStaticMap } from './src/lib/factsheet/staticMap';
renderStaticMap(34.7754, 32.4245).then(b => console.log('map bytes:', b?.length ?? 'FAILED'));
" 2>/dev/null || echo "tsx not installed — verified instead via the route render in Task 7"
```

`tsx` is not a project dependency; if the one-off `npx tsx` fetch is unwanted, skip — Task 7's live render covers this code path. Expected when run: `map bytes: <n>` with n > 50000.

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` — clean.

```bash
git add src/lib/factsheet/staticMap.ts
git commit -m "Factsheet PDF: static OSM map renderer with pin and LRU cache"
```

---

### Task 5: Data builder

**Files:**
- Create: `src/lib/factsheet/buildFactsheetData.ts`

All I/O for the factsheet: takes a resolved `DbProjectVM` (from `getDbProjectBySlug` or `mapRowToVM`), loads/transcodes images, renders map + QR, formats every display string. The document component stays pure.

- [ ] **Step 1: Write `buildFactsheetData.ts`**

```ts
// VM → FactsheetData. Everything I/O-ish or locale-dependent happens here so
// FactsheetDocument stays a pure function of its data.
import QRCode from "qrcode";
import type { DbProjectVM } from "@/lib/developmentRender";
import { resolveStageLabel } from "@/lib/developmentAvailability";
import { developmentCopy } from "@/lib/developmentCopy";
import { factsheetCopy } from "./copy";
import { loadJpeg, loadPng } from "./images";
import { renderStaticMap } from "./staticMap";
import {
  UNIT_TABLE_CAP,
  type FactsheetData,
  type FactsheetImage,
  type FactsheetLocale,
  type FactsheetUnitRow,
} from "./types";

// Same asset the Personal Selection hero uses — the light-on-dark brand logo.
const LOGO_URL = "/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png";

const NUM_LOCALE: Record<FactsheetLocale, string> = {
  en: "en-US", de: "de-DE", pl: "pl-PL", ru: "ru-RU",
};

const SITE_ORIGIN = "https://cyprusvipestates.com";

export type FactsheetAdvisor = {
  name: string;
  phone: string | null;
  email: string | null;
  photoPng: string | null; // User.photoPng (transparent cutout) or User.avatar
};

export type BuildFactsheetOptions = {
  advisor?: FactsheetAdvisor | null;
  aliasName?: string | null; // per-presentation display-name override
};

const formatPrice = (n: number, locale: FactsheetLocale) =>
  `€${n.toLocaleString(NUM_LOCALE[locale])}`;

// Normalize an area string to carry exactly one, locale-correct m² symbol
// (feed data ships "125 m²", "125 m2" or bare "125" depending on adapter).
const withM2 = (v: string, m2: string) => {
  const t = (v || "").trim();
  if (!t) return "";
  return /(m²|m2|м²)\s*$/i.test(t) ? t.replace(/\s*(m²|m2|м²)\s*$/i, ` ${m2}`) : `${t} ${m2}`;
};

export async function buildFactsheetData(
  vm: DbProjectVM,
  locale: FactsheetLocale,
  opts: BuildFactsheetOptions = {},
): Promise<FactsheetData> {
  const t = factsheetCopy(locale);
  const dc = developmentCopy(locale);

  const heroUrl = vm.gallery[0] ?? null;
  const galleryUrls = vm.gallery.slice(1, 6); // hero excluded, max 5

  const availableUnits = vm.units.filter((u) => u.status === "available");

  const stage = resolveStageLabel(vm.stage, vm.status, locale);
  const chips = [stage, vm.completion, vm.energy].filter((c): c is string => !!c);

  const facts = [
    vm.category ? { label: t.factType, value: vm.category } : null,
    stage ? { label: t.factStage, value: stage } : null,
    vm.completion ? { label: t.factCompletion, value: vm.completion } : null,
    vm.energy ? { label: t.factEnergy, value: vm.energy } : null,
    availableUnits.length > 0
      ? { label: t.factAvailable, value: `${availableUnits.length} / ${vm.units.length}` }
      : null,
    vm.vatApplies != null
      ? { label: t.factVat, value: vm.vatApplies ? t.vatYes : t.vatNo }
      : null,
  ].filter((f): f is { label: string; value: string } => f !== null);

  const distances = Object.entries(vm.distances ?? {})
    .filter(([k, v]) => typeof v === "number" && t.distanceLabels[k])
    .map(([k, v]) => ({ label: t.distanceLabels[k], value: `${v} ${t.minutes}` }));

  const unitRows: FactsheetUnitRow[] = availableUnits
    .slice(0, UNIT_TABLE_CAP)
    .map((u) => ({
      label: u.label || u.name || u.ref || "—",
      type: u.type || "—",
      beds: u.beds || "—",
      area: withM2(u.areaBuilt, dc.unitM2) || "—",
      floor: u.floor || "—",
      price: u.price != null ? formatPrice(u.price, locale) : dc.priceOnRequest,
    }));

  const projectPath = `${locale === "en" ? "" : `/${locale}`}/projects/${vm.slug}`;
  const projectUrl = `${SITE_ORIGIN}${projectPath}`;

  // All independent I/O in parallel; every loader resolves null on failure.
  const [logo, hero, gallery, map, plans, advisorPhoto, qrDataUri] = await Promise.all([
    loadPng(LOGO_URL, 480),
    loadJpeg(heroUrl, 1600),
    Promise.all(galleryUrls.map((u) => loadJpeg(u, 900))),
    vm.center ? renderStaticMap(vm.center.lat, vm.center.lng) : Promise.resolve(null),
    Promise.all(vm.plans.slice(0, 2).map((u) => loadJpeg(u, 1100))),
    opts.advisor?.photoPng ? loadPng(opts.advisor.photoPng, 400) : Promise.resolve(null),
    vm.slug
      ? QRCode.toDataURL(projectUrl, {
          margin: 1,
          width: 260,
          color: { dark: "#081512", light: "#EFE9DB" },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    locale,
    name: opts.aliasName || vm.publicName,
    developer: vm.developer || "",
    locationLine: [vm.district, vm.area || vm.town].filter(Boolean).join(" · "),
    priceFrom: vm.priceFrom != null ? formatPrice(vm.priceFrom, locale) : null,
    chips,
    logo,
    hero,
    description: vm.description || "",
    facts,
    distances,
    gallery: gallery.filter((g): g is FactsheetImage => g !== null),
    amenities: vm.amenities,
    map: map ? { data: map, format: "jpg" as const } : null,
    plans: plans.filter((p): p is FactsheetImage => p !== null),
    units: unitRows,
    unitsMore: Math.max(0, availableUnits.length - UNIT_TABLE_CAP),
    contact: opts.advisor
      ? {
          variant: "advisor",
          name: opts.advisor.name,
          phone: opts.advisor.phone,
          email: opts.advisor.email,
          photo: advisorPhoto,
        }
      : { variant: "office" },
    qrDataUri,
    projectUrl,
    generatedAt: new Intl.DateTimeFormat(NUM_LOCALE[locale], {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date()),
  };
}
```

Note: `developmentCopy` is a **function** (`developmentCopy(lang)`), not a record — see `src/lib/developmentAvailability.ts` for the call pattern. Verify `DbProjectVM` field names against `src/lib/developmentRender.ts:25-80` while implementing (they are used above exactly as defined there: `publicName`, `developer`, `district`, `town`, `area`, `category`, `stage`, `status`, `completion`, `energy`, `priceFrom`, `vatApplies`, `description`, `gallery`, `plans`, `amenities`, `center`, `units`, `distances`, `slug`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If `qrcode` lacks types, add the dev dependency: `npm i -D @types/qrcode`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/factsheet/buildFactsheetData.ts package.json package-lock.json
git commit -m "Factsheet PDF: data builder (VM to render-ready data)"
```

---

### Task 6: The document

**Files:**
- Create: `src/lib/factsheet/FactsheetDocument.tsx`

Pure react-pdf component. Brand: sea-deep `#081512` background, ivory `#EFE9DB` text, champagne `#C29A5E` accents, hairlines, uppercase letterspaced eyebrows. Display font `Fraunces` (RU: `PlayfairDisplay`), body `Mulish`. Pages: cover / overview / gallery+amenities / location+plans (skipped when empty) / units+closing. Sections are presence-guarded; long descriptions flow naturally onto extra pages (react-pdf `wrap`).

- [ ] **Step 1: Write `FactsheetDocument.tsx`**

```tsx
// Pure presentation — a function of FactsheetData only. No DB, no fs, no
// fetch. All strings/images arrive pre-formatted from buildFactsheetData.
import React from "react";
import {
  Document, Page, Text, View, Image, StyleSheet, Svg, Rect, Defs, LinearGradient, Stop,
} from "@react-pdf/renderer";
import { registerFactsheetFonts, displayFamily } from "./fonts";
import { factsheetCopy, OFFICE_CONTACT } from "./copy";
import type { FactsheetData, FactsheetImage } from "./types";

registerFactsheetFonts();

const C = {
  bg: "#081512",
  ivory: "#EFE9DB",
  champagne: "#C29A5E",
  soft: "rgba(239,233,219,0.72)",
  faint: "rgba(239,233,219,0.45)",
  hair: "rgba(239,233,219,0.16)",
  hairGold: "rgba(194,154,94,0.45)",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, color: C.ivory, fontFamily: "Mulish", fontSize: 10, paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48 },
  cover: { padding: 0 },

  // shared
  eyebrow: { fontSize: 8, letterSpacing: 2.2, textTransform: "uppercase", color: C.champagne, fontWeight: 600 },
  sectionTitleRow: { marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: 400, marginBottom: 8 },
  goldRule: { height: 1, backgroundColor: C.hairGold, width: 64 },
  footer: {
    position: "absolute", bottom: 24, left: 48, right: 48,
    flexDirection: "row", justifyContent: "space-between",
    borderTop: `1px solid ${C.hair}`, paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: C.faint },

  // cover
  coverHero: { position: "absolute", top: 0, left: 0, right: 0, height: "100%" },
  coverImg: { width: "100%", height: "100%", objectFit: "cover" },
  coverScrim: { position: "absolute", top: 0, left: 0, right: 0, height: "100%" },
  coverLogo: { position: "absolute", top: 40, left: 48, width: 92 },
  coverBlock: { position: "absolute", bottom: 64, left: 48, right: 48 },
  coverEyebrow: { fontSize: 8.5, letterSpacing: 2.6, textTransform: "uppercase", color: C.champagne, fontWeight: 600, marginBottom: 10 },
  coverName: { fontSize: 34, lineHeight: 1.12, marginBottom: 8 },
  coverDeveloper: { fontSize: 11, color: C.soft, marginBottom: 14 },
  coverPrice: { fontSize: 16, color: C.champagne, marginBottom: 16 },
  coverChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 8.5, color: C.champagne, paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 10, border: `1px solid ${C.hairGold}`,
  },

  // overview
  description: { fontSize: 10, lineHeight: 1.65, color: C.soft, marginBottom: 22 },
  factsGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 22 },
  factCell: { width: "33.33%", paddingRight: 14, marginBottom: 14 },
  factLabel: { fontSize: 7.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.faint, marginBottom: 3 },
  factValue: { fontSize: 11 },
  distRow: { flexDirection: "row", flexWrap: "wrap", borderTop: `1px solid ${C.hair}`, paddingTop: 14 },
  distCell: { width: "25%", marginBottom: 12 },

  // gallery + amenities
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  galleryImgWide: { width: "100%", height: 218, objectFit: "cover", borderRadius: 4 },
  galleryImgHalf: { width: "49.2%", height: 150, objectFit: "cover", borderRadius: 4 },
  amenityCols: { flexDirection: "row", flexWrap: "wrap" },
  amenity: { width: "33.33%", flexDirection: "row", marginBottom: 7, paddingRight: 10 },
  amenityTick: { color: C.champagne, fontSize: 9, marginRight: 6 },
  amenityText: { fontSize: 9.5, color: C.soft, flex: 1 },

  // location + plans
  mapImg: { width: "100%", height: 300, objectFit: "cover", borderRadius: 4, marginBottom: 4 },
  mapAttr: { fontSize: 6.5, color: C.faint, textAlign: "right", marginBottom: 20 },
  planImgBox: { backgroundColor: C.ivory, borderRadius: 4, padding: 10, marginBottom: 10 },
  planImg: { width: "100%", height: 250, objectFit: "contain" },

  // units table
  table: { marginBottom: 6 },
  th: { flexDirection: "row", borderBottom: `1px solid ${C.hairGold}`, paddingBottom: 6, marginBottom: 2 },
  thCell: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint },
  tr: { flexDirection: "row", borderBottom: `1px solid ${C.hair}`, paddingVertical: 6 },
  td: { fontSize: 9.5 },
  colUnit: { width: "24%" }, colType: { width: "16%" }, colBeds: { width: "10%" },
  colArea: { width: "16%" }, colFloor: { width: "12%" }, colPrice: { width: "22%", textAlign: "right" },
  moreUnits: { fontSize: 9, color: C.faint, fontStyle: "italic", marginTop: 8 },

  // closing
  closing: { flexDirection: "row", marginTop: 28, borderTop: `1px solid ${C.hair}`, paddingTop: 22 },
  closingLeft: { flex: 1, paddingRight: 20 },
  contactName: { fontSize: 14, marginBottom: 3 },
  contactLine: { fontSize: 9.5, color: C.soft, marginBottom: 2 },
  contactSite: { fontSize: 9.5, color: C.champagne, marginTop: 4 },
  advisorPhoto: { width: 64, height: 64, objectFit: "contain", marginBottom: 8 },
  qrBox: { alignItems: "center", width: 110 },
  qrImg: { width: 86, height: 86, borderRadius: 4 },
  qrHint: { fontSize: 7, color: C.faint, textAlign: "center", marginTop: 6 },
  disclaimer: { fontSize: 7, color: C.faint, lineHeight: 1.5, marginTop: 20 },
});

const img = (i: FactsheetImage) => ({ data: i.data, format: i.format });

function SectionTitle({ children, locale }: { children: React.ReactNode; locale: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={[s.sectionTitle, { fontFamily: displayFamily(locale) }]}>{children}</Text>
      <View style={s.goldRule} />
    </View>
  );
}

function Footer({ d }: { d: FactsheetData }) {
  const t = factsheetCopy(d.locale);
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{d.name} — {t.officeName}</Text>
      <Text style={s.footerText}>{t.asOf} {d.generatedAt}</Text>
    </View>
  );
}

export default function FactsheetDocument({ d }: { d: FactsheetData }) {
  const t = factsheetCopy(d.locale);
  const disp = displayFamily(d.locale);

  const contactPhone = d.contact.variant === "advisor" ? d.contact.phone : OFFICE_CONTACT.phone;
  const contactEmail = d.contact.variant === "advisor" ? d.contact.email : OFFICE_CONTACT.email;

  return (
    <Document title={`${d.name} — ${t.eyebrow}`} author={t.officeName}>
      {/* ---- Page 1: cover ---- */}
      <Page size="A4" style={[s.page, s.cover]}>
        <View style={s.coverHero}>
          {d.hero && <Image src={img(d.hero)} style={s.coverImg} />}
        </View>
        <Svg style={s.coverScrim} viewBox="0 0 595 842">
          <Defs>
            <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#081512" stopOpacity={d.hero ? 0.25 : 1} />
              <Stop offset="0.45" stopColor="#081512" stopOpacity={d.hero ? 0.15 : 1} />
              <Stop offset="1" stopColor="#081512" stopOpacity={d.hero ? 0.94 : 1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="595" height="842" fill="url(#scrim)" />
        </Svg>
        {d.logo && <Image src={img(d.logo)} style={s.coverLogo} />}
        <View style={s.coverBlock}>
          <Text style={s.coverEyebrow}>{t.eyebrow}{d.locationLine ? `  ·  ${d.locationLine}` : ""}</Text>
          <Text style={[s.coverName, { fontFamily: disp }]}>{d.name}</Text>
          {d.developer ? <Text style={s.coverDeveloper}>{d.developer}</Text> : null}
          {d.priceFrom ? <Text style={s.coverPrice}>{t.priceFrom} {d.priceFrom}</Text> : null}
          {d.chips.length > 0 && (
            <View style={s.coverChips}>
              {d.chips.map((c) => <Text key={c} style={s.chip}>{c}</Text>)}
            </View>
          )}
        </View>
      </Page>

      {/* ---- Page 2: overview ---- */}
      <Page size="A4" style={s.page}>
        <SectionTitle locale={d.locale}>{t.overview}</SectionTitle>
        {d.description ? <Text style={s.description}>{d.description}</Text> : null}
        {d.facts.length > 0 && (
          <>
            <Text style={[s.eyebrow, { marginBottom: 10 }]}>{t.keyFacts}</Text>
            <View style={s.factsGrid}>
              {d.facts.map((f) => (
                <View key={f.label} style={s.factCell}>
                  <Text style={s.factLabel}>{f.label}</Text>
                  <Text style={s.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {d.distances.length > 0 && (
          <>
            <Text style={[s.eyebrow, { marginBottom: 10 }]}>{t.distances}</Text>
            <View style={s.distRow}>
              {d.distances.map((f) => (
                <View key={f.label} style={s.distCell}>
                  <Text style={s.factLabel}>{f.label}</Text>
                  <Text style={s.factValue}>{f.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        <Footer d={d} />
      </Page>

      {/* ---- Page 3: gallery + amenities (skip when both empty) ---- */}
      {(d.gallery.length > 0 || d.amenities.length > 0) && (
        <Page size="A4" style={s.page}>
          {d.gallery.length > 0 && (
            <>
              <SectionTitle locale={d.locale}>{t.gallery}</SectionTitle>
              <View style={s.galleryGrid}>
                {d.gallery.map((g, i) => (
                  <Image key={i} src={img(g)} style={i === 0 ? s.galleryImgWide : s.galleryImgHalf} />
                ))}
              </View>
            </>
          )}
          {d.amenities.length > 0 && (
            <>
              <SectionTitle locale={d.locale}>{t.amenities}</SectionTitle>
              <View style={s.amenityCols}>
                {d.amenities.map((a) => (
                  <View key={a} style={s.amenity}>
                    <Text style={s.amenityTick}>✓</Text>
                    <Text style={s.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          <Footer d={d} />
        </Page>
      )}

      {/* ---- Page 4: location + floor plans (skip when both empty) ---- */}
      {(d.map || d.plans.length > 0) && (
        <Page size="A4" style={s.page}>
          {d.map && (
            <>
              <SectionTitle locale={d.locale}>{t.location}</SectionTitle>
              <Image src={img(d.map)} style={s.mapImg} />
              <Text style={s.mapAttr}>{t.mapAttribution}</Text>
            </>
          )}
          {d.plans.length > 0 && (
            <>
              <SectionTitle locale={d.locale}>{t.floorPlans}</SectionTitle>
              {d.plans.map((p, i) => (
                <View key={i} style={s.planImgBox}>
                  <Image src={img(p)} style={s.planImg} />
                </View>
              ))}
            </>
          )}
          <Footer d={d} />
        </Page>
      )}

      {/* ---- Page 5: units + closing ---- */}
      <Page size="A4" style={s.page}>
        {d.units.length > 0 && (
          <>
            <SectionTitle locale={d.locale}>{t.unitsHeading}</SectionTitle>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, s.colUnit]}>{t.colUnit}</Text>
                <Text style={[s.thCell, s.colType]}>{t.colType}</Text>
                <Text style={[s.thCell, s.colBeds]}>{t.colBeds}</Text>
                <Text style={[s.thCell, s.colArea]}>{t.colArea}</Text>
                <Text style={[s.thCell, s.colFloor]}>{t.colFloor}</Text>
                <Text style={[s.thCell, s.colPrice]}>{t.colPrice}</Text>
              </View>
              {d.units.map((u, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.colUnit]}>{u.label}</Text>
                  <Text style={[s.td, s.colType]}>{u.type}</Text>
                  <Text style={[s.td, s.colBeds]}>{u.beds}</Text>
                  <Text style={[s.td, s.colArea]}>{u.area}</Text>
                  <Text style={[s.td, s.colFloor]}>{u.floor}</Text>
                  <Text style={[s.td, s.colPrice]}>{u.price}</Text>
                </View>
              ))}
            </View>
            {d.unitsMore > 0 && <Text style={s.moreUnits}>{t.moreUnits(d.unitsMore)}</Text>}
          </>
        )}

        <View style={s.closing} wrap={false}>
          <View style={s.closingLeft}>
            <Text style={[s.eyebrow, { marginBottom: 10 }]}>{t.contactHeading}</Text>
            {d.contact.variant === "advisor" && d.contact.photo && (
              <Image src={img(d.contact.photo)} style={s.advisorPhoto} />
            )}
            <Text style={[s.contactName, { fontFamily: disp }]}>
              {d.contact.variant === "advisor" ? d.contact.name : t.officeName}
            </Text>
            {d.contact.variant === "office" && (
              <Text style={s.contactLine}>{t.officeTagline}</Text>
            )}
            {contactPhone ? <Text style={s.contactLine}>{contactPhone}</Text> : null}
            {contactEmail ? <Text style={s.contactLine}>{contactEmail}</Text> : null}
            <Text style={s.contactSite}>{OFFICE_CONTACT.website}</Text>
          </View>
          {d.qrDataUri && (
            <View style={s.qrBox}>
              <Image src={d.qrDataUri} style={s.qrImg} />
              <Text style={s.qrHint}>{t.scanHint}</Text>
            </View>
          )}
        </View>

        <Text style={s.disclaimer}>{t.disclaimer}</Text>
        <Footer d={d} />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/factsheet/FactsheetDocument.tsx
git commit -m "Factsheet PDF: the branded document (cover, overview, gallery, location, units, closing)"
```

---

### Task 7: Public route + first live render

**Files:**
- Create: `src/app/api/factsheet/[lang]/[slug]/route.tsx`

- [ ] **Step 1: Write the route**

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { getDbProjectBySlug } from "@/lib/developmentRender";
import { buildFactsheetData } from "@/lib/factsheet/buildFactsheetData";
import FactsheetDocument from "@/lib/factsheet/FactsheetDocument";
import type { FactsheetLocale } from "@/lib/factsheet/types";

export const runtime = "nodejs";

const LOCALES = new Set(["en", "de", "pl", "ru"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string; slug: string }> },
) {
  const { lang, slug } = await params;
  if (!LOCALES.has(lang)) return new Response("Not found", { status: 404 });

  const vm = await getDbProjectBySlug(slug, lang);
  if (!vm || vm.publishStatus !== "published") {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await buildFactsheetData(vm, lang as FactsheetLocale);
    const pdf = await renderToBuffer(<FactsheetDocument d={data} />);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-factsheet-${lang}.pdf"`,
      },
    });
  } catch (e) {
    console.error(`[factsheet] render failed for ${slug}/${lang}:`, e);
    return new Response("Factsheet generation failed", { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 3: Live render — GALAXY RESIDENCES** (requires DB tunnel + dev server)

Prereq: tunnel open on `localhost:5433`, `npm run dev` running, `<SLUG>` looked up (see header).

```bash
curl -s -o /tmp/galaxy-en.pdf -w "%{http_code} %{size_download}\n" "http://localhost:3000/api/factsheet/en/<SLUG>"
curl -s -o /tmp/galaxy-de.pdf -w "%{http_code} %{size_download}\n" "http://localhost:3000/api/factsheet/de/<SLUG>"
curl -s -o /tmp/galaxy-ru.pdf -w "%{http_code} %{size_download}\n" "http://localhost:3000/api/factsheet/ru/<SLUG>"
```

Expected: `200` each, size > 200 KB (multiple embedded JPEGs). Then confirm they are real PDFs and page counts are plausible:

```bash
for f in /tmp/galaxy-{en,de,ru}.pdf; do
  node -e "
  const b=require('fs').readFileSync('$f');
  console.log('$f', b.slice(0,5).toString(), 'pages:', (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length);
  "
done
```

Expected: `%PDF-` and 4–5 pages each. Negative checks:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/factsheet/xx/<SLUG>"   # → 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/factsheet/en/does-not-exist"  # → 404
```

- [ ] **Step 4: Send the PDFs to the operator for visual sign-off**

Open `/tmp/galaxy-en.pdf`, `/tmp/galaxy-de.pdf`, `/tmp/galaxy-ru.pdf`. Check: cover typography (RU must show Playfair, not tofu boxes), scrim legibility, facts grid alignment, unit-table column fit with real refs/prices, map pin position, QR scannability (phone camera). Iterate on `FactsheetDocument` styles here — this step is where design polish happens against real data. Do not proceed until the operator approves the visual result.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/factsheet/[lang]/[slug]/route.tsx"
git commit -m "Factsheet PDF: public route (published projects, four locales)"
```

---

### Task 8: Admin route

**Files:**
- Create: `src/app/api/admin/developments/[id]/factsheet/route.tsx`

Auth-gated like the existing admin API routes (`src/app/api/admin/presentations/route.ts` pattern: `import { auth } from "@/auth"` + session check). Works for unpublished developments. Optional `?advisorId=` switches the contact card.

- [ ] **Step 1: Write the route**

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { mapRowToVM } from "@/lib/developmentRender";
import { buildFactsheetData } from "@/lib/factsheet/buildFactsheetData";
import FactsheetDocument from "@/lib/factsheet/FactsheetDocument";
import type { FactsheetLocale } from "@/lib/factsheet/types";

export const runtime = "nodejs";

const LOCALES = new Set(["en", "de", "pl", "ru"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") ?? "en";
  const advisorId = url.searchParams.get("advisorId");
  if (!LOCALES.has(lang)) return new Response("Bad locale", { status: 400 });

  const row = await prisma.development.findUnique({
    where: { id },
    include: { units: { orderBy: { sortIndex: "asc" } }, override: true },
  });
  if (!row) return new Response("Not found", { status: 404 });

  const advisor = advisorId
    ? await prisma.user.findUnique({
        where: { id: advisorId },
        select: { name: true, phone: true, email: true, photoPng: true, avatar: true },
      })
    : null;

  const vm = mapRowToVM(row as Parameters<typeof mapRowToVM>[0], lang);

  try {
    const data = await buildFactsheetData(vm, lang as FactsheetLocale, {
      advisor: advisor
        ? {
            name: advisor.name,
            phone: advisor.phone,
            email: advisor.email,
            photoPng: advisor.photoPng || advisor.avatar,
          }
        : null,
    });
    const pdf = await renderToBuffer(<FactsheetDocument d={data} />);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${vm.slug ?? id}-factsheet-${lang}.pdf"`,
      },
    });
  } catch (e) {
    console.error(`[factsheet:admin] render failed for ${id}/${lang}:`, e);
    return new Response("Factsheet generation failed", { status: 500 });
  }
}
```

Check the actual prisma import while implementing — other files in this repo import it as `import prisma from "@/lib/prisma"` or `import { prisma } from "@/lib/prisma"`; match whichever `src/lib/prisma.ts` exports (grep one of the existing admin routes).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 3: Verify auth gating + render** (dev server + tunnel)

```bash
# no session cookie → 401
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/admin/developments/<ID>/factsheet?lang=de"
```

Expected: `401`. A logged-in render (`200`, PDF) is verified through the browser in Task 10 when the admin UI link exists — or immediately by pasting the URL into a logged-in admin browser session.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/developments/[id]/factsheet/route.tsx"
git commit -m "Factsheet PDF: auth-gated admin route with advisor contact variant"
```

---

### Task 9: Presentation route

**Files:**
- Create: `src/app/c/[token]/factsheet/[developmentId]/route.tsx`

Token-validated exactly like the presentation page (`src/app/c/[token]/page.tsx:73` — read that query while implementing and mirror its status/expiry rules): presentation must exist, be `active`, not expired; the `developmentId` must be among its items. Locale from `presentation.locale`, advisor from `presentation.advisor`, `aliasName` from the item. `X-Robots-Tag: noindex`.

Middleware: the matcher already excludes the whole `c/` prefix (`src/middleware.ts` config comment) — the nested `/c/<token>/factsheet/...` path is covered by that same prefix exclusion. Verify in Step 3 that the response carries no `x-middleware-rewrite` header.

- [ ] **Step 1: Write the route**

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/prisma";
import { mapRowToVM } from "@/lib/developmentRender";
import { buildFactsheetData } from "@/lib/factsheet/buildFactsheetData";
import FactsheetDocument from "@/lib/factsheet/FactsheetDocument";
import type { FactsheetLocale } from "@/lib/factsheet/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; developmentId: string }> },
) {
  const { token, developmentId } = await params;

  const presentation = await prisma.clientPresentation.findUnique({
    where: { token },
    include: { advisor: true, items: { where: { developmentId } } },
  });
  const expired =
    presentation?.expiresAt != null && presentation.expiresAt < new Date();
  if (
    !presentation ||
    presentation.status !== "active" ||
    expired ||
    presentation.items.length === 0
  ) {
    return new Response("Not found", { status: 404 });
  }

  const row = await prisma.development.findUnique({
    where: { id: developmentId },
    include: { units: { orderBy: { sortIndex: "asc" } }, override: true },
  });
  if (!row) return new Response("Not found", { status: 404 });

  const locale = presentation.locale as FactsheetLocale;
  const vm = mapRowToVM(row as Parameters<typeof mapRowToVM>[0], locale);
  const item = presentation.items[0];

  try {
    const data = await buildFactsheetData(vm, locale, {
      aliasName: item.aliasName,
      advisor: presentation.advisor
        ? {
            name: presentation.advisor.name,
            phone: presentation.advisor.phone,
            email: presentation.advisor.email,
            photoPng: presentation.advisor.photoPng || presentation.advisor.avatar,
          }
        : null,
    });
    const pdf = await renderToBuffer(<FactsheetDocument d={data} />);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${vm.slug ?? developmentId}-factsheet-${locale}.pdf"`,
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error(`[factsheet:presentation] render failed for ${developmentId}:`, e);
    return new Response("Factsheet generation failed", { status: 500 });
  }
}
```

While implementing, compare the expiry/status rules against what `src/app/c/[token]/page.tsx` actually enforces (it also self-expires overdue presentations at line ~92) and mirror the read-side checks — do NOT copy the write (`update to expired`); a PDF download must not mutate presentation state.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — clean.

- [ ] **Step 3: Verify token gating** (dev server + tunnel)

```bash
# bad token → 404, and no middleware rewrite header
curl -s -D - -o /dev/null "http://localhost:3000/c/not-a-real-token/factsheet/00000000-0000-0000-0000-000000000000" | grep -i "HTTP/\|x-middleware"
```

Expected: `404`, no `x-middleware-rewrite` line. For a positive check, take a real active presentation token + one of its item developmentIds from the DB (read-only):

```bash
set -a; source .env.local; set +a; node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.clientPresentation.findFirst({ where: { status: 'active' }, include: { items: { take: 1 } }, orderBy: { createdAt: 'desc' } })
  .then(pr => { console.log(pr?.token, pr?.items[0]?.developmentId); return p.\$disconnect(); });
"
curl -s -o /tmp/pres-factsheet.pdf -w "%{http_code} %{size_download}\n" "http://localhost:3000/c/<TOKEN>/factsheet/<DEV_ID>"
```

Expected: `200`, PDF > 100 KB, advisor card visible when the presentation has one.

- [ ] **Step 4: Commit**

```bash
git add "src/app/c/[token]/factsheet/[developmentId]/route.tsx"
git commit -m "Factsheet PDF: token-gated presentation route with advisor and alias"
```

---

### Task 10: Frontend wiring (replace the placeholder button)

**Files:**
- Modify: `src/app/preview-project/UnitsView.tsx` (remove `PdfButton` + its two call sites, lines ~76-84, ~125, ~184)
- Modify: `src/lib/developmentCopy.ts` (remove the now-dead `soon` key from the interface + all four locale objects; KEEP `factsheetPdf`)
- Modify: `src/app/preview-project/ProjectPageBody.tsx` (page-level download link in the units section head)
- Modify: `src/app/preview-project/project.css` (anchor needs `text-decoration: none`)

- [ ] **Step 1: Remove the placeholder from `UnitsView.tsx`**

Delete the `PdfButton` function (lines ~75-84 incl. its comment) and both `<PdfButton t={t} />` usages (in `UnitDetails` and in `UnitCard`'s actions row). `npx tsc --noEmit` must stay clean afterward.

- [ ] **Step 2: Remove `soon` from `developmentCopy.ts`**

Remove `soon: string;` from `DevelopmentStrings` and the `soon:` line from each of the four locale objects (grep `soon:` — 4 hits). Verify nothing else references it: `grep -rn "\.soon\b" src/` → no hits.

- [ ] **Step 3: Add the page-level link in `ProjectPageBody.tsx`**

In the units section head (the `pp-units-head` div, currently at lines ~270-274), add the link after the hint paragraph. The component already has `t` (developmentCopy strings), `lang` and `p` (with `p.slug`) in scope:

```tsx
<div className="pp-units-head">
  <h2 className="pp-h2">{isSold ? t.unitsHeadingSoldOut : t.unitsHeading}</h2>
  <p className="pp-hint" style={{ margin: 0 }}>{t.unitsSubAvailable(avail.length)}{p.units.length !== avail.length ? t.unitsSubSold(p.units.length - avail.length) : ""}</p>
  {p.slug && (
    <a className="pp-pdf" href={`/api/factsheet/${lang}/${p.slug}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.factsheetPdf}
    </a>
  )}
</div>
```

Note: `ProjectPageBody` receives `p` typed as the VM — confirm it exposes `slug` (it is `DbProjectVM` on the DB-backed path; the live-feed adapter path (`feeds.ts`) has no slug, hence the `p.slug &&` guard). If the prop type is the slug-less `ProjectVM`, extend the guard with a cast or thread the slug in from the page — check `ProjectPageBody`'s prop type first and follow what it actually is.

- [ ] **Step 4: CSS — anchor variant**

In `project.css`, extend the existing `.pp-pdf` rule (line ~326) with `text-decoration: none;` so the same class works on `<a>`.

- [ ] **Step 5: Verify in the dev server**

```bash
node -e "
fetch('http://localhost:3000/projects/<SLUG>').then(r => r.text()).then(html => {
  console.log('factsheet link:', html.includes('/api/factsheet/en/<SLUG>') ? 'OK' : 'MISSING');
  console.log('placeholder gone:', html.includes('>soon<') || html.includes('bald') ? 'STILL THERE' : 'OK');
});
"
```

Expected: `factsheet link: OK`, `placeholder gone: OK`. Repeat for `/de/projects/<SLUG>` (link must carry `/de/`).

- [ ] **Step 6: Commit**

```bash
git add src/app/preview-project/UnitsView.tsx src/lib/developmentCopy.ts src/app/preview-project/ProjectPageBody.tsx src/app/preview-project/project.css
git commit -m "Project page: wire the factsheet download, drop the per-unit placeholder"
```

---

### Task 11: Edge cases + final pass

**Files:** none new — verification + fixes only.

- [ ] **Step 1: Sparse-data render**

Pick a published development with little data (no override description, few images) — read-only query:

```bash
set -a; source .env.local; set +a; node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.development.findFirst({ where: { publishStatus: 'published', override: { is: { descriptionEN: null } } }, select: { slug: true } })
  .then(d => { console.log(d); return p.\$disconnect(); });
"
curl -s -o /tmp/sparse.pdf -w "%{http_code} %{size_download}\n" "http://localhost:3000/api/factsheet/en/<SPARSE_SLUG>"
```

Expected: `200`; open the PDF — no blank sections, no broken images; pages with no content are absent.

- [ ] **Step 2: Many-units render (cap)**

Find a published development with > 15 available units, render, confirm the table stops at 15 with the localized "+N more" line.

```bash
set -a; source .env.local; set +a; node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.development.findMany({ where: { publishStatus: 'published' }, select: { slug: true, units: { where: { status: 'available' }, select: { id: true } } } })
  .then(ds => { const d = ds.find(x => x.units.length > 15); console.log(d?.slug, d?.units.length); return p.\$disconnect(); });
"
```

- [ ] **Step 3: PL locale render**

`curl -s -o /tmp/galaxy-pl.pdf -w "%{http_code}\n" "http://localhost:3000/api/factsheet/pl/<SLUG>"` → 200; open, check Polish strings and `pl-PL` number format.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds. Watch for react-pdf/sharp bundling issues in route handlers — if Next tries to bundle the font TTF reads, the routes already read via `process.cwd()` at runtime (no import-time asset references), which is the pattern the legacy PDF route ships with.

- [ ] **Step 5: Commit any fixes; update SITE-CHANGELOG**

Add a dated entry to `docs/SITE-CHANGELOG.md` following its existing format, describing the factsheet feature and its three routes.

```bash
git add -A && git commit -m "Factsheet PDF: edge-case fixes and changelog entry"
```

---

## Deliberately out of scope (from the spec)

- Per-unit factsheet variant.
- Caching/pre-generation.
- Admin UI button inside the CRM (the admin **route** ships; placing buttons in the Lead Cockpit / Property Matching UI is a follow-up decided with the operator).
- Personal-selection **UI** download link on `/c/[token]` property cards — same: route ships first, the card link is a small follow-up (`PropertyCard.tsx`/`PropertyOverlay.tsx`) once the operator confirms placement.

## Self-review notes

- Spec coverage: fonts (T1), copy/i18n (T2), images+traversal guard+WebP (T3), static map+attribution+LRU+never-fails (T4), data builder incl. availability filtering/cap/QR/alias/advisor (T5), document incl. presence-guarded sections and skip-empty-pages (T6), public route+404 rules (T7), admin route+auth+unpublished (T8), presentation route+token+noindex+no-mutation (T9), button swap (T10), sparse/cap/PL/build (T11). Spec's "as of" stamp: T5 `generatedAt` + T6 footer. Disclaimer: T2+T6.
- `mapRowToVM` cast (`Parameters<typeof mapRowToVM>[0]`) appears in T8 and T9 identically.
