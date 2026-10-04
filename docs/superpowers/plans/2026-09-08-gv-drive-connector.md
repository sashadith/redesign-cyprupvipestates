# G&V Drive Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync G&V Developers' five Drive project folders into Developments and units, reading one PDF price list per folder whose sold/reserved status is printed inside the price column.

**Architecture:** No new connector and no new cron route. G&V becomes a `DeveloperAccount` on the existing `driveAvailabilitySync` path. Two things are added: the per-project folder scan learns to accept a named PDF for developers configured for textual-status reading, and a thin adapter turns `availabilityTable`'s table output into the `ExtractedPricelistProject` shape the Drive sync already consumes. Most of the work is in the table engine, which today cannot read G&V's layouts at all.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma/PostgreSQL, `pdfjs-dist` (via a spawned worker), esbuild for the QA harness, Node 20.

**Spec:** `docs/superpowers/specs/2026-09-08-gv-drive-connector-design.md`

## Global Constraints

- **Never deploy.** Commit and merge freely; deploying to production is the operator's call. Say it is ready and wait.
- **The working tree is shared with other Claude sessions.** Never `git add -A`, never switch branches in `/Users/sashadith/cvp-analysis`. Commit from an isolated worktree created off `origin/main`, and push with `git push origin HEAD:main`.
- **`.env.local` points at the LIVE production database** (tunnel on `localhost:5433`). Every local Prisma query is a production query. No writes outside Task 11, and that one is additive.
- **Admin/internal-facing copy is English** (project convention, `CLAUDE.md`). Client-facing copy is localized.
- `availabilityTable.ts` is load-bearing for **two live developers**: Korantina (18 projects, via `sharepointAvailabilitySync.ts`) and AGG (12, via `ai/aggPricelist.ts`). Every engine change must leave `scripts/qa/availability-table-check.mjs` green.
- The regression suite runs with `node scripts/qa/availability-table-check.mjs` and exits non-zero on the first failed assertion.
- `parsePrice` refuses ambiguous forms on purpose. New forms are recognised by explicit shape; anything still ambiguous returns `null`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/qa/availability-table-check.mjs` | Existing, uncommitted, ~47 assertions, green. Becomes the regression baseline, then grows a G&V section. |
| `scripts/qa/fixtures/gv/*.json` (create) | Real pdf.js page data extracted once from G&V's five price lists. Ground truth for the engine tests, checked in as JSON so the tests need no PDFs and no pdfjs. |
| `src/lib/ai/availabilityTable.ts` (modify) | The table engine. Five measured defects to fix. |
| `src/lib/ai/pdfTablePricelist.ts` (create) | The seam: PDF buffer → `ExtractedPricelistProject`. Holds no table logic. |
| `src/lib/googleDrive.ts` (modify, line 212) | `listProjectFolders` hardcodes `spreadsheetsOnly: true`; make it a parameter. |
| `src/lib/driveAvailabilitySync.ts` (modify) | Route G&V's project folders through the new adapter; exclude the two operator-named folders. |
| `scripts/setup-gv-account.mjs` (create) | One-off: create the `DeveloperAccount` row. |

---

## Task 1: Land the regression net

`scripts/qa/availability-table-check.mjs` already exists in the working tree with ~47 assertions and passes in full, but is untracked. Nothing else in this plan is safe until it is committed: it is the only evidence that Korantina and AGG still read correctly after each engine change.

**Files:**
- Commit unchanged: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the baseline command `node scripts/qa/availability-table-check.mjs`.

- [ ] **Step 1: Confirm it is green before committing**

```bash
cd /Users/sashadith/cvp-analysis
node scripts/qa/availability-table-check.mjs | tail -3
```

Expected: `all checks passed`. If it is red, STOP and report — a red baseline cannot serve as a net, and the file belongs to another session's unfinished work.

- [ ] **Step 2: Commit it unchanged from a worktree**

```bash
cd /Users/sashadith/cvp-analysis
git fetch origin --quiet
git worktree add -b gv-net /tmp/wt-gv-net origin/main -q
cp scripts/qa/availability-table-check.mjs /tmp/wt-gv-net/scripts/qa/
cd /tmp/wt-gv-net
git add scripts/qa/availability-table-check.mjs
git commit -m "Commit the availability-table regression suite

It has been passing in the working tree unversioned. availabilityTable
carries Korantina and AGG in production, and the G&V work changes its
geometry, so the suite has to be in the repo before that starts."
git merge --ff-only origin/main -q && git push origin HEAD:main
```

- [ ] **Step 3: Clean up the worktree**

```bash
cd /Users/sashadith/cvp-analysis
git worktree remove /tmp/wt-gv-net --force
git branch -D gv-net
```

---

## Task 2: Check in the G&V fixtures as page data

The existing suite feeds **synthetic** pdf.js page data into `tablesFromPages()`. G&V's fixtures should be **real** data captured once, so the tests assert against what the developer actually ships — but stored as JSON, so the tests still need no PDF and no pdfjs.

The PDFs themselves are **not** in the repo and must not be committed — only the
extracted JSON is. Download the five from Drive first (any account with access to
the shared folder; the app's own `GOOGLE_REFRESH_TOKEN` credentials live on the
production server, not locally):

| Save as | Drive file id | Title |
| --- | --- | --- |
| `altamare.pdf` | `1_MsoqZQehlzIlpZ7FEv8bzBcbl8DkIXv` | Alta Mare (Phase I) Price List.pdf |
| `g12.pdf` | `1xUqQmH3WryUFUz-65dsUUFhwWd3VQ8T-` | PRICE LIST.pdf (Georgia 12) |
| `gr2.pdf` | `1IOo5F2DCdY4rkO-HuYxEcfyxqwmtfG6K` | Price List GR2.pdf |
| `sv.pdf` | `1KT-QZA9vvKGbpsFuzeW-ffyxl2dmNx1U` | price list superior villa.pdf |
| `tsada-d.pdf` | `1oXEVAbEXUm88Crccs38gEVhQnetdG0HZ` | Price List (Tsada Phase D) |

Put them in `scripts/qa/fixtures/gv/`. Step 1 converts them and deletes them.

**Files:**
- Create: `scripts/qa/fixtures/gv/altamare.json`, `g12.json`, `gr2.json`, `sv.json`, `tsada-d.json`
- Modify: `scripts/qa/availability-table-check.mjs`
- Delete after generating: the `.pdf` files (do not check in binaries)

**Interfaces:**
- Consumes: `readPdfPages` output shape `PdfPage[] = { page, width, height, rows: { y, cells: { x, w, t }[] }[] }`.
- Produces: `loadGv(name)` in the QA script, returning `PdfPage[]`.

- [ ] **Step 1: Generate the JSON fixtures from the real PDFs**

```bash
cd /Users/sashadith/cvp-analysis
for f in altamare g12 gr2 sv tsada-d; do
  node scripts/pdf-table-extract-worker.mjs "scripts/qa/fixtures/gv/$f.pdf" > "scripts/qa/fixtures/gv/$f.json"
  echo "$f: $(node -e "console.log(require('./scripts/qa/fixtures/gv/$f.json').length + ' pages')")"
done
rm scripts/qa/fixtures/gv/*.pdf
```

- [ ] **Step 2: Add the loader and a ground-truth assertion per fixture**

Append to `scripts/qa/availability-table-check.mjs`, before the final summary:

```js
import { readFileSync } from "node:fs";
const loadGv = (name) => JSON.parse(readFileSync(`scripts/qa/fixtures/gv/${name}.json`, "utf8"));

/* G&V Developers (2026-09-08). Real page data captured from the developer's own
   price lists, not synthesised — these five layouts are the reason the engine
   changes below exist. Asserting the RAW row counts first pins the fixtures
   themselves: if a later change to the worker alters what pdf.js hands over,
   this fails before any table assertion does, and the cause is unambiguous. */
console.log("\nG&V fixtures carry the page data they were captured with");
for (const [name, pages, firstPageRows] of [
  ["altamare", 2, 24], ["g12", 1, 15], ["gr2", 2, 5], ["sv", 1, 6],
  // tsada-d was read from the operator's screenshot, not from the extractor —
  // fill these two numbers in from the generated fixture on first run rather
  // than trusting this line.
]) {
  const f = loadGv(name);
  check(`${name}: page count`, f.length, pages);
  check(`${name}: rows on page 1`, f[0].rows.length, firstPageRows);
}
```

- [ ] **Step 3: Run the suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -12
```

Expected: PASS, including the new fixture assertions. If a row count differs, re-read the fixture rather than editing the expectation — the numbers above were measured on 2026-09-08.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa/fixtures/gv scripts/qa/availability-table-check.mjs
git commit -m "Add G&V price lists as captured page fixtures

Real pdf.js output from the developer's five lists, stored as JSON so the
tests need neither the PDFs nor pdfjs. The raw row counts are asserted
first so a change in the worker fails here, not inside a table assertion."
```

---

## Task 3: `parsePrice` accepts G&V's price forms

Measured: `parsePrice("580,000.00")` → `null`, `parsePrice("290,000.00")` → `null`, `parsePrice("1.95M")` → `null`. Only the rare bare `415,000` works, so nearly every G&V price is lost.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`parsePrice`, around line 88)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `parsePrice(raw: string): number | null` — unchanged signature, wider accepted set.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nG&V price forms: grouped with cents, and the M shorthand");
check("580,000.00", parsePrice("580,000.00"), 580000);
check("€ 580,000.00", parsePrice("€ 580,000.00"), 580000);
check("290,000.00", parsePrice("290,000.00"), 290000);
check("1.95M", parsePrice("1.95M"), 1950000);
check("€1.95M", parsePrice("€1.95M"), 1950000);
check("2M", parsePrice("2M"), 2000000);
// Korantina's forms must keep working, unchanged.
check("still reads 1.800.000", parsePrice("1.800.000"), 1800000);
check("still reads 995,000", parsePrice("995,000"), 995000);
check("still reads 1 250 000", parsePrice("1 250 000"), 1250000);
// Ambiguity stays refused: one group of three after a single separator could be
// thousands OR a decimal, and no shape distinguishes them.
check("still refuses 1.234", parsePrice("1.234"), null);
check("still refuses prose", parsePrice("on request"), null);
check("still refuses empty", parsePrice(""), null);
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A2 "G&V price forms"
```

Expected: FAIL on `580,000.00` (`erwartet 580000, war null`).

- [ ] **Step 3: Widen `parsePrice`**

Insert both branches into `parsePrice`, after the existing grouped-form branch and before the bare-digits branch:

```ts
  // Grouped with cents: 580,000.00 / 1.234.567,89 — the LAST separator is followed
  // by exactly two digits and every earlier group by exactly three, so the roles of
  // the two separators are fixed by shape, not guessed. G&V writes every price this
  // way; Korantina never does, so nothing existing changes.
  const cents = s.match(/^(\d{1,3}(?:([.,\s])\d{3})+)([.,])(\d{2})$/);
  if (cents) {
    const n = Number(cents[1].replace(/[.,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  // Millions shorthand: 1.95M / 2M / €1.95M (Tsada Superior Villa). Only ever a
  // multiplier here — "M" after a number has no other reading in a price list.
  const millions = s.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
  if (millions) {
    const n = Math.round(Number(millions[1].replace(",", ".")) * 1_000_000);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
```

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -6
```

Expected: `all checks passed` — the new block AND all ~47 Korantina/AGG assertions.

- [ ] **Step 5: Mutation-test the new assertions**

Temporarily change `\d{2}` to `\d+` in the cents regex and re-run: the `1.234` refusal must now fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "parsePrice: read grouped amounts with cents, and the M shorthand

G&V writes 580,000.00 and 1.95M; both returned null, so nearly every G&V
price was lost. Both new forms are matched by explicit shape, so 1.234
stays refused, and Korantina's own forms are untouched."
```

---

## Task 4: `readOutcome` recognises `SHOW HOUSE`

Measured: `readOutcome("SHOW HOUSE")` → `null` (unresolved). Alta Mare unit 7 is a show house. Per the spec it maps to `reserved`: the unit exists but cannot be bought.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`RESERVED_RE` / `readOutcome`, around line 110)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: `UnitStatus = "available" | "reserved" | "sold"`.
- Produces: `readOutcome` unchanged signature.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nG&V outcome vocabulary");
check("SHOW HOUSE is reserved", readOutcome("SHOW HOUSE"), { status: "reserved", price: null });
check("show house, lower case", readOutcome("show house"), { status: "reserved", price: null });
check("SHOWHOUSE, no space", readOutcome("SHOWHOUSE"), { status: "reserved", price: null });
check("SOLD still sold", readOutcome("SOLD"), { status: "sold", price: null });
check("RESERVED still reserved", readOutcome("RESERVED"), { status: "reserved", price: null });
check("a price is available", readOutcome("€ 450,000.00"), { status: "available", price: 450000 });
// A blank or unknown cell must stay UNRESOLVED — never silently "available".
check("blank stays unresolved", readOutcome("   "), null);
check("prose stays unresolved", readOutcome("ask us"), null);
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A3 "G&V outcome"
```

Expected: FAIL on `SHOW HOUSE is reserved` (`war null`).

- [ ] **Step 3: Extend the reserved vocabulary**

Find `RESERVED_RE` and add the show-house alternative, with the reason:

```ts
// "SHOW HOUSE" (G&V, 2026-09-08) sits in the price column exactly where RESERVED
// does and means the same thing for a buyer: the unit exists and is not for sale.
// Mapped to reserved rather than sold so it returns to the market by itself if
// the developer ever prices it.
const RESERVED_RE = /^\s*(reserved|under\s*offer|show\s*house)\s*$/i;
```

Read the existing `RESERVED_RE` first and keep every alternative it already has — the line above shows the shape, not a replacement for terms already present.

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -6
```

Expected: `all checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "readOutcome: SHOW HOUSE reads as reserved

G&V prints it in the price column where RESERVED goes. It was unresolved,
which correctly refused to guess but left the unit unimportable."
```

---

## Task 5: A priced first row must not be absorbed into the header

Measured: Alta Mare yields **3 of 8 units**. Its five priced rows vanish, and the header comes back as `"Price € 580,000.00"` — the header band swallowed row 1, and the rows that survived are exactly the three whose price cell reads `RESERVED`.

The cause is that `€` and `580,000.00` are drawn as two text items, so row 1's price column spans two cells and the band-joining logic treats it as header continuation.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`tablesFromPages`, header band detection, around lines 160–280)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: `loadGv` from Task 2, `tablesFromPages(pages): PdfTableResult`.
- Produces: `tablesFromPages` unchanged signature.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nAlta Mare: every unit survives, header stops at the header");
{
  const { tables } = tablesFromPages(loadGv("altamare"));
  check("one table", tables.length, 1);
  const t = tables[0];
  check("all 8 units", t.rows.length, 8);
  check("row 1 is unit 1", t.rows[0][0], "1");
  check("header has no price in it", /580,000/.test(t.headers.join(" ")), false);
  check("header still names the price column", /price/i.test(t.headers.join(" ")), true);
  const refs = t.rows.map((r) => r[0]);
  check("refs 1..8 in order", refs, ["1", "2", "3", "4", "5", "6", "7", "8"]);
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A6 "Alta Mare: every unit"
```

Expected: FAIL — `all 8 units` reports 3, and `header has no price in it` reports true.

- [ ] **Step 3: Stop the band at the first row that looks like data**

Read the header-band logic in `tablesFromPages` before changing it. The fix is to close the band as soon as a row's **first** cell parses as a unit reference (a bare integer or an alphanumeric code) while the header row above it did not, rather than continuing to absorb rows whose cell count differs from the header's.

Add a short helper next to the band logic:

```ts
/* A header band must not swallow the first DATA row. Alta Mare (2026-09-08)
   draws "€" and "580,000.00" as two text items, so row 1 has one more cell
   than the header — which read as "the header continues here" and cost five
   of eight units. A row whose first cell is a bare unit number while the
   band's first cell is prose is data, whatever its cell count. */
const looksLikeUnitRef = (s: string) => /^[A-Za-z]?\d{1,4}[A-Za-z]?$/.test(deGreek((s || "").trim()));
```

Use it to terminate the band. Do not change how cells within a row are grouped — Task 7 depends on that behaviour being unchanged.

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -8
```

Expected: `all checks passed` — Alta Mare's 8 units AND every Korantina/AGG assertion. If a Korantina assertion breaks, the band change was too broad: narrow it to the "first cell is a unit ref" condition rather than relaxing the cell-count rule generally.

- [ ] **Step 5: Mutation-test**

Revert only the band change, re-run, confirm `all 8 units` fails again. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "Keep the header band out of the first data row

A price drawn as two text items gave row 1 one more cell than the header,
which read as header continuation. Alta Mare lost five of its eight units
that way, and the header came back as 'Price € 580,000.00'."
```

---

## Task 6: Read single-row tables and tables with no `No.` column

Measured: Georgia 12 and Superior Villa both yield **0 tables**. Superior Villa is one villa with no numbering column at all; Georgia 12 has a header split across five y bands.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`tablesFromPages`, minimum-rows and header reconstruction)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: `loadGv`, `tablesFromPages`.
- Produces: unchanged signatures.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nGeorgia 12: a header spread over five bands still yields nine units");
{
  const { tables } = tablesFromPages(loadGv("g12"));
  check("one table", tables.length, 1);
  check("nine units", tables[0].rows.length, 9);
  check("first ref", tables[0].rows[0][0], "101");
  check("last ref", tables[0].rows[8][0], "303");
  check("header mentions bedrooms", /bedrooms/i.test(tables[0].headers.join(" ")), true);
}

console.log("\nSuperior Villa: a one-row table is still a table");
{
  const { tables } = tablesFromPages(loadGv("sv"));
  check("one table", tables.length, 1);
  check("one unit", tables[0].rows.length, 1);
  check("header mentions lift", /lift/i.test(tables[0].headers.join(" ")), true);
  check("the price cell survived", tables[0].rows[0].some((c) => /1\.95M/i.test(c)), true);
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A6 "Georgia 12:"
```

Expected: FAIL — `one table` reports 0 for both.

- [ ] **Step 3: Lower the table threshold and merge multi-band headers**

Two changes in `tablesFromPages`:

1. The minimum row count for "this is a table" must accept one data row when a header band was found. A single villa is a legitimate price list.
2. Consecutive header bands whose cells align on x must merge into one header row before the data rows begin, so `Internal | Area m | 2` becomes one column label.

Keep the existing multi-table splitting untouched — Korantina's lists put several tables on one page and the suite asserts that.

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -10
```

Expected: `all checks passed`.

- [ ] **Step 5: Mutation-test**

Raise the minimum row count back by one, re-run, confirm the Superior Villa block fails. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "Read one-row tables and headers split across bands

Georgia 12 and Tsada Superior Villa both produced no table at all: one
has a header spread over five y bands, the other is a single villa that
fell under the minimum row count."
```

---

## Task 7: Trailing non-unit rows are not units

Measured: Georgia Residences 2 admits `SWIMMING POOL EXTRA : | € | 15,000` as a unit. Alta Mare's `INCLUDED IN PRICE` and `OPTIONAL EXTRAS` blocks sit below its table and must stay out too.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`unitsFromTable` / row admission)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: `loadGv`, `tablesFromPages`, `TableExtraction.dropped`.
- Produces: unchanged signatures; dropped rows carry a reason.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nGR2: the pool surcharge is not a villa");
{
  const { tables } = tablesFromPages(loadGv("gr2"));
  const t = tables[0];
  check("two units", t.rows.length, 2);
  check("no surcharge row", t.rows.some((r) => /swimming pool extra/i.test(r.join(" "))), false);
  check("refs are 1 and 2", t.rows.map((r) => r[0]), ["1", "2"]);
}

console.log("\nAlta Mare: the extras block below the table stays out");
{
  const { tables } = tablesFromPages(loadGv("altamare"));
  const all = tables[0].rows.map((r) => r.join(" ")).join(" | ");
  check("no INCLUDED IN PRICE row", /included in price/i.test(all), false);
  check("no OPTIONAL EXTRAS row", /optional extras/i.test(all), false);
  check("no CCTV row", /cctv/i.test(all), false);
  check("still exactly 8 units", tables[0].rows.length, 8);
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A5 "GR2: the pool"
```

Expected: FAIL — `two units` reports 3 and `no surcharge row` reports true.

- [ ] **Step 3: Require a unit-shaped first cell for a data row**

A row joins the table only when its first non-empty cell passes `looksLikeUnitRef` (added in Task 5) **or** the table has no numbering column at all (Superior Villa — handled in Task 8). Rows that fail are recorded in `dropped` with the reason, never silently discarded:

```ts
dropped.push({ row: cells.join(" "), reason: "first cell is not a unit reference" });
```

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -10
```

Expected: `all checks passed`.

- [ ] **Step 5: Mutation-test**

Remove the `looksLikeUnitRef` condition, re-run, confirm the GR2 block fails. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "Keep surcharge and extras rows out of the unit list

GR2 printed 'SWIMMING POOL EXTRA : € 15,000' below its two villas and it
was imported as a third. Rejected rows are recorded with a reason rather
than dropped silently."
```

---

## Task 8: A ref for the table that has no numbering column

Superior Villa has no `No.` column. `validateMapping` currently forces *some* column to be the ref, which would make the bedroom count (`5`) the unit reference. This is the one case where the existing fallback produces a **wrong** answer rather than no answer.

**Files:**
- Modify: `src/lib/ai/availabilityTable.ts` (`validateMapping`, `unitsFromTable`)
- Test: `scripts/qa/availability-table-check.mjs`

**Interfaces:**
- Consumes: `unitsFromTable(table: RawTable, mapping: TableMapping): TableExtraction`.
- Produces: `unitsFromTable` gains an optional third argument `opts?: { fallbackRef?: string }`. Callers that omit it behave exactly as before.

- [ ] **Step 1: Write the failing test**

```js
console.log("\nA table with no numbering column does not borrow one");
{
  const { tables } = tablesFromPages(loadGv("sv"));
  const t = tables[0];
  const mapping = { columns: ["beds", "baths", "areaBuilt", "areaInternal", "areaVeranda",
    "areaVerandaOpen", "attr", "attr", "areaPlot", "price"], labels: t.headers, corrections: [] };
  const { units } = unitsFromTable(t, mapping, { fallbackRef: "Superior Villa" });
  check("one unit", units.length, 1);
  check("ref is not the bedroom count", units[0].ref === "5", false);
  check("ref falls back to the project name", units[0].ref, "Superior Villa");
  check("beds still read", units[0].beds, "5");
  check("price read from the M shorthand", units[0].price, 1950000);
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/availability-table-check.mjs 2>&1 | grep -A5 "no numbering column"
```

Expected: FAIL — `unitsFromTable` does not accept a third argument, so `ref` is `"5"`.

- [ ] **Step 3: Add the fallback**

In `validateMapping`, when no column is a plausible ref (no column of mostly-unique short codes), leave `ref` unset instead of commandeering one, and record a correction saying so. In `unitsFromTable`, when the mapping has no `ref` column, use `opts.fallbackRef` — and when that is absent too, drop the row with the reason `"no unit reference and no fallback"` rather than inventing one.

- [ ] **Step 4: Run the whole suite**

```bash
node scripts/qa/availability-table-check.mjs | tail -10
```

Expected: `all checks passed`. Korantina's existing "no usable ref column — using column N" assertion must still pass: that path applies when a plausible column exists, which is different from none existing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/availabilityTable.ts scripts/qa/availability-table-check.mjs
git commit -m "Do not borrow a ref column that is not one

Tsada Superior Villa is a single villa with no No. column, and the
existing fallback would have made its bedroom count the unit reference —
the one case where that fallback is wrong rather than merely absent."
```

---

## Task 9: The adapter — PDF buffer to `ExtractedPricelistProject`

The seam between the table engine and the Drive sync. It holds no table logic: it calls the engine, maps `TableUnit` onto `ExtractedUnit`, and returns the shape `driveAvailabilitySync` already consumes.

**Files:**
- Create: `src/lib/ai/pdfTablePricelist.ts`
- Test: `scripts/qa/gv-pricelist-check.mjs` (new — this is adapter logic, not table geometry)

**Interfaces:**
- Consumes: `extractPdfTables(buf): Promise<PdfTableResult>`, `mapTableColumns(table, context): Promise<TableMapping>`, `unitsFromTable(table, mapping, opts)`, types `ExtractedPricelistProject` / `ExtractedUnit` from `./pricelistExtract`.
- Produces:
  ```ts
  export type PdfTablePricelistResult =
    | { blocked: true; message: string }
    | { blocked: false; project: ExtractedPricelistProject; dropped: { row: string; reason: string }[] };

  export async function extractProjectFromPdfTable(
    buf: Buffer,
    projectName: string,
  ): Promise<PdfTablePricelistResult>;

  export function tableUnitToExtracted(u: TableUnit): ExtractedUnit;
  ```

- [ ] **Step 1: Write the failing test**

`scripts/qa/gv-pricelist-check.mjs` — bundle with esbuild the same way `availability-table-check.mjs` does, marking `@prisma/client` and the AI SDK external. Test `tableUnitToExtracted` only; `extractProjectFromPdfTable` calls the model and is covered by the Task 11 dry run.

```js
console.log("\nTableUnit maps onto ExtractedUnit without losing a field");
{
  const u = {
    ref: "101", label: null, block: null, floor: null, type: null,
    beds: "2", baths: "2", areaInternal: "85", areaBuilt: "106", areaPlot: null,
    areaVeranda: "21", areaVerandaOpen: null, price: 290000, status: "available",
    attrs: [{ name: "Storage", value: "YES" }, { name: "Covered parking", value: "YES" }],
  };
  const e = tableUnitToExtracted(u);
  check("ref", e.ref, "101");
  check("bedrooms", e.bedrooms, "2");
  check("bathrooms", e.bathrooms, "2");
  check("areaBuilt takes the built figure", e.areaBuilt, "106");
  check("areaVeranda", e.areaVeranda, "21");
  check("price", e.price, 290000);
  check("status", e.status, "available");
  check("attrs become extras, not lost", /Storage/.test(e.extras || ""), true);
  check("parking is carried", /YES/.test(e.parking || e.extras || ""), true);
}

console.log("\nA reserved unit keeps its status and carries no price");
{
  const e = tableUnitToExtracted({ ref: "2", beds: "4", baths: "3", price: null,
    status: "reserved", attrs: [], label: null, block: null, floor: null, type: null,
    areaInternal: null, areaBuilt: "176", areaPlot: "300", areaVeranda: "14", areaVerandaOpen: null });
  check("status", e.status, "reserved");
  check("price stays null", e.price, null);
  check("areaPlot", e.areaPlot, "300");
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/gv-pricelist-check.mjs
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the adapter**

```ts
import { extractPdfTables, mapTableColumns, unitsFromTable, type TableUnit } from "./availabilityTable";
import type { ExtractedPricelistProject, ExtractedUnit } from "./pricelistExtract";

/* The seam between the table engine and the Drive sync (G&V, 2026-09-08).
   G&V ships one PDF price list per project folder with the status printed in
   the price column, which is availabilityTable's shape — not
   pdfPricelistExtract's, whose status comes from text COLOUR and whose input
   is one document covering many projects. Deliberately holds no table logic:
   if a G&V list stops parsing, the fix belongs in the engine, with a fixture. */

export function tableUnitToExtracted(u: TableUnit): ExtractedUnit {
  const attrs = (u.attrs ?? []).filter((a) => a.name && a.value);
  const pick = (re: RegExp) => attrs.find((a) => re.test(a.name))?.value;
  const rest = attrs.filter((a) => !/storage|parking|pool|lift/i.test(a.name));
  return {
    ref: u.ref,
    ...(u.block ? { block: u.block } : {}),
    ...(u.type ? { type: u.type } : {}),
    ...(u.beds ? { bedrooms: u.beds } : {}),
    ...(u.baths ? { bathrooms: u.baths } : {}),
    ...(u.areaBuilt ? { areaBuilt: u.areaBuilt } : {}),
    ...(u.areaPlot ? { areaPlot: u.areaPlot } : {}),
    ...(u.areaVeranda ? { areaVeranda: u.areaVeranda } : {}),
    ...(u.areaVerandaOpen ? { areaVerandaOpen: u.areaVerandaOpen } : {}),
    ...(pick(/parking/i) ? { parking: pick(/parking/i) } : {}),
    ...(pick(/storage/i) ? { storage: pick(/storage/i) } : {}),
    ...(pick(/pool/i) ? { pool: pick(/pool/i) } : {}),
    ...(rest.length ? { extras: rest.map((a) => `${a.name}: ${a.value}`).join(", ") } : {}),
    price: u.price,
    status: u.status,
  };
}
```

Then `extractProjectFromPdfTable`: run `extractPdfTables`; if it yields no table, return `{ blocked: true, message }`. Otherwise take the first table, `mapTableColumns(table, projectName)`, `unitsFromTable(table, mapping, { fallbackRef: projectName })`, and return the project with its units and the dropped rows.

- [ ] **Step 4: Run the test**

```bash
node scripts/qa/gv-pricelist-check.mjs
```

Expected: `all checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pdfTablePricelist.ts scripts/qa/gv-pricelist-check.mjs
git commit -m "Adapter: per-project PDF table to the Drive sync's unit shape

Turns availabilityTable's output into ExtractedPricelistProject so a
per-project PDF price list feeds the existing Drive sync unchanged. Holds
no table logic of its own by design."
```

---

## Task 10: Let the per-project scan accept a PDF, for configured developers only

`listProjectFolders` hardcodes `findPriceFile(files, { requireNamed: true, spreadsheetsOnly: true })` at `src/lib/googleDrive.ts:212`. That refusal is why G&V's folders report "no price list". Open it **per developer**, so Motive Point and every spreadsheet developer are untouched.

**Files:**
- Modify: `src/lib/googleDrive.ts:199-215` (`listProjectFolders` signature and the `findPriceFile` call)
- Modify: `src/lib/driveAvailabilitySync.ts` (call site; folder exclusion; route the PDF through the Task 9 adapter)
- Test: `scripts/qa/gv-pricelist-check.mjs`

**Interfaces:**
- Consumes: `extractProjectFromPdfTable` from Task 9.
- Produces:
  ```ts
  export async function listProjectFolders(
    rootFiles: DriveFile[], accessToken: string,
    opts?: { allowPdfPriceList?: boolean; excludeFolders?: string[] },
  ): Promise<DriveProjectFolder[]>;

  /** Developers whose per-project price list is a PDF with textual status. */
  export const PDF_TABLE_PRICELIST_DEVS: Set<string>; // in driveAvailabilitySync.ts
  ```

- [ ] **Step 1: Write the failing test for the folder exclusion**

```js
console.log("\nExcluded root folders are not projects");
{
  const files = [
    { id: "1", name: "Alta Mare Phase I - Under Construction", mimeType: "application/vnd.google-apps.folder", modifiedTime: "2026-01-01T00:00:00Z" },
    { id: "2", name: "Custom Options", mimeType: "application/vnd.google-apps.folder", modifiedTime: "2026-01-01T00:00:00Z" },
    { id: "3", name: "Drone Videos of SOLD projects", mimeType: "application/vnd.google-apps.folder", modifiedTime: "2026-01-01T00:00:00Z" },
  ];
  const kept = filterProjectFolderCandidates(files, ["Custom Options", "Drone Videos of SOLD projects"]);
  check("only the real project remains", kept.map((f) => f.name), ["Alta Mare Phase I - Under Construction"]);
  // AUX_FOLDER_RE is anchored, so neither name is caught by it — this is why an
  // explicit list is needed rather than widening that regex.
  check("exclusion is case-insensitive", filterProjectFolderCandidates(files, ["custom options"]).length, 2);
  check("trailing spaces do not defeat it", filterProjectFolderCandidates(
    [{ id: "4", name: "Drone Videos ", mimeType: "application/vnd.google-apps.folder", modifiedTime: "x" }],
    ["Drone Videos"]).length, 0);
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
node scripts/qa/gv-pricelist-check.mjs 2>&1 | grep -A4 "Excluded root folders"
```

Expected: FAIL — `filterProjectFolderCandidates` is not exported.

- [ ] **Step 3: Implement**

In `googleDrive.ts`, extract the folder filter so it is testable and add the two options:

```ts
/* Folder names the operator has excluded for a developer. AUX_FOLDER_RE is
   anchored, so multi-word names like "Drone Videos of SOLD projects" and
   "Custom Options" (G&V, 2026-09-08) never match it — and widening that regex
   would start swallowing real project folders for every other developer.
   Compared trimmed and case-insensitively: two of G&V's folder names carry a
   trailing space. */
export function filterProjectFolderCandidates(files: DriveFile[], exclude: string[] = []): DriveFile[] {
  const drop = new Set(exclude.map((s) => s.trim().toLowerCase()));
  return files.filter((f) => f.mimeType === FOLDER_MIME
    && !AUX_FOLDER_RE.test(f.name.trim())
    && !drop.has(f.name.trim().toLowerCase()));
}
```

Change line 212's call to `findPriceFile(files, { requireNamed: true, spreadsheetsOnly: !opts?.allowPdfPriceList })`.

In `driveAvailabilitySync.ts`, add the developer map and the routing:

```ts
/* Developers whose per-project price list is a PDF whose status is TEXT in the
   price column (SOLD / RESERVED / SHOW HOUSE) — read by pdfTablePricelist.ts.
   Explicit rather than sniffed: Motive Point also ships PDFs, but its status is
   text COLOUR, and reading one with the other's reader silently loses or
   invents availability. */
const PDF_TABLE_PRICELIST_DEVS = new Set(["gv-drive"]);
```

Where a project folder's own price file is read, branch on `price.mimeType === "application/pdf"` **and** membership in that set, calling `extractProjectFromPdfTable(buf, folderProjectName(folder.name))`. Everything downstream — media, plans, amenities, the Development upsert — stays as it is.

- [ ] **Step 4: Run both suites**

```bash
node scripts/qa/gv-pricelist-check.mjs && node scripts/qa/availability-table-check.mjs | tail -4
```

Expected: both `all checks passed`.

- [ ] **Step 5: Typecheck and build**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "googleDrive|driveAvailabilitySync|pdfTablePricelist" || echo "no errors in the touched files"
```

Expected: no errors in the touched files. Pre-existing errors elsewhere are not yours; compare the total count against `origin/main` before claiming a regression.

- [ ] **Step 6: Commit**

```bash
git add src/lib/googleDrive.ts src/lib/driveAvailabilitySync.ts scripts/qa/gv-pricelist-check.mjs
git commit -m "Accept a per-project PDF price list for configured developers

listProjectFolders refused every PDF in a project folder, which is why
G&V's five folders reported 'no price list'. Opened per developer, so
Motive Point's colour-status PDFs and every spreadsheet developer are
untouched, and the excluded folder names are honoured."
```

---

## Task 11: Create the account and prove it against the live folder

**Files:**
- Create: `scripts/setup-gv-account.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: one `DeveloperAccount` row; a dry-run report.

- [ ] **Step 1: Write the account setup script**

```js
// One-off. Creates the G&V DeveloperAccount. Idempotent: re-running updates the
// existing row rather than creating a second one.
const slug = "gv-drive";
await prisma.developerAccount.upsert({
  where: { slug },
  update: { driveFolderUrl: URL, driveSyncInterval: "weekly" },
  create: {
    name: "G&V (drive)", slug,
    driveFolderUrl: "https://drive.google.com/drive/folders/1VQEg9Nue9YiTErIb2zYYSnKbqWyd-qno",
    driveSyncInterval: "weekly",
  },
});
```

The slug must equal the entry in `PDF_TABLE_PRICELIST_DEVS` from Task 10 (`gv-drive`), or the PDF branch never runs.

- [ ] **Step 2: Create the row**

```bash
node --env-file=.env.local scripts/setup-gv-account.mjs
```

This writes to the production database. It is additive and idempotent.

- [ ] **Step 3: Dry run against the live folder — write nothing**

```bash
node --env-file=.env.local -e '
const { PrismaClient } = require("@prisma/client"); /* … */
' # call previewDriveFolders(developerAccountId) and print, per folder:
  # folder name, price file found, units parsed, statuses, prices, dropped rows,
  # and any mapping corrections.
```

Expected, per the fixtures:

| Folder | Units | Statuses |
| --- | --- | --- |
| Alta Mare Phase I | 8 | 5 available, 3 reserved (units 2, 3, 6 reserved; 7 show house → reserved) |
| Tsada Panorama Phase D | 7 | 2 available, 3 reserved, 2 sold |
| Georgia 12 | 9 | 9 available |
| Georgia Residences 2 | 2 | 2 available |
| Tsada Superior Villa | 1 | 1 available, ref `Tsada Panorama Superior Villa` |

`Custom Options` and `Drone Videos of SOLD projects` must not appear at all.

- [ ] **Step 4: Stop and report**

Do not run a real sync and do not deploy. Report the dry-run table against the expectations above, name any difference, and wait for the operator.

---

## Self-Review

**Spec coverage:** every spec section maps to a task — regression net (1), fixtures and engine changes (2–8), the adapter (9), the per-project PDF path, the developer map and the folder exclusions (10), the account and dry run (11). Media, plans and amenities need no task: they are existing `driveAvailabilitySync` behaviour that the adapter feeds. Stage 2 (brochure descriptions) is explicitly out of scope per the spec.

**Type consistency:** `tableUnitToExtracted` (Task 9) consumes `TableUnit` exactly as defined in `availabilityTable.ts` and returns `ExtractedUnit` exactly as defined in `pricelistExtract.ts`. `unitsFromTable`'s new third parameter (Task 8) is the one used in Task 9. `PDF_TABLE_PRICELIST_DEVS` holds `"gv-drive"`, the same slug Task 11 creates.

**Known risk:** Tasks 5, 6 and 7 all touch `tablesFromPages`, the function Korantina and AGG depend on. Each has its own mutation step, and the full suite must be green before each commit. If Korantina assertions cannot be kept green, stop and fall back to the spec's documented alternative — a G&V-specific reader — rather than loosening the engine.
