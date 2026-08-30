# Leptos Estates Feed Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Leptos Estates Kyero-v3 feed as developer key `leptos`, producing 45 Cyprus projects / 377 units with full-resolution images, per-unit floor plans, amenities and travel times — publishable without manual rework.

**Architecture:** Leptos joins the **standard id-driven sync path**, unlike Mito. Its refs carry a positional project code (`A-BAG-Z-206` → `BAG`), so `listProjectIds("leptos")` returns real ids and `getPreviewProject("leptos", code)` returns one project. That means `syncDeveloperCore`, `checkFeedCompleteness` and `syncOneProject` all work unchanged — no `syncLeptosCore`, no DB-anchored identity, no branch in `syncOneDevelopment`. All new logic is stateless and lives in `feeds.ts`.

**Tech Stack:** TypeScript, Next.js 14, xml2js, Prisma. Tests are standalone Node scripts under `scripts/qa/` that bundle the TypeScript with esbuild and assert — the repo has no unit-test runner.

**Spec:** `docs/superpowers/specs/2026-08-30-leptos-feed-adapter-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/preview-project/feeds.ts` (modify) | All Leptos parsing, scope filtering, code derivation, grouping and `ProjectVM` construction. Stateless — **must not import Prisma**. |
| `src/lib/feedSync.ts` (modify) | Two registry lines only: `DEV_ACCOUNT.leptos` and `SYNCED_DEVS`. |
| `scripts/qa/leptos-grouping-check.mjs` (create) | Synthetic self-test for code derivation, merges, splits and scope filtering. No network. |
| `scripts/qa/leptos-live-check.mjs` (create) | Runs the spec's Verification list against the live feed. |

**Why the tests are synthetic:** `mito-clusters-check.mjs` sets the precedent — a test bound to the live feed fails when the vendor edits a listing, which trains people to ignore it. The live feed gets its own separate script, run deliberately.

---

## Task 1: Scope filter and row parsing

**Files:**
- Modify: `src/app/preview-project/feeds.ts` (append a new Leptos section before the `DEVELOPERS` registry, around line 978 where the Mito section begins)
- Test: `scripts/qa/leptos-grouping-check.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `scripts/qa/leptos-grouping-check.mjs`:

```js
#!/usr/bin/env node
/* Self-test for the Leptos feed grouping in src/app/preview-project/feeds.ts.

   Every case below reproduces a topology measured on the live feed on
   2026-08-30, synthetically, so the test needs no network and cannot drift when
   Leptos edits their listings.

     node scripts/qa/leptos-grouping-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild");
  process.exit(2);
}

const bundlePath = join(tmpdir(), `leptos-grouping-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  // feeds.ts pulls in xml2js, a real CJS dependency requiring Node built-ins;
  // esbuild's ESM output has no ambient require to satisfy them. Same shim as
  // mito-clusters-check.mjs.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const F = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const row = (over) => ({
  ref: "A-BAG-Z-206", price: 258000, type: "Apartments / Penthouses",
  town: "Geroskipou", province: "Paphos", country: "Cyprus",
  h2: "Bel Air Gardens Apartment 206, Block Zefiro", body: "", lat: null, lng: null,
  images: [], plans: [], features: [], benefits: [], beds: "2", baths: "2",
  plot: null, covered: 95, ...over,
});

console.log("\nleptosInScope — Cyprus, residential + commercial, no land parcels");
check("Cyprus apartment is in scope", F.leptosInScope(row()), true);
check("Greece is out (districtFor would call it Paphos)",
  F.leptosInScope(row({ country: "Greece", province: "Paros", town: "Paros" })), false);
check("land parcel is out", F.leptosInScope(row({ type: "Plots & Land Parcels" })), false);
check("commercial is in", F.leptosInScope(row({ type: "Shops / Commercial Buildings" })), true);
check("studio is in", F.leptosInScope(row({ type: "Studio" })), true);
check("townhouse is in", F.leptosInScope(row({ type: "Townhouses / Maisonettes" })), true);
// Both fields are trimmed and lower-cased before comparison; the feed's own
// spelling is not something this adapter gets to assume.
check("padded, mixed-case country", F.leptosInScope(row({ country: "  CYPRUS  " })), true);
check("padded, mixed-case land parcel",
  F.leptosInScope(row({ type: " plots & LAND parcels " })), false);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: FAIL — `F.leptosInScope is not a function` (a TypeError, not an assertion failure).

- [ ] **Step 3: Implement the minimal code to make the test pass**

In `src/app/preview-project/feeds.ts`, insert **immediately before** the line `const DEVELOPERS: Record<string, { label: string; default: string }> = {`:

```ts
// ==================================================================
// Leptos Estates (Kyero v3). Unlike Mito, this feed carries project identity:
// the ref is structured, e.g. A-BAG-Z-206 = Apartment, Bel Air Gardens, block
// Zefiro, unit 206. Grouping by that code puts 377 in-scope units into 48
// groups whose members never lie more than 9 m apart (measured 2026-08-30) —
// so Leptos uses the ordinary id-driven path (listProjectIds /
// getPreviewProject), not Mito's clustering detour.
// See docs/superpowers/specs/2026-08-30-leptos-feed-adapter-design.md
// ==================================================================
const LEPTOS_URL =
  "https://www.leptosestates.com/wp-content/themes/leptos-estates/template-export-xml-keyro.php?country=all";

export type LeptosRow = {
  ref: string; price: number; type: string;
  town: string; province: string; country: string;
  h2: string; body: string; descHtml: string;
  lat: number | null; lng: number | null;
  images: string[]; plans: string[];
  features: string[]; benefits: string[];
  beds: string; baths: string; plot: number | null; covered: number | null;
};

// Cyprus only, residential + commercial, no land parcels (operator's decision,
// 2026-08-30). Greece is filtered HERE rather than downstream because
// districtFor() resolves by longitude with no country check — lng < 32.6 means
// "Paphos", and Paros (25.15), Crete (23.8), Santorini (25.4) and Athens (23.7)
// all fall under it. Excluding them at the boundary means that function is
// never handed a coordinate it would answer wrongly.
export const leptosInScope = (r: { country: string; type: string }): boolean =>
  r.country.trim().toLowerCase() === "cyprus" &&
  r.type.trim().toLowerCase() !== "plots & land parcels";
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: 8 `ok` lines, `all checks passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/leptos-grouping-check.mjs
git commit -m "Leptos: scope filter — Cyprus, no land parcels"
```

---

## Task 2: The positional project code

This is the highest-risk logic in the adapter. `PG` names two different projects depending on where it sits in the ref.

**Files:**
- Modify: `src/app/preview-project/feeds.ts`
- Test: `scripts/qa/leptos-grouping-check.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/leptos-grouping-check.mjs`, **before** the final `console.log`/`process.exit` lines:

```js
console.log("\nleptosCode — read at a fixed position, never searched for");
check("type prefix skipped",            F.leptosCode("A-BAG-Z-206"), "BAG");
check("villa prefix skipped",           F.leptosCode("V-KAM-3-434B"), "KAM");
check("commercial prefix skipped",      F.leptosCode("C-LMNR-S103"), "LMNR");
check("studio prefix skipped",          F.leptosCode("S-B08-208-PG"), "B08");
// PG is Peyia Gardens in segment 2 and Paphos Gardens in the LAST segment,
// 12 km apart. A substring or last-segment rule merges them.
check("PG in segment 2 is Peyia",       F.leptosCode("A-PG-BLK-D-204"), "PG");
check("PG in last segment is not read", F.leptosCode("A-A09-109-PG"), "A09");
// "AP" and "PENT" are the two one-off type spellings; drop either from
// LEPTOS_TYPE_PREFIX and the type is read as the project code.
check("AP prefix skipped",              F.leptosCode("AP-VEN-12"), "VEN");
check("PENT prefix skipped",            F.leptosCode("PENT-DEL-5-b1701"), "DEL");
// Blu Marine: CT (Cavalli) is the ONLY tower segment that follows LBM in the
// feed — 1, 3 and CT are the only three that exist at all. Anything else there
// must stay Poseidon rather than mint a project key with no name behind it.
check("Cavalli Tower splits off",       F.leptosCode("A-LBM-CT-3-1604"), "LBM-CT");
check("Poseidon stays plain LBM",       F.leptosCode("A-LBM-3-2604"), "LBM");
check("LBM with numeric next segment",  F.leptosCode("A-LBM-1-1704"), "LBM");
check("LBM + PH is still Poseidon",     F.leptosCode("A-LBM-PH-1604"), "LBM");
check("LBM + one letter is Poseidon",   F.leptosCode("A-LBM-C-1604"), "LBM");
// An UNKNOWN single-letter type prefix is the dangerous case, and the only one
// here that merges two real projects rather than splitting one. The feed
// already carries ad-hoc prefixes ("AP", "PENT"), so the vendor demonstrably
// mints new ones; the day a "T-" (townhouse?) appears, a leading-segment rule
// that accepts it as the code files every such ref under project "T". Kamares
// (Paphos) and Blu Marine (Limassol) would become ONE project 50 km wide,
// carrying whichever name came first and a price range spanning both — and
// nothing catches it, because the completeness guard counts units and no unit
// is lost. The shortest real code in the feed is "PG": one character is never
// a project.
check("unknown 1-char prefix skipped",  F.leptosCode("T-KAM-3-12"), "KAM");
check("…and does not merge with LBM",   F.leptosCode("T-LBM-CT-3-99"), "LBM-CT");
check("unknown 1-char prefix, lower",   F.leptosCode("t-bag-z-206"), "BAG");
check("known 2-char code still wins",   F.leptosCode("T-PG-BLK-D-204"), "PG");
// Defensive: refs with no type prefix, and junk.
check("no type prefix",                 F.leptosCode("APHII-2-E2-202"), "APHII");
// The rule is about the LEADING segment only — a one-character segment further
// in is still just a segment. "A-LBM-C-1604" above already covers that.
check("2-char lead is a code, not a prefix", F.leptosCode("XY-3-12"), "XY");
check("empty ref",                      F.leptosCode(""), "");
check("single segment",                 F.leptosCode("KOILI"), "KOILI");
// A lone type letter has no second segment to fall back to: without the
// i < seg.length - 1 guard the scan would run off the end and the code would
// come out empty.
check("lone type letter is the code",   F.leptosCode("A"), "A");
// Normalisation: the feed is not guaranteed to be tidy.
check("lowercase ref uppercased",       F.leptosCode("a-bag-z-206"), "BAG");
check("lowercase Cavalli ref",          F.leptosCode("a-lbm-ct-3-1604"), "LBM-CT");
check("padded segments trimmed",        F.leptosCode(" A - BAG - Z - 206 "), "BAG");
check("empty segment skipped",          F.leptosCode("A--BAG-Z-206"), "BAG");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: FAIL — `F.leptosCode is not a function`.

- [ ] **Step 3: Implement the minimal code to make the test pass**

In `feeds.ts`, append after `leptosInScope`:

```ts
// Leading segment is the property TYPE, not the project: A=Apartment,
// V=Villa, P=Plot, C=Commercial, S=Studio (plus two one-off spellings).
const LEPTOS_TYPE_PREFIX = new Set(["A", "V", "P", "C", "S", "AP", "PENT"]);

const leptosSegments = (ref: string): string[] =>
  String(ref || "").split("-").map((s) => s.trim()).filter(Boolean);

// The code is read at a KNOWN POSITION — the first leading segment that can be
// a project code — never by searching the ref for a token that looks like one.
// "PG" is Peyia Gardens in segment 2 (A-PG-BLK-D-204, Peyia) and Paphos Gardens
// in the last segment (A-A09-109-PG, Kato Paphos), two projects 12 km apart. A
// substring or last-segment rule merges them. This is the single most likely
// way a future edit breaks this adapter.
//
// A leading segment is skipped when it is a known type prefix OR a single
// character. The second rule is the load-bearing one: LEPTOS_TYPE_PREFIX is a
// closed list, and the feed already carries the ad-hoc "AP" and "PENT", so the
// vendor demonstrably mints new spellings. Accepting an unknown one-letter
// prefix as the code is not a harmless miss — every ref carrying it lands in
// ONE group. "T-KAM-3-12" (Kamares, Paphos) and "T-LBM-CT-3-99" (Blu Marine,
// Limassol) would become a single project 50 km wide, wearing whichever name
// sorted first and a price range spanning both. Nothing downstream notices:
// the completeness guard counts units, and no unit is lost. The shortest real
// code in the feed is "PG" — a project code is never one character, so
// rejecting one costs nothing and closes the merge.
// Guarded on seg.length - 1: a ref that is nothing BUT skippable segments
// ("A") must still yield its last one rather than an empty code, which would
// drop the row from grouping entirely.
function leptosCodeIndex(seg: string[]): number {
  let i = 0;
  while (i < seg.length - 1 &&
         (LEPTOS_TYPE_PREFIX.has(seg[i].toUpperCase()) || seg[i].length === 1)) i++;
  return i;
}

export function leptosCode(ref: string): string {
  const seg = leptosSegments(ref);
  if (!seg.length) return "";
  const i = leptosCodeIndex(seg);
  const code = (seg[i] ?? "").toUpperCase();
  // Limassol Blu Marine holds two separately branded towers. Only three
  // segments ever follow LBM in the feed — 1, 3 and CT — so CT (Cavalli) is
  // matched EXACTLY; Poseidon's refs put a bedroom count there instead
  // (A-LBM-3-2604), and plain "LBM" means Poseidon. Matching "any alphabetic
  // segment" would mint keys like LBM-PH that no display name covers, silently
  // splitting Poseidon into one-unit projects.
  if (code === "LBM" && (seg[i + 1] ?? "").toUpperCase() === "CT") return "LBM-CT";
  return code;
}

// Two codes that name one project. Verified on the live feed 2026-08-30: same
// town, same coordinates, identical heading prefixes.
const LEPTOS_MERGE: Record<string, string> = { ZAN: "ZANATZIA" };

// Paphos Gardens puts the project token LAST (A-A09-109-PG), so the positional
// rule reads the BLOCK as the code and yields four one-unit projects. They are
// merged under PAPHOSG — deliberately NOT "PG", which already belongs to Peyia
// Gardens. The merge is guarded on the trailing PG rather than applied to the
// block code alone: all four Paphos Gardens refs carry it, and a bare block
// code (A-B08-12) belongs to some other project whose block happens to be
// numbered the same way.
const LEPTOS_PG_BLOCKS = new Set(["A09", "B11", "B08", "B10"]);

// Display names. The code alone (BAG, AKMT, PRDSGIII) is meaningless in the
// admin, and the heading is a UNIT title, not a project name — stripping it
// splits Kamares Village into three when every one of its units says, in
// identical words, that it is one development. 45 rows, reviewed once.
// A code NOT listed here is not an error: it falls back to its heading.
const LEPTOS_NAMES: Record<string, string> = {
  "LBM-CT": "Cavalli Tower", LBM: "Poseidon Tower",
  BAG: "Bel Air Gardens", LPARK: "Limassol Park", KAM: "Kamares Village",
  CORALG: "Coral Gardens", ADN: "Adonis Beach Villas", MAND: "Mandria Gardens",
  COR: "Coral Bay Villas", MBV: "Maniki Beach Villas", OLY: "Olympus Village",
  CORS: "Coral Seas Villas", IAS: "Iasonas Beach Villas", VEN: "Venus Gardens",
  ZANATZIA: "Zanatzia", AKMT: "Akamantis", PER: "Perneri",
  ARM: "Armonia Beach Villas", APHS: "Aphrodite Springs", AKAK: "Akakia",
  KINGC: "Kings Court", DEL: "Limassol Del Mar", RUBY: "The Ruby",
  PG: "Peyia Gardens", PAPHOSG: "Paphos Gardens", ZEL: "Zelemenos Village",
  LMNR: "Limnaria Westpark", APHG: "Aphrodite Gardens",
  TALAC: "Tala Village Corner", BEL: "Belvedere", KOILI: "Koili Hills",
  KINGG: "Kings Gardens", PSSR: "Pissouri Villas", CBP: "Coral Bay Plaza",
  AKR: "Akropolis", NEAP: "Neapolis Corporate Center", ATLCEN: "Atlas Centre",
  KHV: "Kissonerga Hills Villas", WSTPRK: "West Park Court III",
  PRDSGIII: "Paradise Gardens", STGH: "St. George's Hills",
  LTCH: "Latchi Beach Villas", BAS: "Basilica Harbour Court",
  APO: "Apollo Beach Villas", SIV: "Leptos Sivitanidium Megaro",
};

export function leptosProjectKey(r: { ref: string; h2: string }): string {
  const code = leptosCode(r.ref);
  // The Ruby is a separately branded tower inside Limassol Del Mar, the same
  // shape as Cavalli inside Blu Marine — but Del Mar's refs give it no segment
  // of its own (the tower's own ref is A-DEL-5-b1701), so this one split reads
  // the heading. Anchored at the START, because a heading is a UNIT title that
  // opens with its project name: a Del Mar unit whose title merely mentions
  // the tower would otherwise be mis-keyed into it.
  if (code === "DEL" && /^The Ruby\b/i.test(r.h2 || "")) return "RUBY";
  const seg = leptosSegments(r.ref);
  if (LEPTOS_PG_BLOCKS.has(code) && (seg[seg.length - 1] ?? "").toUpperCase() === "PG") return "PAPHOSG";
  return LEPTOS_MERGE[code] ?? code;
}

// Unit designations to strip when falling back to the heading — but ONLY where
// one is followed by a unit number ("Villa No. 3", "Apartment 206"), never at
// the first unit word encountered. Leptos names eight of its 45 projects
// "... Villas", so the first-word rule turns "Sunset Beach Villas Villa No. 3"
// into "Sunset Beach" — it mis-names exactly the pattern the house uses, on
// the one path a project added after today will take. Stripping at a comma
// instead would break the same names ("Coral Bay Villas, Paphos"); the unit
// number is the only marker that reliably says "the name ended here".
// "Floor" is in the list for headings like "Floor 5" that are entirely a unit
// designation. It is also the one word normally PRECEDED by its qualifier, so
// the unit-number requirement is what keeps "Second Floor Apartment" from
// collapsing to "Second".
const LEPTOS_UNIT_WORDS =
  "Grand Mansion|Townhouse|Maisonette|Penthhouse|Penthouse|Apartment|Restaurant|Mansion|Villas|Villa|Studio|Houses|House|Shops|Shop|Flat|Floor";
// A unit number: "No. M1", "No. 003 1&2", "206", "6A/6B" — the "No." is
// optional and the number may carry a one- or two-letter prefix.
const LEPTOS_UNIT_NO = String.raw`(?:No\.?\s*)?[A-Za-z]{0,2}\d`;
const LEPTOS_UNIT_TAIL = new RegExp(
  String.raw`\s*\b(?:${LEPTOS_UNIT_WORDS})\b(?=\s+${LEPTOS_UNIT_NO}).*$`, "i");

export function leptosProjectName(key: string, h2: string): string {
  const listed = LEPTOS_NAMES[key];
  if (listed) return listed;
  let s = String(h2 || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*[,–-]\s*(Block|Blk)\b.*$/i, "");
  s = s.replace(LEPTOS_UNIT_TAIL, "");
  // A name that itself opens with a unit word ("Villa Romana No. 5") keeps its
  // designation, so its unit number is still attached. That number is not part
  // of the name either.
  s = s.replace(new RegExp(String.raw`\s*\bNo\.?\s*[A-Za-z]{0,2}\d.*$`, "i"), "");
  s = s.replace(/[,\s–\-/&]+$/, "").trim();
  // A heading like "Floor 5" carries no project name at all; the code is the
  // only honest answer left, and it is at least stable and greppable.
  return s.length >= 3 ? s : key;
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: 59 `ok` lines, `all checks passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/leptos-grouping-check.mjs
git commit -m "Leptos: exception table for merges, splits and display names"
```

---

## Task 4: Full-resolution image URLs

**Files:**
- Modify: `src/app/preview-project/feeds.ts`
- Test: `scripts/qa/leptos-grouping-check.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/leptos-grouping-check.mjs`, before the final lines:

```js
console.log("\nleptosFullSize — WordPress -scaled downsizes back to the original");
const P = "https://www.leptosestates.com/wp-content/uploads/2023/05/";
check("scaled jpg upgraded",  F.leptosFullSize(`${P}03-1-scaled.jpg`), `${P}03-1.jpg`);
check("scaled png upgraded",  F.leptosFullSize(`${P}plan-scaled.png`), `${P}plan.png`);
check("plain url untouched",  F.leptosFullSize(`${P}13-1.jpg`), `${P}13-1.jpg`);
check("four-letter extension", F.leptosFullSize(`${P}03-1-scaled.jpeg`), `${P}03-1.jpeg`);
// "-scaled" only counts as WordPress's marker where the extension it precedes
// ENDS the URL or is followed by a query string. Anywhere else it belongs to
// the name or to a directory, and rewriting it would 404.
check("mid-name scaled kept", F.leptosFullSize(`${P}un-scaled-view.jpg`), `${P}un-scaled-view.jpg`);
check("scaled path segment kept",
  F.leptosFullSize(`${P}dir-scaled.jpg/b.jpg`), `${P}dir-scaled.jpg/b.jpg`);
check("scaled directory kept",
  F.leptosFullSize(`${P}folder-scaled/03-1.jpg`), `${P}folder-scaled/03-1.jpg`);
check("query string kept", F.leptosFullSize(`${P}03-1-scaled.jpg?w=1200`), `${P}03-1.jpg?w=1200`);
check("http upgraded to https", F.leptosFullSize("http://www.leptosestates.com/a-scaled.jpg"),
  "https://www.leptosestates.com/a.jpg");
check("empty url", F.leptosFullSize(""), "");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: FAIL — `F.leptosFullSize is not a function`.

- [ ] **Step 3: Implement the minimal code to make the test pass**

In `feeds.ts`, append after `leptosProjectName`:

```ts
// 807 of the feed's 2190 image URLs carry WordPress's "-scaled" suffix, which
// means WordPress downsized an original above its 2560 px threshold and KEPT
// the original alongside it. Measured 2026-08-30:
//   03-1-scaled.jpg  1920x1373 (513 KB)  ->  03-1.jpg  4128x2953 (2.1 MB)
//   04-1-scaled.jpg  1920x1288 (632 KB)  ->  04-1.jpg  4588x3078 (3.4 MB)
// Sampling 30 of the 807: 30/30 originals exist and every one is larger.
// No runtime HEAD check — this function is on the public preview page's path,
// and 807 HEAD requests per render is not a trade worth making. Checking all
// 807 belongs in the offline live-feed check (Task 9 of the plan), so that a
// missing original surfaces there rather than as a silent downgrade.
export const leptosFullSize = (u: string): string =>
  secure(String(u || "")).replace(/-scaled(\.[A-Za-z]{3,4})(?=$|\?)/, "$1");
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: 69 `ok` lines, `all checks passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/leptos-grouping-check.mjs
git commit -m "Leptos: request full-resolution originals, not WordPress downsizes"
```

---

## Task 5: Feed fetch, row parsing and grouping

**Files:**
- Modify: `src/app/preview-project/feeds.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/leptos-grouping-check.mjs`, before the final lines:

```js
console.log("\ngroupLeptosRows — grouping rows into projects");
const rows = [
  row({ ref: "A-BAG-Z-206", h2: "Bel Air Gardens Apartment 206, Block Zefiro" }),
  row({ ref: "A-BAG-S-303", h2: "Bel Air Gardens Penthhouse 303, Block Sirocco" }),
  row({ ref: "V-ZAN-592",   h2: "Zanatzia Villa 59/2",  town: "Souni-Zanatzia", province: "Limassol" }),
  row({ ref: "V-ZANATZIA-43", h2: "Zanatzia Villa 43",  town: "Souni-Zanatzia", province: "Limassol" }),
  row({ ref: "A-LBM-CT-3-201", h2: "Apartment No. 201", town: "Limassol", province: "Limassol" }),
  row({ ref: "A-LBM-3-2604",   h2: "Apartment No. 2604", town: "Limassol", province: "Limassol" }),
  row({ ref: "V-MBV-01", h2: "Maleme Beach Villas No. 1", country: "Greece", province: "Paros", town: "Paros" }),
  row({ ref: "P-OLYMPUS", h2: "Olympus Villas II Land Parcel", type: "Plots & Land Parcels" }),
];
const groups = F.groupLeptosRows(rows);
const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
check("out-of-scope rows dropped", groups.reduce((n, g) => n + g.rows.length, 0), 6);
check("Greece produced no group", byKey["MBV"] === undefined, true);
check("land parcel produced no group", byKey["OLYMPUS"] === undefined, true);
check("Bel Air holds both blocks", byKey["BAG"].rows.length, 2);
check("Bel Air named from table", byKey["BAG"].name, "Bel Air Gardens");
check("ZAN merged into ZANATZIA", byKey["ZANATZIA"].rows.length, 2);
check("Cavalli separate from Poseidon", [byKey["LBM-CT"].rows.length, byKey["LBM"].rows.length], [1, 1]);
check("Cavalli named", byKey["LBM-CT"].name, "Cavalli Tower");
check("Poseidon named", byKey["LBM"].name, "Poseidon Tower");
check("groups sorted by size then key", groups[0].key, "BAG");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: FAIL — `F.groupLeptosRows is not a function`.

- [ ] **Step 3: Implement the minimal code to make the test pass**

In `feeds.ts`, append after `leptosFullSize`:

```ts
export type LeptosGroup = { key: string; name: string; rows: LeptosRow[] };

// Grouping is pure so it can be tested without the network. leptosGroups()
// below is the only part that touches the feed. Named apart from it
// deliberately: two functions differing by one character is a bug waiting.
export function groupLeptosRows(rows: LeptosRow[]): LeptosGroup[] {
  const byKey = new Map<string, LeptosRow[]>();
  for (const r of rows) {
    if (!leptosInScope(r)) continue;
    const key = leptosProjectKey(r);
    if (!key) continue;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
  }
  return Array.from(byKey.entries())
    .map(([key, rs]) => ({ key, name: leptosProjectName(key, rs[0].h2), rows: rs }))
    // Deterministic order: biggest first, ties broken by key. Sync iterates
    // this, and a stable order keeps sync logs diffable between nights.
    .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
}

const leptosDecode = (s: string): string =>
  s.replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
   .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

function leptosRow(p: any): LeptosRow {
  const descHtml = leptosDecode(txt(p?.desc?.en));
  const loc = p?.location ?? {};
  const lat = toNum(loc?.latitude), lng = toNum(loc?.longitude);
  return {
    ref: clean(p?.ref), price: toNum(p?.price) ?? 0, type: clean(p?.type),
    town: clean(p?.town), province: clean(p?.province), country: clean(p?.country),
    h2: (descHtml.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    body: descHtml.replace(/<h2>[\s\S]*?<\/h2>/i, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    descHtml,
    lat: lat, lng: lng,
    images: arr(p?.images?.image).map((i: any) => leptosFullSize(txt(i?.url))).filter(Boolean),
    plans: arr(p?.floor_plans?.image).map((i: any) => leptosFullSize(txt(i?.url))).filter(Boolean),
    features: arr(p?.features?.feature).map(txt).filter(Boolean),
    benefits: arr(p?.benefits?.benefit).map(txt).filter(Boolean),
    beds: clean(p?.beds), baths: clean(p?.baths),
    plot: toNum(p?.sqm?.plot_area), covered: toNum(p?.sqm?.covered_area),
  };
}

// Memoised on top of cachedParse's 5-minute feed cache: checkFeedCompleteness
// calls getPreviewProject once per project, so without this the 440-row parse
// and grouping would run 45 times per sync.
let leptosMemo: { at: number; groups: LeptosGroup[] } | null = null;
export async function leptosGroups(): Promise<LeptosGroup[]> {
  if (leptosMemo && Date.now() - leptosMemo.at < FEED_TTL) return leptosMemo.groups;
  const doc = await cachedParse(LEPTOS_URL);
  const groups = groupLeptosRows(arr(doc?.root?.property).map(leptosRow));
  leptosMemo = { at: Date.now(), groups };
  return groups;
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: 79 `ok` lines, `all checks passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/leptos-grouping-check.mjs
git commit -m "Leptos: fetch, parse and group the feed into projects"
```

---

## Task 6: Build the ProjectVM

**Files:**
- Modify: `src/app/preview-project/feeds.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa/leptos-grouping-check.mjs`, before the final lines:

```js
console.log("\nleptosVm — the view model handed to the sync");
const vmRows = [
  row({ ref: "A-BAG-Z-206", price: 258000, h2: "Bel Air Gardens Apartment 206, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 95, beds: "2", baths: "2",
        images: ["https://x/a.jpg"], plans: ["https://x/p1.jpg"],
        features: ["Swimming Pool", "Air Conditioning"], benefits: ["AIRPORT 26 min", "SEA 2 min"] }),
  row({ ref: "A-BAG-Z-205", price: 525000, h2: "Bel Air Gardens Apartment 205, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 110, beds: "3", baths: "2",
        images: ["https://x/b.jpg"], plans: ["https://x/p2.jpg"],
        features: ["Swimming Pool", "Private Parking"], benefits: ["AIRPORT 26 min"] }),
  // price 0 must never set the "from" price — 4 in-scope units carry it.
  row({ ref: "A-BAG-Z-204", price: 0, h2: "Bel Air Gardens Apartment 204, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 90, beds: "2", baths: "1" }),
];
const vm = F.leptosVm(F.groupLeptosRows(vmRows)[0]);
check("id is the project key",        vm.id, "BAG");
check("dev key",                      vm.dev, "leptos");
check("public name from table",       vm.publicName, "Bel Air Gardens");
check("developer label",              vm.developer, "Leptos Estates");
check("district from coordinates",    vm.district, "Paphos");
check("all units carried",            vm.units.length, 3);
check("priceFrom skips the zero",     vm.priceFrom, 258000);
check("priceTo",                      vm.priceTo, 525000);
check("amenities deduplicated",       vm.amenities.slice().sort(),
  ["Air Conditioning", "Private Parking", "Swimming Pool"]);
check("benefits become extraFacts",   vm.extraFacts.find((f) => f.label === "Airport")?.value, "26 min");
check("benefits deduplicated",        vm.extraFacts.filter((f) => f.label === "Airport").length, 1);
check("gallery merged across units",  vm.gallery, ["https://x/a.jpg", "https://x/b.jpg"]);
check("project plans are the union",  vm.plans, ["https://x/p1.jpg", "https://x/p2.jpg"]);
check("unit keeps its own plans",     vm.units[0].plans, ["https://x/p1.jpg"]);
check("unit label carries the block", vm.units[0].label, "Block Zefiro · Nr. 206");
check("unit ref is the feed ref",     vm.units[0].ref, "A-BAG-Z-206");
check("covered area on unit",         vm.units[0].areaBuilt, "95 m²");
check("centre from first coords",     vm.center, { lat: 34.75, lng: 32.47 });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: FAIL — `F.leptosVm is not a function`.

- [ ] **Step 3: Implement the minimal code to make the test pass**

In `feeds.ts`, append after `leptosGroups`:

```ts
// "AIRPORT 26 min" -> { label: "Airport", value: "26 min" }. These go to
// extraFacts and deliberately NOT to Development.distances, which
// developmentDistances.ts owns and recomputes by haversine on every write
// path. Two writers on one field is how Development.stage got wiped nightly
// until it was moved to the override table (Celestia, 2026-07-17/18).
// Leptos's figures are real drive times and better than our straight-line
// estimate, but preferring them belongs in a deliberate change to that
// module, not in a quiet second writer here.
const LEPTOS_BENEFIT_LABEL: Record<string, string> = {
  AIRPORT: "Airport", SEA: "Sea", SHOPS: "Shops",
  HEALTHCARE: "Healthcare", EDUCATION: "Education",
};
function leptosBenefit(b: string): { label: string; value: string } | null {
  const m = String(b || "").trim().match(/^([A-Za-z ]+?)\s+(\d+\s*min)$/i);
  if (!m) return null;
  const label = LEPTOS_BENEFIT_LABEL[m[1].trim().toUpperCase()];
  return label ? { label, value: m[2].replace(/\s+/g, " ").toLowerCase() } : null;
}

// "Bel Air Gardens Apartment 206, Block Zefiro" -> "Block Zefiro · Nr. 206",
// matching the existing "Block C · Nr. 504" convention.
//
// The words a heading uses to introduce a unit number, and equally the words
// at which a BUILDING name ends. "Plot" and "Parcel" are here because the feed
// uses both for units that are land inside a development; the plural forms
// because three Coral Bay listings are a villa pair sold as one
// ("Coral Bay Villas 233 A & B").
const LEPTOS_LABEL_DESIG =
  "Grand Mansions?|Townhouses?|Maisonettes?|Penthhouses?|Penthouses?|Apartments?|Mansions?|Villas?|Studios?|Houses?|Shops?|Restaurants?|Flats?|Floors?|Plots?|Parcels?";
// The optional letter suffix after a unit number: "221-222 A", "233 A & B".
// Dropping it merged V-COR-4-221/222A and V-COR-3-221/222B into one label.
// The trailing \b is what stops it swallowing the first letter of an ordinary
// following word ("No. 201 Sea View").
const LEPTOS_NUM_TAIL = String.raw`(?:\s+[A-Z](?:\s*&\s*[A-Z])?)?\b`;
// An explicit "No." is the feed saying "what follows is the unit number", so
// it is taken at its word — "Coral Seas Villa No. A-B" has no digit in it and
// is still a unit number.
const LEPTOS_NO_RE = new RegExp(String.raw`\bNo\.?\s*([A-Za-z0-9][\w./-]*${LEPTOS_NUM_TAIL})`, "i");
// Without a "No.", the token after the designation must contain a DIGIT near
// its start. That requirement is the whole point: "Mandria Gardens Apartment
// Parcel" was otherwise read as unit number "Parcel" and rendered "Nr. Parcel".
const LEPTOS_DESIG_NUM_RE = new RegExp(
  String.raw`\b(?:${LEPTOS_LABEL_DESIG})\s+([A-Za-z]{0,2}\d[\w./-]*${LEPTOS_NUM_TAIL})`, "i");
// The same words as single tokens, plus the ones that only ever qualify a
// designation. "Grand" is here because the multi-word "Grand Mansion" cannot
// match a word-by-word scan: without it, "Adonis Beach Villas Grand Mansion
// No. M1" hands back "Grand" as a building name.
const LEPTOS_DESIG_WORD_RE =
  new RegExp(String.raw`^(?:${LEPTOS_LABEL_DESIG}|Grand|Block|Blk|No\.?)$`, "i");

// The building name is whatever the heading puts BETWEEN the project name and
// the unit designation: "Limassol Park Mimoza Penthouse No. 403" -> "Mimoza".
// This is the disambiguator Limassol Park uses, and it is why looking only for
// a literal "Block <x>" token left 35 of its units sharing eleven labels.
//
// The project name is matched WORD BY WORD, not as a string prefix, because the
// heading does not spell it the same way: project "Coral Bay Villas" against
// heading "Coral Bay Villa 230A". A string-prefix test fails there, leaves the
// whole heading standing, and hands back "Coral Bay" as the building name — the
// project's own name, printed on every unit.
function leptosBuilding(h2: string, projectName: string): string {
  // Split on commas too: the feed writes "Koili Hills,Villa B" with no space,
  // and a whitespace-only split makes "Hills,Villa" one unmatchable token.
  const words = (s: string) => String(s || "").split(/[\s,]+/).filter(Boolean);
  const norm = (w: string) => w.toLowerCase().replace(/[.,]+$/, "");
  const hw = words(h2), nw = words(projectName);
  let k = 0;
  while (k < hw.length && k < nw.length && norm(hw[k]) === norm(nw[k])) k++;
  const out: string[] = [];
  // Stop at the unit designation, at a "Block"/"No." token, at a dash, or at
  // anything carrying a digit — past that point the heading describes the
  // unit. The dash is what a heading uses to open a descriptive clause rather
  // than name a building: "Kamares Village – Two-Villa Package Ambelia No.
  // 6A/6B" is a sales note, not a building called "– Two-Villa Package".
  for (const w of hw.slice(k)) {
    if (LEPTOS_DESIG_WORD_RE.test(norm(w)) || /^[–—-]+$/.test(w) || /\d/.test(w)) break;
    out.push(w);
  }
  return out.join(" ").replace(/[–\-/&\s]+$/, "").trim();
}

// The ref's block segment — the one after the project code, and only when a
// further segment follows it. In "AP-MAND-10" that "10" is the last segment
// and would be indistinguishable from a unit number ("A-XYZ-77" -> Nr. 77).
function leptosRefBlock(ref: string): string {
  const seg = leptosSegments(ref);
  // +1 for the two-segment "LBM-CT" code, whose block would otherwise be read
  // as the tower marker itself.
  const i = leptosCodeIndex(seg) + (leptosCode(ref).includes("-") ? 1 : 0);
  return seg.length > i + 2 ? seg[i + 1] : "";
}

function leptosUnitLabel(r: LeptosRow, projectName: string, useRefBlock = false): string {
  const block = r.h2.match(/\bBlock\s+([A-Za-z0-9''-]+)/i)?.[1] ?? "";
  const building = block ? "" : leptosBuilding(r.h2, projectName);
  const num = r.h2.match(LEPTOS_NO_RE)?.[1] ?? r.h2.match(LEPTOS_DESIG_NUM_RE)?.[1] ?? "";
  // "…Apartment Parcel" is the feed's word for a unit carrying no number of its
  // own. It is a designation, not a number, so it neither gets a "Nr." nor
  // falls through to the ref — "Nr. Parcel" and "Nr. PRC" are both wrong.
  const parcel = !num && /\bParcels?\b/i.test(r.h2);
  const shown = num || (parcel ? "" : r.ref.split("-").pop() ?? "");
  const unit = parcel ? "Parcel" : shown ? `Nr. ${shown.replace(/\s+/g, " ").trim()}` : "";
  const qualifier =
    block ? `Block ${block}` :
    building ? building :
    useRefBlock && leptosRefBlock(r.ref) ? `Block ${leptosRefBlock(r.ref)}` : "";
  return joinLoc(qualifier, unit);
}

// UnitVM.label is what the public units table and the admin unit list render,
// so two units of ONE project carrying the same label is a defect only the
// operator can clear, by hand, forever. Measured on the live feed 2026-08-30:
// 45 units across 4 projects did (Limassol Park alone had "Nr. 402" four
// times). Both sources held the answer and both were being discarded.
//
// The ref's block is a SECOND pass, applied to a whole project at once and
// only when the headings leave a collision, because the segment after the code
// is not always a block: Coral Bay puts a bedroom count there
// (V-COR-4-190 is a 4-bed, not block 4), and "Block 4 · Nr. 190" would be an
// invented fact printed on a page a buyer reads. Applying it to the whole
// project rather than only the colliding rows keeps one project's unit list
// from being half one shape and half another.
function leptosUnitLabels(g: LeptosGroup): string[] {
  const unique = (ls: string[]) => new Set(ls).size === ls.length;
  let labels = g.rows.map((r) => leptosUnitLabel(r, g.name));
  if (!unique(labels)) labels = g.rows.map((r) => leptosUnitLabel(r, g.name, true));
  if (!unique(labels)) {
    // Neither source separates them. The ref is unique by construction, so it
    // is the honest last resort — an ugly label beats two identical ones, and
    // leptos-live-check.mjs asserts the outcome rather than trusting it.
    const seen = new Map<string, number>();
    for (const l of labels) seen.set(l, (seen.get(l) ?? 0) + 1);
    labels = labels.map((l, i) => (seen.get(l)! > 1 ? joinLoc(l, g.rows[i].ref) : l));
  }
  return labels.map((l, i) => l || g.rows[i].ref);
}

// ProjectVM.amenities is the raw union of the units' <features>, and Leptos
// files its own loyalty programme in there. Left alone, "Leptos Lifestyle
// Membership" (on 318 of 377 units, measured 2026-08-30) lands in the amenity
// list of nearly all 45 projects — the developer's brand advertised on OUR
// pages, under a heading the reader takes to mean "what this development has".
//
// Note what does NOT do this job: anonymize(descBody, g.name, g.name) below is
// a guaranteed no-op — it returns early when dev === alias, and both arguments
// are g.name. It never touched amenities in any case; it rewrites description
// prose. The list is therefore the only thing standing between the vendor's
// marketing and the public page, which is why it is explicit rather than
// pattern-matched: every string here was read on the live feed and decided on,
// and a genuine amenity ("Restaurant & Bistro", "Spa Facilities", "Concierge
// Services") stays.
const LEPTOS_AMENITY_EXCLUDE = new Set([
  // Vendor branding: a Leptos programme or product line, not a facility.
  "leptos lifestyle membership",   // 318 units / 45 projects
  "signature collection",          //  52 units /  1 project
  "first boutique",                //   4 units /  2 projects
  "exclusive members bistro",      //   4 units /  2 projects
  // Not amenities: a claim about the neighbourhood and a claim about the
  // architect. Neither is a thing the building has.
  "safe & friendly area",          // 258 units / 43 projects
  "award-winning architecture",    //  65 units /  5 projects
]);
// Kept as an amenity, minus the vendor's internal caveat. "(where applies)" is
// a note to their sales staff about which units have it; on a public amenity
// list it reads as a disclaimer on the whole development.
const LEPTOS_AMENITY_REWRITE: Record<string, string> = {
  "underfloor heating (where applies)": "Underfloor Heating",
};
function leptosAmenities(rows: LeptosRow[]): string[] {
  const out = new Set<string>();
  for (const f of rows.flatMap((r) => r.features)) {
    const key = f.trim().toLowerCase();
    if (!key || LEPTOS_AMENITY_EXCLUDE.has(key)) continue;
    out.add(LEPTOS_AMENITY_REWRITE[key] ?? f.trim());
  }
  return Array.from(out).sort();
}

export function leptosVm(g: LeptosGroup): ProjectVM {
  const first = g.rows[0];
  const labels = leptosUnitLabels(g);
  const units: UnitVM[] = g.rows.map((r, i) => ({
    ref: r.ref, name: labels[i], label: labels[i],
    type: r.type, status: "available", statusLabel: "Available",
    price: r.price > 0 ? r.price : null, currency: "EUR",
    beds: r.beds !== "0" ? r.beds : "", baths: r.baths !== "0" ? r.baths : "",
    // covered_area -> areaBuilt. UnitVM has no areaInternal field, and
    // feedSync only maps areaBuilt/areaPlot/areaVeranda onto DevelopmentUnit.
    areaBuilt: areaM2(r.covered), areaPlot: areaM2(r.plot), areaVeranda: "",
    floor: "", attrs: [], features: r.features,
    photos: sizedImages(r.images), plans: sizedImages(r.plans),
    coords: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
    description: "",
  }));

  const center = units.find((u) => u.coords)?.coords ?? null;
  const district =
    districtFor(center) || districtFromText(first.town) || districtFromText(first.province) || first.province;
  const town = first.town;
  const area = town && town.toLowerCase() !== district.toLowerCase() ? town : "";

  const amenities = leptosAmenities(g.rows);
  const extraFacts: { label: string; value: string }[] = [];
  for (const b of g.rows.flatMap((r) => r.benefits)) {
    const f = leptosBenefit(b);
    if (f && !extraFacts.some((x) => x.label === f.label)) extraFacts.push(f);
  }

  // AVAILABLE units with a real price only. Development.priceFrom/priceTo are
  // treated as authoritative by resolveDevelopmentPrice(), so a zero-priced
  // unit here would advertise "from €0". 4 in-scope units carry price 0.
  const prices = units.map((u) => u.price).filter((n): n is number => n != null && n > 0).sort((a, b) => a - b);

  const descBody = tidyDesc(first.body);
  return {
    id: g.key, dev: "leptos", publicName: g.name, developerName: g.name, developer: "Leptos Estates",
    area, district, town: "", location: joinLoc(district, area),
    status: "Available", category: "Residential", stage: "", completion: "", energy: "",
    description: anonymize(descBody, g.name, g.name),
    gallery: sizedImages(Array.from(new Set(g.rows.flatMap((r) => r.images)))),
    plans: sizedImages(Array.from(new Set(g.rows.flatMap((r) => r.plans)))),
    renders: [], amenities, extraFacts, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: "EUR",
  };
}
```

- [ ] **Step 4: Run the test and make sure it passes**

Run: `node scripts/qa/leptos-grouping-check.mjs`
Expected: 97 `ok` lines, `all checks passed`, exit 0.

Note: `leptosRow` is exported (Task 5) purely so the test can reach it. It is
the ONLY place the `-scaled` image upgrade is applied, so a hand-built
`LeptosRow` fixture — which is what `row()` produces — cannot exercise it;
assert the upgrade against `leptosRow` instead.

If `UnitVM` rejects a field, read its definition in `feeds.ts` and match it exactly — do not add fields to the type.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/leptos-grouping-check.mjs
git commit -m "Leptos: build the project view model — units, amenities, travel times"
```

---

## Task 7: Register the developer

**Files:**
- Modify: `src/app/preview-project/feeds.ts` (the `DEVELOPERS` map, `listProjectIds`, `getPreviewProject`)

- [ ] **Step 1: Add the registry entry**

In `feeds.ts`, in the `DEVELOPERS` map, after the `squareone` line:

```ts
  leptos: { label: "Leptos Estates", default: "BAG" },
```

- [ ] **Step 2: Add the id lister**

In `listProjectIds`, immediately before the closing `return [];`:

```ts
  if (dev === "leptos") {
    try { return uniq((await leptosGroups()).map((g) => g.key)); }
    catch { return []; }
  }
```

The `try/catch` matches the `medousa` branch above it: a failed fetch must not throw out of `syncAll`, which would skip every later developer's log row, `statusOnlySync`, the unit notifications and the purges.

- [ ] **Step 3: Add the project resolver**

In `getPreviewProject`, immediately before the `if (dev === "island-blue")` line:

```ts
  if (dev === "leptos") {
    const g = (await leptosGroups()).find((x) => x.key === target);
    return g ? leptosVm(g) : null;
  }
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts
git commit -m "Leptos: register the developer on the id-driven feed path"
```

---

## Task 8: Connect the sync

**Files:**
- Modify: `src/lib/feedSync.ts:20-42` (`DEV_ACCOUNT`), `src/lib/feedSync.ts:180` (`SYNCED_DEVS`)

- [ ] **Step 1: Confirm no Leptos account exists yet**

```bash
node --env-file=.env.local -e "
const { PrismaClient } = require('@prisma/client');
new PrismaClient().developerAccount.findMany({ select: { slug: true, name: true } })
  .then(a => console.log(a.filter(x => /leptos/i.test(x.slug + x.name))));
"
```

Expected: `[]` — verified on 2026-08-30, there is no Leptos account.

`ensureAccount()` upserts by the slug in `DEV_ACCOUNT`, creating the row when it
is absent, so the first sync creates exactly one correct account. **If the array
is NOT empty**, an account was created in the meantime: use its exact slug in
Step 2 instead of `leptos-xml`, or the sync creates a second, empty one beside
it. That is the Medousa mistake, and it only bites when an account already
exists under a different slug than the code expects.

- [ ] **Step 2: Add the account mapping**

In `src/lib/feedSync.ts`, in `DEV_ACCOUNT`, after the `mito` entry, using the slug printed in Step 1:

```ts
  // slug "leptos-xml", not "leptos" — the same trap as medousa and mito above.
  // ensureAccount() upserts by this exact slug; without the entry it falls back
  // to { slug: dev, name: dev } and attaches all 45 projects to a second, empty
  // account instead of the one the operator configured.
  leptos: { slug: "leptos-xml", name: "Leptos Estates (XML)" },
```

- [ ] **Step 3: Enable the sync**

In `src/lib/feedSync.ts`, add `"leptos"` to the end of `SYNCED_DEVS`:

```ts
export const SYNCED_DEVS = ["island-blue", "inex", "bbf", "aristo", "pafilia", "domenica", "medousa", "squareone", "leptos"];
```

No completeness-guard override is needed. `FEED_INCOMPLETE_PCT = 0.15` against 377 units blocks a feed that lost more than 56 units, and the `FEED_INCOMPLETE_ABS_FLOOR = 20` floor binds only below 133 units. Mito needed a custom floor of 3 because its 16-unit catalogue made `missing > 20` unsatisfiable — a guard that could never fire. At 377 units the shared thresholds do the work; adding an override would be cargo cult.

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedSync.ts
git commit -m "Leptos: enable the nightly sync"
```

---

## Task 9: Verify against the live feed

**Files:**
- Create: `scripts/qa/leptos-live-check.mjs`

- [ ] **Step 1: Write the live check**

Create `scripts/qa/leptos-live-check.mjs`:

```js
#!/usr/bin/env node
/* Runs the Verification list from
   docs/superpowers/specs/2026-08-30-leptos-feed-adapter-design.md against the
   LIVE Leptos feed. Separate from leptos-grouping-check.mjs on purpose: that
   one is synthetic and must never fail because a vendor edited a listing.

     node scripts/qa/leptos-live-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed."); process.exit(2); }

const bundlePath = join(tmpdir(), `leptos-live-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const F = await import(bundlePath);

let failures = 0;
const check = (name, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
};

const groups = await F.leptosGroups();
const units = groups.reduce((n, g) => n + g.rows.length, 0);
console.log(`\n${groups.length} projects, ${units} units\n`);

check("45 projects", groups.length === 45, `got ${groups.length}`);
check("377 units", units === 377, `got ${units}`);
check("Cavalli Tower is separate", groups.some((g) => g.key === "LBM-CT" && g.name === "Cavalli Tower"));
check("Poseidon Tower is separate", groups.some((g) => g.key === "LBM" && g.name === "Poseidon Tower"));
check("Kamares Village is one project",
  groups.filter((g) => /^Kamares/i.test(g.name)).length === 1,
  groups.filter((g) => /^Kamares/i.test(g.name)).map((g) => g.name).join(", "));
check("no Greek property survived",
  groups.every((g) => g.rows.every((r) => r.country === "Cyprus")));
check("no land parcel survived",
  groups.every((g) => g.rows.every((r) => r.type !== "Plots & Land Parcels")));
check("every project has a non-empty name", groups.every((g) => g.name && g.name.length >= 3),
  groups.filter((g) => !g.name || g.name.length < 3).map((g) => g.key).join(", "));

// Geography: the independent signal that the code key is right.
const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
let worst = 0, worstKey = "";
for (const g of groups) {
  const pts = g.rows.filter((r) => r.lat != null && r.lng != null);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const m = dist(pts[i], pts[j]);
      if (m > worst) { worst = m; worstKey = g.key; }
    }
}
check(`units within 200 m of each other (worst ${Math.round(worst)} m in ${worstKey})`, worst <= 200);

// Prices: a zero-priced unit must never become the headline.
for (const g of groups) {
  const vm = F.leptosVm(g);
  if (vm.priceFrom != null && vm.priceFrom <= 0) check(`${g.key} priceFrom > 0`, false, `got ${vm.priceFrom}`);
}
check("no project advertises a zero price", true);

// Images: every -scaled original must actually exist, since there is no
// runtime fallback. This is the check that earns that decision.
const scaled = [];
for (const g of groups) for (const r of g.rows) for (const u of [...r.images, ...r.plans])
  if (/\d+\.(jpg|png)$/i.test(u)) scaled.push(u);
const sample = Array.from(new Set(scaled)).slice(0, 60);
let missing = 0;
for (const u of sample) {
  const res = await fetch(u, { method: "HEAD" }).catch(() => null);
  if (!res || !res.ok) { missing++; console.log(`       missing: ${u}`); }
}
check(`${sample.length} sampled image URLs all resolve`, missing === 0, `${missing} missing`);

console.log(`\n${failures ? `${failures} failed` : "all live checks passed"}`);
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `node scripts/qa/leptos-live-check.mjs`
Expected: all `ok`, exit 0.

If the project or unit count differs from 45 / 377, **do not adjust the expected number to match**. The counts were measured on 2026-08-30; a difference means either Leptos changed their catalogue (check the feed) or the grouping is wrong (check which project is missing or extra by diffing `groups.map(g => g.key)` against the spec's exception table).

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: exit 0. Requires the DB tunnel on port 5433 to be open.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa/leptos-live-check.mjs
git commit -m "Leptos: live verification against the spec's checklist"
```

---

## Task 10: First sync and handover

- [ ] **Step 1: Merge and deploy**

Follow the repo's normal flow: merge the branch to `main`, push with `git push origin HEAD`, deploy with `./scripts/deploy-prod.sh --yes`.

- [ ] **Step 2: Run the first sync from the admin**

Trigger the Leptos sync. Expected: 45 projects created, 377 units, `blocked: false`.

- [ ] **Step 3: Verify no duplicate account was created**

```bash
node --env-file=.env.local -e "
const { PrismaClient } = require('@prisma/client');
new PrismaClient().developerAccount.findMany({
  where: { OR: [{ slug: { contains: 'leptos' } }, { name: { contains: 'Leptos' } }] },
  select: { slug: true, name: true, _count: { select: { developments: true } } },
}).then(a => console.log(a));
"
```

Expected: **exactly one** row, holding 45 developments. Two rows means `DEV_ACCOUNT.leptos` has the wrong slug — fix it, move the developments, delete the empty account.

- [ ] **Step 4: Run the sync a second time and confirm identity is stable**

Trigger the sync again. Expected: `created: 0`, `updated: 45`. Any non-zero `created` means a project was re-keyed — investigate before publishing anything.

- [ ] **Step 5: Spot-check two mirrored images**

Pick any Leptos project in the admin, open its gallery, and confirm at least one image is over 4000 px wide. If everything is 1920 px, `leptosFullSize` is not being applied before mirroring.

- [ ] **Step 6: Confirm unitRef normalisation is inert**

The spec states that Leptos refs are globally unique (`V-KAM-3-434B`), so the
block-qualification rules `unitRef.ts` needed for Arbeo Park should not fire
here — but states it as something to confirm, not assume. Count how many Leptos
refs change key:

```bash
node --env-file=.env.local -e "
const { PrismaClient } = require('@prisma/client');
const { unitRefKey } = require('./src/lib/unitRef.ts');
new PrismaClient().developmentUnit.findMany({
  where: { development: { dev: 'leptos' } }, select: { ref: true },
}).then(us => {
  const changed = us.filter(u => u.ref && unitRefKey(u.ref) !== u.ref.trim().toLowerCase());
  console.log(\`\${changed.length} of \${us.length} refs normalise to a different key\`);
  console.log(changed.slice(0, 10).map(u => u.ref));
});
"
```

If the import path or export name does not resolve, read `src/lib/unitRef.ts`
and use its actual exported function. Expected: a small number or zero, and no
two Leptos refs collapsing onto the same key. A collision would silently merge
two units on the next status sync — investigate before publishing.

- [ ] **Step 7: Hand over the open question**

Tell the operator: the feed publishes 47 units for Bel Air Gardens, but the development is larger. How complete Leptos's selection is has **not** been established, and this is exactly what forced the Mito sync to be switched off (16 of 39 for-sale units). Recommend checking one Leptos price list against one project before publishing any of them.
