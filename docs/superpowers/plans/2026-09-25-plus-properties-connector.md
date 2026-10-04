# Plus Properties Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Plus Properties' 35 Cypriot projects — units from 32 hand-kept Excel (SpreadsheetML) price lists, media from a separate Drive tree, facts from their website — into our Developments as drafts, nightly.

**Architecture:** A pure parser (`src/lib/plusProperties.ts`) reads one workbook's raw XML — active sheet only, font colours kept — into project metadata and units. A sync module (`src/lib/plusPropertiesSync.ts`) holds small pure decision helpers plus one writer that gathers everything from Drive first, then writes per project in isolation. A cron route runs it nightly; QA scripts check the parser against the developer's own PDFs.

**Tech Stack:** Next.js 14 route handlers, Prisma/PostgreSQL, `xml2js` (already used by feeds), `node-html-parser` (already a dependency), existing `src/lib/googleDrive.ts` + `src/lib/imageMirror.ts`. Tests are Node QA scripts bundled with esbuild — there is no jest/vitest in this repo.

**Spec:** `docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md` (approved 2026-09-25; corrected in 570fdae3 and in the same commit as this plan). Read it before Task 1 — every trap below is argued there.

## Global Constraints

- Work in an isolated git worktree cut from `origin/main`. Never `git add -A`, never switch branches in `/Users/sashadith/cvp-analysis` (other sessions share it). Push with `git push origin HEAD:main`.
- Local `main` lags `origin/main`; read and diff against `origin/main`.
- `.env.local` points at the **live production database**. QA scripts must set a placeholder `DATABASE_URL` before bundling anything that imports `@/lib/prisma`.
- tsconfig has no `downlevelIteration`: no spread of `Set`/`Map`, no `for…of` over `.entries()`/`matchAll()`. Use `Array.from(...)` and index loops.
- Internal copy (code comments, notes, log messages, admin text) is English.
- Never deploy, never install a crontab entry, never run the real sync in production without the operator's explicit word in chat.
- Every guard is mutation-tested, and each mutation is confirmed to have landed in the function under test (a string that occurs twice in a file is a trap — make the mutation's search string unique).
- The connector never writes `Development.category`, `Development.slug`, or anything in `DevelopmentOverride`.
- Prices are stored only for `available` units. A price cell coloured `#FFFFFF` is never read. The `Price €/OLD` column is never read, not even as a fallback.
- Constants (verbatim): dev key `plusproperties`; account slug `plus-properties`; XML folder `1xeFHfoMUGpyAPMgUMe9qMHmyRvyOdnMu`; PDF folder `14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ`; projects folder `1aXXbOSp_-10rLlHHixQzGR-RKnc342AN`; completeness floor 3 units; cron job name `plus-sync`, schedule `30 2 * * *`.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/plus-capture-fixtures.mjs` (create) | One-off: download the fixture workbooks, their PDFs as text, and one website page. Runs on the VPS (credentials + `pdftotext` live there). |
| `scripts/qa/fixtures/plus/*` (create) | Real source files the tests read. |
| `src/lib/plusProperties.ts` (create) | Pure parser: workbook → sheets → active sheet → `PlusProject`. No DB, no network. |
| `scripts/qa/plus-parse-check.mjs` (create) | Unit tests for the parser. |
| `scripts/qa/plus-pdf-check.mjs` (create) | Ground truth: parser output vs the developer's PDFs, unit by unit. |
| `src/lib/plusPropertiesSync.ts` (create) | Pure sync helpers (keys, coordinates, website facts, decisions, unit rows) + the writer `syncPlusProperties()`. |
| `scripts/qa/plus-sync-check.mjs` (create) | Tests for the sync helpers + source-wiring assertions for the writer and route. |
| `src/app/api/cron/plus-sync/route.ts` (create) | Nightly entry point: auth, `force`, `dryRun`. |
| `scripts/setup-plus-properties-account.mjs` (create) | Idempotent creation of the DeveloperAccount. |
| `src/lib/actionCenter/rules/system.ts` (modify) | Add `plus-sync` to cron health `JOBS`. |

---

### Task 1: Capture real fixtures

**Files:**
- Create: `scripts/plus-capture-fixtures.mjs`
- Create: `scripts/qa/fixtures/plus/` (10 `.xml`, 10 `.pdf.txt`, 1 `.html`, `README.md`)

**Interfaces:**
- Consumes: nothing.
- Produces: fixture files named `plus-<key>.xml`, `plus-<key>.pdf.txt`, `plus-33-page.html`, where `<key>` ∈ `33, 57, 87, 60, 75, 67-68-69, 59, 63, house-kiti, 21`. Plus 85 has no PDF and is not a fixture.

- [ ] **Step 1: Write the capture script**

```js
#!/usr/bin/env node
/* One-off fixture capture for the Plus Properties connector. Runs ON THE VPS:
   the Drive OAuth credentials and poppler's pdftotext live there, not on a
   laptop. Read-only against Drive and the developer's website.

     scp scripts/plus-capture-fixtures.mjs root@72.60.89.239:/tmp/
     ssh root@72.60.89.239 'cd /tmp && node plus-capture-fixtures.mjs'
     scp -r root@72.60.89.239:/tmp/plus-fixtures/. scripts/qa/fixtures/plus/
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "/tmp/plus-fixtures";
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(readFileSync("/var/www/cyprusvipestates/.env", "utf8").split("\n")
  .filter((l) => /^GOOGLE_(CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN)=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }));
const tok = (await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }),
})).json()).access_token;
const H = { Authorization: "Bearer " + tok };
const bytes = async (id) => Buffer.from(await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: H })).arrayBuffer());

// Workbook ids, measured 2026-09-25. Each fixture exists for one trap (spec §"The traps").
const XML = {
  "33": "1cqCUkn9zk9NtU2NYkH1T2Sfa6Y3k1gT-",          // plain; one white price on a sold unit
  "57": "19-TDr8NvtnI_n93BuoG60p8BcR5dpevG",          // four hidden sheets, one a stale price list
  "87": "1nWnw9PQBxhwgQbdMTJVfylqVIQuCr9Xi",          // two stale VISIBLE sheets ("before TD", "after TD")
  "60": "1B_hG3XjSA_lNNUv9JepHeiAu6exOaa1g",          // "Villa No", two-row header
  "75": "1zHKvTgaB5VWyDav6MekoHb7a8p5f75c3",          // two-storey villas, swapped columns, Price €/OLD
  "67-68-69": "18yuec1ncdyRcZmuZ6zPEOLIzhaTHDml1",    // "&" in the sheet name, Project column
  "59": "1ZvFLf6Jpo4LjvBygPU5wyimVojkSIS9r",          // shops (commercial), wrapped PDF rows
  "63": "1dE4NLHOvBM_w7jFB3W8wfaKOwroxZDdL",          // white prices on sold/reserved units
  "house-kiti": "1ZF9OvvQra05oJPe_CmknhqxYTWkigtOF",  // a house, not a table
  "21": "1S0W0-s3H4mgnPp95k9jHMsYw2h8621Kf",          // a hidden "avail" sheet beside the visible one
};
for (const [key, id] of Object.entries(XML)) writeFileSync(`${OUT}/plus-${key}.xml`, await bytes(id));

// PDFs: matched by their project number in the PDF folder's listing.
const q = encodeURIComponent(`'14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ' in parents and trashed=false`);
const pdfs = (await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: H })).json()).files;
const keyOf = (n) => /house\s*-?\s*kiti/i.test(n) ? "house-kiti" : (n.match(/plus\s*(\d+(?:[-_]\d+)*)/i)?.[1] ?? "").replace(/_/g, "-");
for (const f of pdfs) {
  const key = keyOf(f.name);
  if (!(key in XML)) continue;
  writeFileSync(`/tmp/plus-${key}.pdf`, await bytes(f.id));
  writeFileSync(`${OUT}/plus-${key}.pdf.txt`, execFileSync("pdftotext", ["-layout", `/tmp/plus-${key}.pdf`, "-"]));
}

// One website page, for the Project Details reader.
const page = await fetch("https://www.pluspropertiescyprus.com/plus-33---universal/57/plus-33---universal");
writeFileSync(`${OUT}/plus-33-page.html`, Buffer.from(await page.arrayBuffer()));
console.log("captured:", execFileSync("ls", [OUT]).toString().trim().split("\n").length, "files");
```

- [ ] **Step 2: Run it on the VPS and copy the result into the worktree**

```bash
scp -i ~/.ssh/cvp_vps scripts/plus-capture-fixtures.mjs root@72.60.89.239:/tmp/
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'cd /tmp && node plus-capture-fixtures.mjs'
mkdir -p scripts/qa/fixtures/plus
scp -i ~/.ssh/cvp_vps -r 'root@72.60.89.239:/tmp/plus-fixtures/.' scripts/qa/fixtures/plus/
ls scripts/qa/fixtures/plus
```
Expected: `captured: 21 files` — 10 `.xml`, 10 `.pdf.txt` (every fixture project has a PDF; Plus 85, the one without, is not a fixture), 1 `.html`. Verify by name that every `plus-<key>.xml` has a matching `plus-<key>.pdf.txt`. If one is missing, stop and report which — do not continue with a partial set.

- [ ] **Step 3: Write `scripts/qa/fixtures/plus/README.md`**

```markdown
Plus Properties fixtures, captured 2026-09-25 with scripts/plus-capture-fixtures.mjs.

`plus-<key>.xml` is the developer's workbook exactly as downloaded from Drive.
`plus-<key>.pdf.txt` is `pdftotext -layout` of their own PDF printout of it —
the ground truth scripts/qa/plus-pdf-check.mjs compares the parser against.
`plus-33-page.html` is their project page, for the Project Details reader.

Do not edit these files to make a test pass. If the developer's format
changes, capture new fixtures and keep the old ones beside them.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/plus-capture-fixtures.mjs scripts/qa/fixtures/plus
git commit -m "Plus Properties: capture real workbook, PDF and page fixtures"
```

---

### Task 2: Read the workbook and pick the active sheet

**Files:**
- Create: `src/lib/plusProperties.ts`
- Create: `scripts/qa/plus-parse-check.mjs`

**Interfaces:**
- Consumes: fixtures from Task 1.
- Produces:
  - `class PlusParseError extends Error`
  - `type Cell = { col: number; value: string; colour: string | null; href: string | null }`
  - `type Sheet = { name: string; hidden: boolean; active: boolean; rows: Cell[][] }`
  - `readWorkbook(xml: string): Promise<Sheet[]>`
  - `activeSheet(sheets: Sheet[]): Sheet`

- [ ] **Step 1: Write the failing test** — `scripts/qa/plus-parse-check.mjs`

```js
#!/usr/bin/env node
/* Guard for the Plus Properties parser (src/lib/plusProperties.ts).
   Spec: docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
   Every fixture is a real workbook from the developer's Drive; each one exists
   for one trap the spec lists. Run: node scripts/qa/plus-parse-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild"); process.exit(2); }

const scratch = join(process.cwd(), "node_modules", ".plus-parse-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
async function bundle(entry, name) {
  const out = await build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false,
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const f = join(scratch, `${name}.mjs`);
  writeFileSync(f, out.outputFiles[0].text);
  return f;
}
const P = await import(await bundle("src/lib/plusProperties.ts", "parser"));
const fx = (name) => readFileSync(join("scripts/qa/fixtures/plus", name), "utf8");

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

/* ── the active sheet ──────────────────────────────────────────────────────
   The PDF is Excel's printout of the ACTIVE sheet, so that is the current list.
   Plus 57 hides four stale sheets; Plus 87 keeps two stale snapshots VISIBLE, in
   which all ten units are still available — "read only visible sheets" would
   publish seven sold flats as on sale. */
const active = async (key) => P.activeSheet(await P.readWorkbook(fx(`plus-${key}.xml`))).name;
check("Plus 57: the one visible sheet out of five", await active("57"), "PLUS 57");
check("Plus 87: the active sheet, not a visible stale snapshot", await active("87"), "Plus 87");
check("Plus 21: the visible price sheet, not the hidden 'avail' one", await active("21"), "PLUS 21 price");
check("Plus 33: a plain workbook", await active("33"), "Plus 33");
/* The sheet is literally named "Plus 67-68 & 69". A reader that pulls names out
   of the raw XML with a regex sees "&amp;" — that is how the analysis run first
   lost this whole project. */
check("an '&' in a sheet name is decoded", await active("67-68-69"), "Plus 67-68 & 69");

const s57 = await P.readWorkbook(fx("plus-57.xml"));
check("Plus 57 has five sheets", s57.length, 5);
check("…four of them hidden", s57.filter((s) => s.hidden).length, 4);
const s87 = await P.readWorkbook(fx("plus-87.xml"));
check("Plus 87: all three sheets visible", s87.filter((s) => !s.hidden).length, 3);
check("…exactly one active", s87.filter((s) => s.active).length, 1);

/* Font colour survives the read — the hidden-price rule depends on it.
   Plus 75, D-Villas, Villa 4 is sold with 335,000 written in white. */
const s75 = P.activeSheet(await P.readWorkbook(fx("plus-75.xml")));
const white = s75.rows.flat().find((c) => c.value === "335000");
check("a white price keeps its colour", white?.colour, "#FFFFFF");

/* The contract for anything the parser meets for the first time. */
const bare = (sheets) => sheets.map((s, i) => ({ name: `S${i}`, hidden: false, active: false, rows: [], ...s }));
let threw = "";
try { P.activeSheet(bare([{ active: true }, { active: true }])); } catch (e) { threw = String(e.message); }
check("two active sheets fail loudly", /exactly one active sheet/.test(threw), true);
threw = "";
try { P.activeSheet(bare([{}, {}])); } catch (e) { threw = String(e.message); }
check("no active sheet among several fails loudly", /exactly one active sheet/.test(threw), true);
check("a single-sheet workbook without the flag uses its only sheet", P.activeSheet(bare([{ name: "Only" }])).name, "Only");
threw = "";
try { P.activeSheet(bare([{ active: true, hidden: true }, {}, {}])); } catch (e) { threw = String(e.message); }
check("a hidden sheet never counts as active", /exactly one active sheet/.test(threw), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/qa/plus-parse-check.mjs`
Expected: build error — `Could not resolve "src/lib/plusProperties.ts"`.

- [ ] **Step 3: Implement** — `src/lib/plusProperties.ts`

```ts
import { parseStringPromise } from "xml2js";

/* Plus Properties price lists. The developer keeps one Excel workbook per
   project, saved as SpreadsheetML 2003 ("<?mso-application progid="Excel.Sheet"?>"),
   in a shared Drive folder. It reads like a feed and is not one: the layout is
   whatever a person made it that week. Everything that can silently turn it
   into wrong data is handled in this file, and each rule is argued in
   docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.

   This module is pure: bytes in, data out. No database, no network. */

export class PlusParseError extends Error {}

export type Cell = { col: number; value: string; colour: string | null; href: string | null };
export type Sheet = { name: string; hidden: boolean; active: boolean; rows: Cell[][] };

/* xml2js gives text as a string, an array, or an object with the text under
   "_" and child elements (rich-text runs) beside it. Flatten all of it. */
function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    let s = typeof o._ === "string" ? o._ : "";
    for (const k of Object.keys(o)) if (k !== "_" && k !== "$") s += textOf(o[k]);
    return s;
  }
  return String(node);
}

/* Raw SpreadsheetML, read through a real XML parser so entities are decoded
   ("Plus 67-68 &amp; 69" is the sheet "Plus 67-68 & 69"). Two things a generic
   spreadsheet library drops are kept on purpose: which sheet is active, and
   each cell's font colour — the developer hides the prices of sold units by
   colouring them white. */
export async function readWorkbook(xml: string): Promise<Sheet[]> {
  const doc = await parseStringPromise(xml, { explicitArray: true, trim: false });
  const wb = doc?.Workbook;
  if (!wb) throw new PlusParseError("not a SpreadsheetML workbook");
  const colour = new Map<string, string | null>();
  for (const st of wb.Styles?.[0]?.Style ?? []) {
    const id = st.$?.["ss:ID"];
    const c = st.Font?.[0]?.$?.["ss:Color"];
    if (id) colour.set(id, c ? String(c).toUpperCase() : null);
  }
  return (wb.Worksheet ?? []).map((ws: any): Sheet => {
    const opts = ws.WorksheetOptions?.[0] ?? {};
    const rows: Cell[][] = [];
    for (const r of ws.Table?.[0]?.Row ?? []) {
      const cells: Cell[] = [];
      let col = 0;
      for (const c of r.Cell ?? []) {
        const a = c.$ ?? {};
        if (a["ss:Index"]) col = Number(a["ss:Index"]) - 1;
        cells.push({
          col,
          value: textOf(c.Data).replace(/\s+/g, " ").trim(),
          colour: colour.get(a["ss:StyleID"]) ?? null,
          href: a["ss:HRef"] ?? null,
        });
        col += 1 + Number(a["ss:MergeAcross"] ?? 0);
      }
      rows.push(cells);
    }
    return {
      name: ws.$?.["ss:Name"] ?? "",
      hidden: /hidden/i.test(textOf(opts.Visible)),
      active: opts.Selected !== undefined,
      rows,
    };
  });
}

/* The current list is the ACTIVE sheet — the one Excel prints, and so the one
   the developer's PDF shows. Measured 2026-09-25: all 32 workbooks have exactly
   one, never hidden. Visibility alone is not enough: Plus 87 keeps two stale
   snapshots visible, with every unit still "Available". A workbook with a
   single sheet and no flag uses that sheet; anything else ambiguous fails this
   one project, loudly, rather than guessing which list is true. */
export function activeSheet(sheets: Sheet[]): Sheet {
  const visible = sheets.filter((s) => !s.hidden);
  const active = visible.filter((s) => s.active);
  if (active.length === 1) return active[0];
  if (active.length === 0 && sheets.length === 1 && visible.length === 1) return visible[0];
  throw new PlusParseError(`expected exactly one active sheet, found ${active.length} of ${sheets.length}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node scripts/qa/plus-parse-check.mjs`
Expected: `all passed`.

- [ ] **Step 5: Mutation-test the guard**

Apply each mutation to `src/lib/plusProperties.ts` alone, run the check, expect at least one `FAIL`, then restore (`git checkout src/lib/plusProperties.ts`). Confirm with `grep -c` that each search string occurs exactly once before replacing.

| Mutation | Search → replace | Must kill |
|---|---|---|
| visible instead of active | `const active = visible.filter((s) => s.active);` → `const active = visible;` | Plus 87 active sheet |
| hidden sheets allowed | `const visible = sheets.filter((s) => !s.hidden);` → `const visible = sheets;` | hidden sheet never counts |
| colour dropped | `colour: colour.get(a["ss:StyleID"]) ?? null,` → `colour: null,` | white price keeps colour |
| no entity decoding | in `readWorkbook`, `name: ws.$?.["ss:Name"] ?? "",` → `name: String(ws.$?.["ss:Name"] ?? "").replace(/&/g, "&amp;"),` | '&' decoded |

- [ ] **Step 6: Commit**

```bash
git add src/lib/plusProperties.ts scripts/qa/plus-parse-check.mjs
git commit -m "Plus Properties parser: read the workbook raw and pick the active sheet"
```

---

### Task 3: Map header spellings to fields

**Files:**
- Modify: `src/lib/plusProperties.ts`
- Modify: `scripts/qa/plus-parse-check.mjs`

**Interfaces:**
- Consumes: `Cell` from Task 2.
- Produces:
  - `type Field = "block" | "floor" | "unit" | "beds" | "baths" | "parking" | "storage" | "internal" | "veranda" | "verandaOpen" | "roof" | "garden" | "common" | "total" | "plot" | "price" | "priceOld" | "status" | "ignore"`
  - `columnField(header: string): Field | null` — `null` = unknown (reported, not fatal)

- [ ] **Step 1: Add the failing tests** — insert before the final `console.log` of `plus-parse-check.mjs`

```js
/* ── header spellings ──────────────────────────────────────────────────────
   Every left-hand string below is a real header measured across the 32 lists
   on 2026-09-25 (about 60 spellings for about 15 concepts). */
const F = (h) => P.columnField(h);
const HEADERS = [
  ["Unit", "unit"], ["Villa No", "unit"], ["Floor", "floor"],
  ["Block", "block"], ["BLOCKS", "block"], ["Project", "block"],
  ["Nbr of Bedrooms", "beds"], ["Number of Bedrooms", "beds"], ["Nbr. of Bedrooms", "beds"],
  ["Nbr of Bathrooms", "baths"], ["Number of Bathrooms", "baths"], ["Nbr. of Bathrooms", "baths"],
  ["Parking", "parking"], ["Parking Spaces", "parking"], ["Covered Parking (sqm)", "parking"],
  ["Storage", "storage"], ["Storage Rooms", "storage"], ["Storages", "storage"], ["Stores", "storage"],
  ["Storage Room", "storage"], ["Storage / Area (sqm)", "storage"],
  ["Covered Internal Area (sqm)", "internal"], ["Covered Internal Area (SQM)", "internal"],
  ["Internal Area (sqm)", "internal"], ["Covered / Closed Area (sqm)", "internal"],
  ["Covered Veranda (sqm)", "veranda"], ["Covered Veranda (SQM)", "veranda"], ["Covered Veranda / Terrace (sqm)", "veranda"],
  ["Uncovered Veranda (sqm)", "verandaOpen"], ["Uncovered Terrace (sqm)", "verandaOpen"],
  ["Uncovered Veranda & Terraces (sqm)", "verandaOpen"], ["Uncovered Balcony (sqm)", "verandaOpen"],
  ["Uncovered veranda/ Terrace (sqm)", "verandaOpen"], ["Uncovered Veranda / Roof Terrace", "verandaOpen"],
  ["Uncovered Roof Terrace (sqm)", "roof"], ["Covered Roof Terrace", "roof"], ["Internal covered Roof (sqm)", "roof"],
  ["Roof Garden (SQM)", "roof"], ["Roof Storage and Bathroom (sqm)", "roof"],
  ["Garden (sqm)", "garden"], ["Gardens", "garden"], ["Planter (sqm)", "garden"],
  ["Common Area (sqm)", "common"], ["Total Area (sqm)", "total"], ["Plot Area (sqm)", "plot"],
  ["Price €", "price"], ["Price", "price"], ["Availability", "status"],
  /* The two a naive mapping gets wrong in the dangerous direction. */
  ["Price €/OLD", "priceOld"],
  ["OPTIONAL Roof Garden / Subject to Extra Cost (sqm)", "ignore"],
  ["Storage Optional at Extra Cost", "ignore"],
  ["(5% downpayment)", "ignore"], ["Kitchenette", "ignore"], ["Nbr of Units", "ignore"],
];
for (const [h, want] of HEADERS) check(`header "${h}" → ${want}`, F(h), want);
check("an unknown header is null, not a guess", F("Sea View Rating"), null);
check("whitespace and line breaks inside a header are ignored", F("Covered Internal Area\n  (sqm)"), "internal");
check("an empty header is null", F("   "), null);
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/qa/plus-parse-check.mjs`
Expected: `TypeError: P.columnField is not a function`.

- [ ] **Step 3: Implement** — append to `src/lib/plusProperties.ts`

```ts
export type Field =
  | "block" | "floor" | "unit" | "beds" | "baths" | "parking" | "storage"
  | "internal" | "veranda" | "verandaOpen" | "roof" | "garden" | "common" | "total" | "plot"
  | "price" | "priceOld" | "status" | "ignore";

/* About 60 header spellings for about 15 concepts, measured across all 32
   workbooks. ORDER MATTERS: "Price €/OLD" must be caught before plain price
   (a sold villa often has only its OLD price filled), optional extras before
   the area they name, roof before garden/storage ("Roof Garden", "Roof Storage
   and Bathroom"), and "uncovered" before "covered". null means unknown: the
   caller reports it and ignores the column — a new header is never guessed. */
export function columnField(header: string): Field | null {
  const h = header.replace(/\s+/g, " ").trim().toLowerCase();
  if (!h) return null;
  if (/optional|extra cost/.test(h)) return "ignore";
  if (/^price/.test(h)) return /old/.test(h) ? "priceOld" : "price";
  if (/^availab/.test(h)) return "status";
  if (/^(unit|villa no\.?)$/.test(h)) return "unit";
  if (h === "floor") return "floor";
  if (/^(block|blocks|project)$/.test(h)) return "block";
  if (/bedroom/.test(h)) return "beds";
  if (/bathroom/.test(h)) return "baths";
  if (/downpayment|kitch|nbr of units|number of units/.test(h)) return "ignore";
  if (/plot/.test(h)) return "plot";
  if (/total area/.test(h)) return "total";
  if (/common area/.test(h)) return "common";
  if (/^uncovered veranda/.test(h)) return "verandaOpen";
  if (/roof/.test(h)) return "roof";
  if (/parking/.test(h)) return "parking";
  if (/storage|^stores?$/.test(h)) return "storage";
  if (/garden|planter/.test(h)) return "garden";
  if (/uncovered|balcony/.test(h)) return "verandaOpen";
  if (/veranda|terrace/.test(h)) return "veranda";
  if (/internal|closed area/.test(h)) return "internal";
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/qa/plus-parse-check.mjs`
Expected: `all passed`.

- [ ] **Step 5: Mutation-test**

| Mutation | Search → replace | Must kill |
|---|---|---|
| OLD read as price | `return /old/.test(h) ? "priceOld" : "price";` → `return "price";` | `Price €/OLD → priceOld` |
| optional not ignored | `if (/optional\|extra cost/.test(h)) return "ignore";` → delete the line | `OPTIONAL Roof Garden… → ignore` |
| roof after storage | move the `/roof/` line below the `/storage…/` line | `Roof Storage and Bathroom → roof` |
| uncovered after covered | move the `/uncovered\|balcony/` line below the `/veranda\|terrace/` line | `Uncovered Terrace → verandaOpen` |

- [ ] **Step 6: Commit**

```bash
git add src/lib/plusProperties.ts scripts/qa/plus-parse-check.mjs
git commit -m "Plus Properties parser: map the measured header spellings to fields"
```

---

### Task 4: Units, footer and status rules for a standard table

**Files:**
- Modify: `src/lib/plusProperties.ts`
- Modify: `scripts/qa/plus-parse-check.mjs`
- Create: `scripts/qa/plus-pdf-check.mjs`

**Interfaces:**
- Consumes: `readWorkbook`, `activeSheet`, `columnField` (Tasks 2–3).
- Produces:
  - `type PlusStatus = "available" | "reserved" | "sold"`
  - `type PlusStage = "Under Construction" | "Off Plan" | "Completed"`
  - `type PlusUnit = { ref: string; label: string; block: string | null; floor: string | null; beds: string | null; baths: string | null; parking: string | null; storage: string | null; areaBuilt: number | null; areaVeranda: number | null; areaVerandaOpen: number | null; areaRoof: number | null; areaGarden: number | null; areaCommon: number | null; areaTotal: number | null; areaPlot: number | null; status: PlusStatus; price: number | null }`
  - `type PlusProject = { sheetName: string; title: string | null; version: string | null; listDate: string | null; stage: PlusStage | null; location: string | null; mapsUrl: string | null; websiteUrl: string | null; vatExcluded: boolean; units: PlusUnit[]; notes: string[] }`
  - `parseStatus(raw: string): PlusStatus` (throws `PlusParseError`)
  - `projectStage(raw: string | null): PlusStage | null` (throws on an unknown non-empty value)
  - `cleanNumber(raw: string | null | undefined): number | null`
  - `cleanBeds(raw: string | null | undefined): string | null` — total first, split kept: `"4 ( 3+1)"` → `"4 (3+1)"`. Every reader of `beds` in the codebase takes the FIRST number (`unitBedNumber` in `src/lib/developmentCard.ts`, `developmentSeo.ts`), so the total must lead.
  - `cleanText(raw: string | null | undefined): string | null` — a pure number loses Excel noise (`"17.600000000000001"` → `"17.6"`), anything else is trimmed text
  - `parsePriceList(xml: string): Promise<PlusProject>`

- [ ] **Step 1: Add the failing parser tests** — before the final `console.log` of `plus-parse-check.mjs`

```js
/* ── small rules ───────────────────────────────────────────────────────── */
check("status: Available", P.parseStatus("Available"), "available");
check("status: trailing space tolerated", P.parseStatus("Available "), "available");
check("status: Reserved", P.parseStatus("Reserved"), "reserved");
check("status: Sold, any case", P.parseStatus("SOLD"), "sold");
threw = "";
try { P.parseStatus("Under Offer"); } catch (e) { threw = String(e.message); }
check("an unknown unit status fails loudly and names itself", /unknown unit status "Under Offer"/.test(threw), true);

check("stage: three spellings of under construction",
  ["Under-Construction", "Under construction", "Under Construction"].map(P.projectStage),
  ["Under Construction", "Under Construction", "Under Construction"]);
check("stage: Understudy is pre-construction", P.projectStage("Understudy"), "Off Plan");
check("stage: Ready to move in", P.projectStage("Ready to move in"), "Completed");
check("stage: absent is null, not an error", [P.projectStage(null), P.projectStage("  ")], [null, null]);
threw = "";
try { P.projectStage("Launching Soon"); } catch (e) { threw = String(e.message); }
check("an unknown project status fails loudly", /unknown project status "Launching Soon"/.test(threw), true);

check("Excel noise is rounded", P.cleanNumber("76.599999999999994"), 76.6);
check("a unit suffix is dropped", P.cleanNumber("883 SQM"), 883);
check("thousand separators and currency", P.cleanNumber("€ 410,000"), 410000);
check("no number is null", [P.cleanNumber(""), P.cleanNumber(null), P.cleanNumber("n/a")], [null, null, null]);
/* The total leads: every reader of `beds` takes the FIRST number, so "3+1"
   would count Plus 60's four-bedroom villas as three. */
check("beds: '4 ( 3+1)' → total first, split kept", P.cleanBeds("4 ( 3+1)"), "4 (3+1)");
check("beds: '3(2+1)' (Plus 87)", P.cleanBeds("3(2+1)"), "3 (2+1)");
check("beds: plain", [P.cleanBeds("2"), P.cleanBeds("2.0"), P.cleanBeds(""), P.cleanBeds(null)], ["2", "2", null, null]);
check("text: Excel noise on a number", P.cleanText("17.600000000000001"), "17.6");
check("text: words are kept", [P.cleanText(" semi covered "), P.cleanText("1 Roof"), P.cleanText("")], ["semi covered", "1 Roof", null]);

/* ── Plus 33, the plain case ─────────────────────────────────────────────
   Values from the developer's PDF of version 2.41 (2026-09-01). */
const p33 = await P.parsePriceList(fx("plus-33.xml"));
const byRef = (p) => Object.fromEntries(p.units.map((u) => [u.ref, u]));
const u33 = byRef(p33);
check("Plus 33: seven units", p33.units.length, 7);
check("Plus 33: statuses", ["101", "102", "201", "202", "301", "302", "401"].map((r) => u33[r]?.status),
  ["available", "available", "sold", "sold", "sold", "available", "available"]);
check("Plus 33: prices on available units", ["101", "102", "302", "401"].map((r) => u33[r].price), [350000, 350000, 370000, 500000]);
/* 201 is sold with 360,000 still in its cell, coloured white so it does not
   print. The developer chose not to show it; neither do we. */
check("Plus 33: a sold unit's hidden price is not read", u33["201"].price, null);
check("Plus 33: floor carried down a merged cell", u33["102"].floor, "First Floor");
check("Plus 33: interior area goes to areaBuilt", u33["101"].areaBuilt, 78);
check("Plus 33: covered veranda", u33["101"].areaVeranda, 35);
check("Plus 33: penthouse's uncovered terrace", u33["401"].areaVerandaOpen, 87);
check("Plus 33: footer", [p33.stage, p33.location, p33.mapsUrl, p33.websiteUrl, p33.version, p33.vatExcluded],
  ["Under Construction", "Universal - Paphos", "https://goo.gl/maps/eNuotzX4Enz2M9GC6", "https://bit.ly/3ogneqP", "2.41", true]);

/* ── the active-sheet rule, end to end ───────────────────────────────── */
const p87 = await P.parsePriceList(fx("plus-87.xml"));
const st = (p) => p.units.reduce((a, u) => (a[u.status] = (a[u.status] || 0) + 1, a), {});
check("Plus 87: 3 available, 1 reserved, 6 sold", st(p87), { sold: 6, reserved: 1, available: 3 });
check("Plus 87: its three prices", p87.units.filter((u) => u.price).map((u) => u.price), [315000, 360000, 370000]);
const u87 = byRef(p87);
check("Plus 87: '88 (78+10)' is 88 m² inside", u87["302"].areaBuilt, 88);
check("Plus 87: '3(2+1)' bedrooms keep their total first", u87["302"].beds, "3 (2+1)");
check("Plus 87: storage text is kept as written", u87["401"].storage, "1 Roof");
const p57 = await P.parsePriceList(fx("plus-57.xml"));
check("Plus 57: 35 units, 12 available", [p57.units.length, p57.units.filter((u) => u.status === "available").length], [35, 12]);
check("Plus 57: no three-price payment plan leaks in", p57.units.every((u) => u.price == null || u.price >= 245000), true);

/* ── the invariant, across every fixture ─────────────────────────────── */
for (const key of ["33", "57", "87", "63", "59", "67-68-69", "21"]) {
  const p = await P.parsePriceList(fx(`plus-${key}.xml`));
  check(`Plus ${key}: no sold or reserved unit carries a price`, p.units.filter((u) => u.status !== "available" && u.price != null).map((u) => u.ref), []);
}
const p67 = await P.parsePriceList(fx("plus-67-68-69.xml"));
check("Plus 67-68-69: the Project column qualifies refs, so 101 does not collide",
  new Set(p67.units.map((u) => u.ref)).size, p67.units.length);
```

- [ ] **Step 2: Write the PDF ground-truth check** — `scripts/qa/plus-pdf-check.mjs`

```js
#!/usr/bin/env node
/* Ground truth for the Plus Properties parser: the developer's own PDF.
   Their PDF is Excel's printout of the active sheet, so for every unit the
   parser returns, the PDF must show the same status — and, for an available
   unit, the same price. Measured on 2026-09-25 across all projects: 428 of 433
   units matched automatically, 4 more by hand (a PDF row wraps onto the next
   line), and the single difference was a unit the XML already knew had been
   reserved. Run: node scripts/qa/plus-pdf-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }
const scratch = join(process.cwd(), "node_modules", ".plus-pdf-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({ entryPoints: ["src/lib/plusProperties.ts"], bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
writeFileSync(join(scratch, "p.mjs"), out.outputFiles[0].text);
const P = await import(join(scratch, "p.mjs"));

const DIR = "scripts/qa/fixtures/plus";
const STATUS = /\b(Available|Reserved|Sold)\b/i;
const prices = (s) => Array.from(s.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)).map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => n >= 20000);
let failures = 0, matched = 0, total = 0;
for (const key of ["33", "57", "87", "63", "59", "67-68-69", "21", "60", "75"]) {
  const pdfPath = join(DIR, `plus-${key}.pdf.txt`);
  if (!existsSync(pdfPath)) { console.log(`  skip Plus ${key}: no PDF fixture`); continue; }
  const lines = readFileSync(pdfPath, "utf8").split("\n");
  const p = await P.parsePriceList(readFileSync(join(DIR, `plus-${key}.xml`), "utf8"));
  const used = new Set();
  const bad = [];
  for (const u of p.units) {
    total++;
    const pat = new RegExp(`(?<![\\w.])${u.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.])`);
    const i = lines.findIndex((l, n) => !used.has(n) && pat.test(l));
    if (i < 0) { bad.push(`${u.ref}: not in PDF`); continue; }
    used.add(i);
    /* A row can wrap: status and price may sit on the next line or two. */
    const window = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? ""];
    const hitLine = window.find((l) => STATUS.test(l)) ?? "";
    const pdfStatus = (hitLine.match(STATUS)?.[1] ?? "").toLowerCase();
    if (pdfStatus !== u.status) { bad.push(`${u.ref}: status parser=${u.status} pdf=${pdfStatus || "none"}`); continue; }
    if (u.status === "available" && !prices(window.join(" ")).includes(u.price)) {
      bad.push(`${u.ref}: price parser=${u.price} pdf=${prices(window.join(" ")).join("/") || "none"}`); continue;
    }
    matched++;
  }
  console.log(`  ${bad.length ? "FAIL" : "ok  "} Plus ${key}: ${p.units.length - bad.length} of ${p.units.length} units match the PDF`);
  for (const b of bad) console.log(`         ${b}`);
  if (bad.length) failures++;
}
console.log(`\n${matched} of ${total} units match their PDF`);
console.log(failures ? `${failures} project(s) failed` : "all passed");
process.exit(failures ? 1 : 0);
```

The villa fixtures (60, 75) and House Kiti are listed now and are expected to fail until Task 5. That is the point: Task 5's first step is to make them fail for the right reason.

- [ ] **Step 3: Run both to verify failure**

Run: `node scripts/qa/plus-parse-check.mjs; node scripts/qa/plus-pdf-check.mjs`
Expected: `P.parseStatus is not a function` in the first; the second fails on `P.parsePriceList`.

- [ ] **Step 4: Implement** — append to `src/lib/plusProperties.ts`

```ts
export type PlusStatus = "available" | "reserved" | "sold";
export type PlusStage = "Under Construction" | "Off Plan" | "Completed";

export type PlusUnit = {
  ref: string; label: string; block: string | null; floor: string | null;
  beds: string | null; baths: string | null; parking: string | null; storage: string | null;
  areaBuilt: number | null; areaVeranda: number | null; areaVerandaOpen: number | null;
  areaRoof: number | null; areaGarden: number | null; areaCommon: number | null;
  areaTotal: number | null; areaPlot: number | null;
  status: PlusStatus; price: number | null;
};

export type PlusProject = {
  sheetName: string; title: string | null; version: string | null; listDate: string | null;
  stage: PlusStage | null; location: string | null; mapsUrl: string | null; websiteUrl: string | null;
  vatExcluded: boolean; units: PlusUnit[]; notes: string[];
};

/* The unit vocabulary is closed — measured: Available, Reserved, Sold, with
   trailing spaces. Anything else fails the project it appears in rather than
   being mapped to a guess (Cybarco, 2026-09-24: one new mark was the only
   thing between a sold-out project and "on sale" again). */
export function parseStatus(raw: string): PlusStatus {
  const s = raw.trim().toLowerCase();
  if (s === "available") return "available";
  if (s === "reserved") return "reserved";
  if (s === "sold") return "sold";
  throw new PlusParseError(`unknown unit status "${raw}"`);
}

/* `stage` is free text across the system; each state maps to its most common
   existing spelling (measured 2026-09-25). "Understudy" is how this developer
   says a project is not yet under construction. */
export function projectStage(raw: string | null): PlusStage | null {
  if (raw == null || !raw.trim()) return null;
  const s = raw.toLowerCase().replace(/[-\s]+/g, " ").trim();
  if (s === "under construction") return "Under Construction";
  if (s === "understudy" || s === "under study") return "Off Plan";
  if (s === "ready to move in") return "Completed";
  throw new PlusParseError(`unknown project status "${raw}"`);
}

export function cleanNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]) * 100) / 100;
  return Number.isFinite(n) ? n : null;
}

/* "4 ( 3+1)", "3(2+1)", "2 (1+1)": the total, then how it splits (main floor +
   roof room, main house + guest house). Every reader of `beds` takes the FIRST
   number, so the total leads and the split is kept only for the eye. */
export function cleanBeds(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).replace(/\s+/g, "");
  const split = s.match(/^(\d+)\((\d+(?:\+\d+)+)\)$/);
  if (split) return `${split[1]} (${split[2]})`;
  const n = s.match(/^(\d+)(?:\.0+)?$/);
  if (n) return n[1];
  return String(raw).trim();
}

export function cleanText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return null;
  return /^-?\d+(?:\.\d+)?$/.test(s) ? String(cleanNumber(s)) : s;
}

const WHITE = "#FFFFFF";
const FOOTER_LABEL = /:\s*$/;
/* A styled but empty cell is still a <Cell>; the first cell that says
   something is what a row "starts with". */
const firstFilled = (r: Cell[]) => r.find((c) => c.value) ?? null;

/* Title, version, list date and the "Label:" rows under the table. Read from
   the whole sheet: House Kiti has no table, the same footer. The value sits in
   the next filled cell — column 1 in most lists, column 2 in Plus 60. */
function readMeta(rows: Cell[][]) {
  const cells = rows.flat();
  const footer = new Map<string, string>();
  for (const r of rows) {
    const first = firstFilled(r);
    if (!first || !FOOTER_LABEL.test(first.value)) continue;
    const next = r.find((c) => c.col > first.col && (c.value || c.href));
    footer.set(first.value.replace(/\s+/g, " ").trim().toLowerCase(), (next?.href || next?.value || "").trim());
  }
  const version = cells.map((c) => c.value.match(/Version:\s*([\d.]+)/i)?.[1]).find(Boolean) ?? null;
  const listDate = cells.map((c) => c.value.match(/^(\d{4}-\d\d-\d\d)T/)?.[1]).find(Boolean) ?? null;
  return {
    version, listDate,
    stage: projectStage(footer.get("project status:") ?? null),
    location: footer.get("location:") || null,
    mapsUrl: footer.get("google maps:") || null,
    websiteUrl: footer.get("link on website:") || null,
    price: cleanNumber(footer.get("price:") ?? null),
    vatExcluded: cells.some((c) => /do not include the vat|excluding vat|\+\s?vat/i.test(c.value)),
  };
}

function headerIndex(rows: Cell[][]): number {
  return rows.findIndex((r) => {
    const f = r.map((c) => columnField(c.value));
    return f.includes("unit") && (f.includes("status") || f.includes("price"));
  });
}

const normBlock = (s: string) => s.replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();

/* A price is read only for an available unit, only from the "price" column
   (never "Price €/OLD"), and never when the cell is white — that is how the
   developer hides the price of a unit that has sold. Measured: 36 white prices,
   all on sold (21) or reserved (15) units. */
function priceOf(cell: Cell | null, status: PlusStatus): number | null {
  if (status !== "available" || !cell || cell.colour === WHITE) return null;
  const n = cleanNumber(cell.value);
  return n != null && n >= 1000 ? n : null;
}

export async function parsePriceList(xml: string): Promise<PlusProject> {
  const sheet = activeSheet(await readWorkbook(xml));
  const rows = sheet.rows;
  const meta = readMeta(rows);
  const notes: string[] = [];
  if (!meta.vatExcluded) notes.push("the list does not say prices exclude VAT");
  const title = rows.slice(0, 6).flat().map((c) => c.value)
    .find((v) => v && !/version:/i.test(v) && !/^\d{4}-\d\d-\d\d/.test(v)) ?? null;
  const base = { sheetName: sheet.name, title, version: meta.version, listDate: meta.listDate, stage: meta.stage,
    location: meta.location, mapsUrl: meta.mapsUrl, websiteUrl: meta.websiteUrl, vatExcluded: meta.vatExcluded };

  const hi = headerIndex(rows);
  if (hi < 0) throw new PlusParseError(`no unit table on sheet "${sheet.name}"`);
  const field = new Map<number, Field>();
  for (const c of rows[hi]) {
    const f = columnField(c.value);
    if (f) field.set(c.col, f);
    else if (c.value) notes.push(`unknown column "${c.value}" ignored`);
  }

  const units: PlusUnit[] = [];
  let block: string | null = null;
  let floor: string | null = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const lead = firstFilled(r);
    if (!lead) continue;
    if (FOOTER_LABEL.test(lead.value)) break;
    const cell = (f: Field) => r.find((c) => field.get(c.col) === f) ?? null;
    const val = (f: Field) => cell(f)?.value || null;
    if (val("block")) block = normBlock(val("block")!);
    if (val("floor")) floor = val("floor");
    const name = val("unit");
    if (!name) continue;
    const statusRaw = val("status");
    if (!statusRaw) { notes.push(`unit ${name} has no status — skipped`); continue; }
    const status = parseStatus(statusRaw);
    units.push({
      ref: block ? `${block} ${name}` : name, label: name, block, floor,
      beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
      parking: cleanText(val("parking")), storage: cleanText(val("storage")),
      areaBuilt: cleanNumber(val("internal")), areaVeranda: cleanNumber(val("veranda")),
      areaVerandaOpen: cleanNumber(val("verandaOpen")), areaRoof: cleanNumber(val("roof")),
      areaGarden: cleanNumber(val("garden")), areaCommon: cleanNumber(val("common")),
      areaTotal: cleanNumber(val("total")), areaPlot: cleanNumber(val("plot")),
      status, price: priceOf(cell("price"), status),
    });
  }
  return { ...base, units, notes };
}
```

- [ ] **Step 5: Run both checks**

Run: `node scripts/qa/plus-parse-check.mjs && node scripts/qa/plus-pdf-check.mjs`
Expected: parse check `all passed`. PDF check: `ok` for 33, 57, 87, 63, 59, 67-68-69, 21; `FAIL` for 60 and 75 (handled in Task 5). If any other project fails, read the named unit's PDF line before changing code — the PDF is the truth.

- [ ] **Step 6: Mutation-test**

| Mutation | Search → replace | Must kill |
|---|---|---|
| white prices read | `if (status !== "available" \|\| !cell \|\| cell.colour === WHITE) return null;` → `if (status !== "available" \|\| !cell) return null;` | Plus 33 hidden price (via Plus 63 invariant too) |
| prices on sold units | same line → `if (!cell) return null;` | every "no sold or reserved unit carries a price" |
| floor not carried | `if (val("floor")) floor = val("floor");` → `floor = val("floor");` | Plus 33 floor carried |
| block not in ref | `ref: block ? \`${block} ${name}\` : name,` → `ref: name,` | Plus 67-68-69 refs do not collide |
| unknown status tolerated | `throw new PlusParseError(\`unknown unit status "${raw}"\`);` → `return "available";` | unknown unit status fails |

- [ ] **Step 7: Commit**

```bash
git add src/lib/plusProperties.ts scripts/qa/plus-parse-check.mjs scripts/qa/plus-pdf-check.mjs
git commit -m "Plus Properties parser: units, footer and status rules, checked against the PDFs"
```

---

### Task 5: The special layouts — two-row header, two-storey villas, a house

**Files:**
- Modify: `src/lib/plusProperties.ts`
- Modify: `scripts/qa/plus-parse-check.mjs`

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: `parsePriceList` additionally handles Plus 60, Plus 75 and House Kiti. No new exports.

Expected values, read from the raw XML with column indices and confirmed against the PDFs on 2026-09-25:

- **Plus 60** — five villas. Internal area is the sub-header's "Total Area" column (Villa 1: 176.3), plot 350.1 / 305.3 / 281 / 271 / 289.2, beds `4 (3+1)`. Villa 1 available €1,030,000; Villa 4 available €715,000; Villas 2, 3, 5 sold.
- **Plus 75** — besides its apartments, nine villas: C-Villas Villa 1–2 (available, €410,000), D-Villas Villa 1–7 (2, 6, 7 available at €310,000; 1, 3, 4, 5 sold). Each villa is two rows: the first carries the name in the Floor column and "Lower Floor" in the Unit column; the second carries "Upper Floor" and no name. C-Villa 1: beds 3 (0 + 3), baths 3 (1 + 2), areaBuilt 127 (65 + 62). D-Villa 1 is sold with only `Price €/OLD` filled — its price is `null`.
- **House Kiti** — one unit `House`: beds `5 (3+2)` (main house + guest house), baths `5 (3+2)`, areaBuilt 345.5, areaVeranda 41.6, areaVerandaOpen 118, areaGarden 401, areaPlot 883, price €880,000, status `available` (assumed — the sheet has no status word; the parser adds a note saying so).

- [ ] **Step 1: Add the failing tests** — before the final `console.log` of `plus-parse-check.mjs`

```js
/* ── Plus 60: "Villa No" and a two-row header ─────────────────────────── */
const p60 = await P.parsePriceList(fx("plus-60.xml"));
const u60 = byRef(p60);
check("Plus 60: five villas", p60.units.map((u) => u.ref), ["Villa 1", "Villa 2", "Villa 3", "Villa 4", "Villa 5"]);
check("Plus 60: statuses", p60.units.map((u) => u.status), ["available", "sold", "sold", "available", "sold"]);
check("Plus 60: prices", [u60["Villa 1"].price, u60["Villa 4"].price], [1030000, 715000]);
/* The sub-header splits "Internal Area" into Gr.Floor / 1st / 2nd / Total;
   the unit's interior is that Total, not the villa's overall total area. */
check("Plus 60: interior is the sub-header's total", u60["Villa 1"].areaBuilt, 176.3);
check("Plus 60: …not the villa's overall total", u60["Villa 1"].areaTotal, 280);
check("Plus 60: plot area", u60["Villa 1"].areaPlot, 350.1);
check("Plus 60: '4 ( 3+1)' bedrooms, total first", u60["Villa 1"].beds, "4 (3+1)");
check("Plus 60: parking area loses Excel noise", u60["Villa 1"].parking, "17.6");

/* ── Plus 75: villas over two rows with swapped columns ──────────────── */
const p75 = await P.parsePriceList(fx("plus-75.xml"));
const villas = p75.units.filter((u) => /Villa \d/.test(u.label));
check("Plus 75: nine villas", villas.map((u) => u.ref), [
  "C-Villas Villa 1", "C-Villas Villa 2",
  "D-Villas Villa 1", "D-Villas Villa 2", "D-Villas Villa 3", "D-Villas Villa 4",
  "D-Villas Villa 5", "D-Villas Villa 6", "D-Villas Villa 7"]);
const v = byRef(p75);
check("Plus 75: a storey is never a unit", p75.units.some((u) => /floor$/i.test(u.label)), false);
check("Plus 75: C-Villa 1 beds summed over both storeys", v["C-Villas Villa 1"].beds, "3");
check("Plus 75: …baths summed", v["C-Villas Villa 1"].baths, "3");
check("Plus 75: …interior summed", v["C-Villas Villa 1"].areaBuilt, 127);
check("Plus 75: C-Villa 1 price from 'Price €', not OLD", v["C-Villas Villa 1"].price, 410000);
/* D-Villa 1 is sold and only its OLD price (370,000) is filled. Reading OLD as
   a fallback would publish a stale price on a sold villa. */
check("Plus 75: a sold villa with only an OLD price has no price", v["D-Villas Villa 1"].price, null);
check("Plus 75: D-Villa 4's white price is not read", v["D-Villas Villa 4"].price, null);
check("Plus 75: available D-villas", ["2", "6", "7"].map((n) => v[`D-Villas Villa ${n}`].price), [310000, 310000, 310000]);
check("Plus 75: no villa floor is 'Villa N'", villas.every((u) => !/villa/i.test(u.floor ?? "")), true);

/* ── House Kiti: a house, not a table ─────────────────────────────────── */
const kiti = await P.parsePriceList(fx("plus-house-kiti.xml"));
check("House Kiti: one unit", kiti.units.length, 1);
const h = kiti.units[0];
check("House Kiti: the house", [h.ref, h.beds, h.baths, h.areaBuilt, h.areaVeranda, h.areaVerandaOpen, h.areaGarden, h.areaPlot, h.price],
  ["House", "5 (3+2)", "5 (3+2)", 345.5, 41.6, 118, 401, 883, 880000]);
check("House Kiti: status is an assumption, and says so", [h.status, kiti.notes.some((n) => /status assumed/.test(n))], ["available", true]);
check("House Kiti: footer", [kiti.stage, kiti.location], ["Completed", "Kiti - Larnaca"]);
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/qa/plus-parse-check.mjs`
Expected: `FAIL` on the Plus 60 and 75 checks, and a thrown `no unit table on sheet "Kiti House"`.

- [ ] **Step 3: Implement** — in `src/lib/plusProperties.ts`

Add these helpers above `parsePriceList`:

```ts
const STOREY = /^(lower|upper|ground|first|second|1st|2nd)\s+floor$/i;

const sumNum = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.round((a + b) * 100) / 100);
const sumCount = (a: string | null, b: string | null) => {
  const n = (s: string | null) => (s && /^\d+$/.test(s) ? Number(s) : null);
  if (n(a) == null && n(b) == null) return a ?? b;
  return String((n(a) ?? 0) + (n(b) ?? 0));
};

/* A villa's second storey continues the unit the first storey opened: counts
   and areas add up, nothing else changes (status and price live on the first
   row). Measured on Plus 75, 2026-09-25. */
function addStorey(u: PlusUnit, s: PlusUnit): void {
  u.beds = sumCount(u.beds, s.beds);
  u.baths = sumCount(u.baths, s.baths);
  u.areaBuilt = sumNum(u.areaBuilt, s.areaBuilt);
  u.areaVeranda = sumNum(u.areaVeranda, s.areaVeranda);
  u.areaVerandaOpen = sumNum(u.areaVerandaOpen, s.areaVerandaOpen);
  u.areaRoof = sumNum(u.areaRoof, s.areaRoof);
  u.areaGarden = sumNum(u.areaGarden, s.areaGarden);
  u.areaTotal = sumNum(u.areaTotal, s.areaTotal);
}

/* House Kiti: label/value pairs laid out in column pairs (0/1, 3/4, 6/7, 9/10)
   for the main house, guest house and services. Areas carry "SQM"; a bare
   number beside an area label is a count and is not read as an area. Bedrooms
   and bathrooms are totalled over both buildings with the split kept, main house
   first ("5 (3+2)"), the same shape cleanBeds gives a table row. */
function parseHouse(rows: Cell[][], price: number | null): PlusUnit | null {
  if (price == null) return null;
  const pairs: { col: number; label: string; value: string }[] = [];
  for (const r of rows) for (const c of r) {
    const next = r.find((d) => d.col === c.col + 1);
    if (next && c.value && !FOOTER_LABEL.test(c.value)) pairs.push({ col: c.col, label: c.value.toLowerCase(), value: next.value });
  }
  const area = (re: RegExp) => pairs.filter((p) => re.test(p.label) && /sqm/i.test(p.value))
    .reduce<number | null>((s, p) => sumNum(s, cleanNumber(p.value)), null);
  const perBuilding = (re: RegExp) => {
    const parts = pairs.filter((p) => re.test(p.label)).sort((a, b) => a.col - b.col)
      .map((p) => cleanNumber(p.value)).filter((n): n is number => n != null);
    if (!parts.length) return null;
    const total = parts.reduce((a, b) => a + b, 0);
    return parts.length > 1 ? `${total} (${parts.join("+")})` : String(total);
  };
  return {
    ref: "House", label: "House", block: null, floor: null,
    beds: perBuilding(/number of bedrooms/), baths: perBuilding(/number of bathrooms/),
    parking: pairs.find((p) => /parking/.test(p.label))?.value ?? null,
    storage: pairs.find((p) => /storage/.test(p.label))?.value ?? null,
    areaBuilt: area(/^internal area$/), areaVeranda: area(/^covered veranda$/),
    areaVerandaOpen: area(/^uncovered (terrace|veranda)$/), areaRoof: null,
    areaGarden: area(/garden/), areaCommon: null, areaTotal: null, areaPlot: area(/^plot area$/),
    status: "available", price,
  };
}
```

In `parsePriceList`, replace the line `if (hi < 0) throw new PlusParseError(\`no unit table on sheet "${sheet.name}"\`);` with:

```ts
  if (hi < 0) {
    const house = parseHouse(rows, meta.price);
    if (!house) throw new PlusParseError(`no unit table on sheet "${sheet.name}"`);
    return { ...base, units: [house], notes: [...notes, "single-house layout; status assumed available (the sheet has no status word)"] };
  }
```

After the header-mapping loop (before `const units: PlusUnit[] = [];`), add the two-row header:

```ts
  /* Plus 60: a second header row labels sub-columns under one heading
     (Gr.Floor / 1st Floor / 2nd Floor / Total Area under "Internal Area").
     The unit's interior is that sub-row's Total; the storey columns are not
     read. */
  let start = hi + 1;
  const sub = (rows[start] ?? []).filter((c) => c.value);
  if (sub.length >= 2 && sub.every((c) => /floor|total area/i.test(c.value))) {
    for (const c of sub) field.set(c.col, "ignore");
    const total = sub.find((c) => /total area/i.test(c.value));
    if (total) field.set(total.col, "internal");
    start++;
  }
```

and change the loop header from `for (let i = hi + 1; i < rows.length; i++) {` to `for (let i = start; i < rows.length; i++) {`.

Inside the loop, replace the three lines

```ts
    if (val("floor")) floor = val("floor");
    const name = val("unit");
    if (!name) continue;
```

with

```ts
    const unitVal = val("unit");
    /* Plus 75's villas swap two columns: the villa's NAME sits in the Floor
       column and the STOREY in the Unit column. The first storey opens the
       villa (name, status, price live there); a following storey row with no
       name continues it. */
    if (unitVal && STOREY.test(unitVal)) {
      const villaName = val("floor");
      const last = units[units.length - 1];
      if (villaName) {
        const statusRaw = val("status");
        if (!statusRaw) { notes.push(`villa ${villaName} has no status — skipped`); continue; }
        const status = parseStatus(statusRaw);
        units.push({
          ref: block ? `${block} ${villaName}` : villaName, label: villaName, block, floor: null,
          beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
          parking: cleanText(val("parking")), storage: cleanText(val("storage")),
          areaBuilt: cleanNumber(val("internal")), areaVeranda: cleanNumber(val("veranda")),
          areaVerandaOpen: cleanNumber(val("verandaOpen")), areaRoof: cleanNumber(val("roof")),
          areaGarden: cleanNumber(val("garden")), areaCommon: cleanNumber(val("common")),
          areaTotal: cleanNumber(val("total")), areaPlot: cleanNumber(val("plot")),
          status, price: priceOf(cell("price"), status),
        });
      } else if (last && last.floor === null) {
        addStorey(last, {
          ...last, beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
          areaBuilt: cleanNumber(val("internal")), areaVeranda: cleanNumber(val("veranda")),
          areaVerandaOpen: cleanNumber(val("verandaOpen")), areaRoof: cleanNumber(val("roof")),
          areaGarden: cleanNumber(val("garden")), areaTotal: cleanNumber(val("total")),
        });
      }
      continue;
    }
    if (val("floor")) floor = val("floor");
    const name = unitVal;
    if (!name) continue;
```

- [ ] **Step 4: Run both checks**

Run: `node scripts/qa/plus-parse-check.mjs && node scripts/qa/plus-pdf-check.mjs`
Expected: both `all passed`; the PDF check now includes Plus 60 and 75 at full match.

- [ ] **Step 5: Mutation-test**

| Mutation | Search → replace | Must kill |
|---|---|---|
| sub-header ignored | `if (total) field.set(total.col, "internal");` → delete the line | Plus 60 interior is the sub-header's total |
| storeys become units | `if (unitVal && STOREY.test(unitVal)) {` → `if (false) {` | a storey is never a unit; nine villas |
| storeys not summed | in `addStorey`, `u.baths = sumCount(u.baths, s.baths);` → `u.baths = s.baths;` | C-Villa 1 baths summed (1 + 2; beds cannot kill this — the lower storey has none) |
| house areas without SQM | in `parseHouse`, `/sqm/i.test(p.value)` → `true` | House Kiti areaVerandaOpen 118 |

No mutation here for the OLD-price fallback, on purpose: in the fixtures no AVAILABLE unit lacks a current price, so a fallback added inside the villa branch would change nothing a test can see (D-Villa 1 is sold, and sold units never carry a price anyway). The fallback is guarded where it could actually happen — Task 3's `Price €/OLD → priceOld` mapping and its mutation — and `priceOf` only ever receives `cell("price")`. Say so in the commit message rather than writing a mutation that cannot land.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plusProperties.ts scripts/qa/plus-parse-check.mjs
git commit -m "Plus Properties parser: two-row header, two-storey villas and the single house"
```

---

### Task 6: Sync helpers — identity, coordinates, website facts, decisions

**Files:**
- Create: `src/lib/plusPropertiesSync.ts` (helpers only in this task)
- Create: `scripts/qa/plus-sync-check.mjs`

**Interfaces:**
- Consumes: `PlusUnit` (Task 4); `countableFeedUnits(units, isPublished)` and `completenessVerdict(before, after, absFloor, pct?)` from `src/lib/feedSync.ts`.
- Produces:
  - constants `PLUS_DEV = "plusproperties"`, `PLUS_ACCOUNT_SLUG = "plus-properties"`, `PLUS_XML_FOLDER`, `PLUS_PDF_FOLDER`, `PLUS_PROJECTS_FOLDER`, `PLUS_INCOMPLETE_ABS_FLOOR = 3`
  - `projectKey(name: string): string | null`
  - `publicNameFor(key: string): string`
  - `feedKeyFor(key: string): string`
  - `slugCandidate(publicName: string): string`
  - `splitLocation(location: string | null): { town: string | null; district: string | null }`
  - `coordsFromMapsUrl(url: string | null): { lat: number; lng: number } | null`
  - `projectDetails(html: string): { facts: string[]; energy: string | null }`
  - `detailFields(d: { facts: string[]; energy: string | null } | null): { description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string }` — only the keys it has something for
  - `unitsDecision(input: { published: boolean; stored: { status: string | null }[]; fresh: { status: string }[] }): { blocked: boolean; message: string | null }`
  - `runVerdict(input: { attempted: number; failed: number }): { ok: boolean; reason: string | null }`
  - `MANUAL_UNIT_FIELDS` (readonly tuple), `carryOverManualUnitFields(kept: Record<string, unknown> | null | undefined): Record<string, unknown>`
  - `unitRow(u: PlusUnit, developmentId: string, index: number, kept?: Record<string, unknown> | null): Record<string, unknown>`

- [ ] **Step 1: Write the failing test** — `scripts/qa/plus-sync-check.mjs`

```js
#!/usr/bin/env node
/* Guard for the Plus Properties sync helpers (src/lib/plusPropertiesSync.ts).
   Run: node scripts/qa/plus-sync-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }
/* plusPropertiesSync imports @/lib/prisma, which constructs a PrismaClient at
   load. Nothing here queries; the constructor only needs a URL. .env.local is
   the LIVE database — never let this script read it. */
process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
const scratch = join(process.cwd(), "node_modules", ".plus-sync-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({ entryPoints: ["src/lib/plusPropertiesSync.ts"], bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client/default", "@anthropic-ai/sdk", "canvas", "sharp"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
writeFileSync(join(scratch, "s.mjs"), out.outputFiles[0].text);
const S = await import(join(scratch, "s.mjs"));

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

/* ── identity ─────────────────────────────────────────────────────────────
   The key is the project NUMBER. File names change with every version; the
   media folders spell the same number differently. */
const K = S.projectKey;
check("price list", K("Plus 33 Universal - Paphos - Price List   2.41.xml"), "33");
check("media folder", K("Plus 33 (Universal)"), "33");
check("underscored group", K("Plus 67_68_69 Parekklisia - Limassol - Price List  3.3.xml"), "67-68-69");
check("…and its folder", K("Plus 67-68-69 (Parekklisia)"), "67-68-69");
check("hyphen pair", K("Plus 70-71 Era Area - Larnaca -Price List  5.5.xml"), "70-71");
/* "PLUS 4 - 502 Penthouse": the 502 is a unit number, not a joined project. */
check("a spaced dash never joins a unit number", K("PLUS 4 - 502 Penthouse"), "4");
check("no space after Plus", K("Plus 1(Glyfada)"), "1");
check("the house", K("House Kiti- Price List  1.2.xml"), "house-kiti");
check("unrelated file", K("Readme.docx"), null);
check("public names", [S.publicNameFor("33"), S.publicNameFor("67-68-69"), S.publicNameFor("house-kiti")], ["Plus 33", "Plus 67-68-69", "House Kiti"]);
check("feed key", S.feedKeyFor("33"), "plusproperties:33");
check("slug candidate, as publish would mint it", [S.slugCandidate("Plus 33"), S.slugCandidate("Plus 67-68-69")], ["plus-33", "plus-67-68-69"]);
check("location: town and district", S.splitLocation("Universal - Paphos"), { town: "Universal", district: "Paphos" });
check("location: en dash", S.splitLocation("Livadia – Larnaca"), { town: "Livadia", district: "Larnaca" });
check("location: district only", S.splitLocation("Larnaca"), { town: null, district: "Larnaca" });
/* Plus 60 writes it with no spaces; the district is after the LAST dash. */
check("location: no spaces round the dash", S.splitLocation("Agios Tychonas-Limassol"), { town: "Agios Tychonas", district: "Limassol" });

/* ── coordinates from the resolved Maps link ─────────────────────────────
   The pin (!3d/!4d) wins over the viewport centre (@lat,lng) — they differ. */
const P33 = "https://www.google.com/maps/place/Plus+33+Residence/@34.7626655,32.4289652,17z/data=!3m1!4b1!4m5!3m4!1s0x14e7073a5d7a1f6d:0x7f3107e95284c35b!8m2!3d34.7626611!4d32.4311539?shorturl=1";
check("pin coordinates", S.coordsFromMapsUrl(P33), { lat: 34.7626611, lng: 32.4311539 });
check("viewport as fallback", S.coordsFromMapsUrl("https://www.google.com/maps/@34.9,33.6,15z"), { lat: 34.9, lng: 33.6 });
check("?q= form", S.coordsFromMapsUrl("https://maps.google.com/?q=34.95,33.62"), { lat: 34.95, lng: 33.62 });
check("outside Cyprus is rejected", S.coordsFromMapsUrl("https://www.google.com/maps/@37.9,23.7,15z"), null);
check("no link", S.coordsFromMapsUrl(null), null);

/* ── Project Details from their website ──────────────────────────────── */
const d = S.projectDetails(readFileSync("scripts/qa/fixtures/plus/plus-33-page.html", "utf8"));
check("facts read from the list", d.facts.length, 9);
check("…in order", [d.facts[0], d.facts[4]], ["Luxurious Design", "Common Swimming Pool"]);
check("energy class pulled out", d.energy, "A");
check("…and not repeated as a fact", d.facts.some((f) => /energy/i.test(f)), false);
check("a page without the block yields nothing", S.projectDetails("<html><body><p>Hello</p></body></html>"), { facts: [], energy: null });
const df = S.detailFields({ facts: ["Common Swimming Pool", "Completion: Q4 2027", "6 minutes from the Beach"], energy: "A" });
check("facts become the raw description, one per line", df.description, "Common Swimming Pool\nCompletion: Q4 2027\n6 minutes from the Beach");
check("plain facts are amenities", df.amenities, ["Common Swimming Pool", "6 minutes from the Beach"]);
check("'Label: value' facts are extra facts", df.extraFacts, [{ label: "Completion", value: "Q4 2027" }]);
check("energy class", df.energy, "A");
check("nothing read, nothing written", S.detailFields(null), {});

/* ── completeness, per project ───────────────────────────────────────────
   Plus projects hold 4 to 63 units; the feeds' floor of 20 would never fire. */
const sts = (...s) => s.map((status) => ({ status }));
check("a small project losing most units is blocked",
  S.unitsDecision({ published: false, stored: sts("available", "available", "available", "available", "sold", "sold"), fresh: sts("available", "sold") }).blocked, true);
check("…losing exactly 3 is not (the floor is strict)",
  S.unitsDecision({ published: false, stored: sts("available", "available", "available", "sold", "sold", "sold"), fresh: sts("sold", "sold", "sold") }).blocked, false);
check("published: sold units do not count", 
  S.unitsDecision({ published: true, stored: sts("sold", "sold", "sold", "sold", "sold", "available"), fresh: sts("available") }).blocked, false);
check("unlisted stored units never count",
  S.unitsDecision({ published: true, stored: sts("unlisted", "unlisted", "unlisted", "unlisted", "unlisted", "available"), fresh: sts("available") }).blocked, false);
check("a first sync is never blocked", S.unitsDecision({ published: false, stored: [], fresh: sts("available") }).blocked, false);
check("the message names the numbers",
  /4 of 6 units/.test(S.unitsDecision({ published: false, stored: sts("available", "available", "available", "available", "available", "available"), fresh: sts("available", "available") }).message ?? ""), true);

check("run verdict: most requests failed", S.runVerdict({ attempted: 40, failed: 21 }).ok, false);
check("run verdict: half is not most", S.runVerdict({ attempted: 40, failed: 20 }).ok, true);
check("run verdict: nothing attempted", S.runVerdict({ attempted: 0, failed: 0 }).ok, true);

/* ── unit rows ─────────────────────────────────────────────────────────── */
const u = { ref: "A101", label: "A101", block: null, floor: "First Floor", beds: "2", baths: "2", parking: "Covered", storage: "1",
  areaBuilt: 78, areaVeranda: 35, areaVerandaOpen: null, areaRoof: null, areaGarden: null, areaCommon: 12, areaTotal: 125, areaPlot: null,
  status: "available", price: 350000 };
const row = S.unitRow(u, "dev1", 0);
check("the public table's area field is filled", [row.areaBuilt, row.areaInternal, row.areaVeranda], ["78", "78", "35"]);
check("storage is the yes/no column", row.storage, "yes");
check("'1 Roof' is a storage room (Plus 87)", S.unitRow({ ...u, storage: "1 Roof" }, "d", 0).storage, "yes");
check("'0' is none", S.unitRow({ ...u, storage: "0" }, "d", 0).storage, "no");
check("counts and extra areas go to attrs",
  row.attrs, [{ name: "Parking", value: "Covered" }, { name: "Storage rooms", value: "1" }, { name: "Common area (m²)", value: "12" }, { name: "Total area (m²)", value: "125" }]);
check("identity", [row.ref, row.feedRef, row.source, row.developmentId], ["A101", "A101", "feed", "dev1"]);
check("a sold unit never carries a price, even if handed one", S.unitRow({ ...u, status: "sold" }, "d", 0).price, null);
const kept = { type: "Penthouse", photos: ["/x.webp"], plans: null, price: 1, status: "sold", areaBuilt: "999" };
const withKept = S.unitRow(u, "d", 0, kept);
check("a hand-set type survives", withKept.type, "Penthouse");
check("hand-set photos survive", withKept.photos, ["/x.webp"]);
check("…but the sheet owns price, status and areas", [withKept.price, withKept.status, withKept.areaBuilt], [350000, "available", "78"]);
check("nulls are not carried", "plans" in withKept, false);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/qa/plus-sync-check.mjs`
Expected: build error — `Could not resolve "src/lib/plusPropertiesSync.ts"`.

- [ ] **Step 3: Implement** — `src/lib/plusPropertiesSync.ts` (helpers; the writer follows in Task 7)

```ts
import { parse as parseHtml } from "node-html-parser";
import { countableFeedUnits, completenessVerdict } from "./feedSync";
import { cleanNumber, type PlusUnit } from "./plusProperties";

/* Plus Properties sync. Spec:
   docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
   The pure helpers come first; syncPlusProperties() at the bottom is the only
   code here that touches the database, Drive or the network. */

export const PLUS_DEV = "plusproperties";
export const PLUS_ACCOUNT_SLUG = "plus-properties";
export const PLUS_XML_FOLDER = "1xeFHfoMUGpyAPMgUMe9qMHmyRvyOdnMu";
export const PLUS_PDF_FOLDER = "14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ";
export const PLUS_PROJECTS_FOLDER = "1aXXbOSp_-10rLlHHixQzGR-RKnc342AN";
/* The feeds' floor of 20 units cannot bind here: Plus projects hold 4 to 63
   units, so most of them could lose everything without tripping it. 3 is
   Mito's floor, chosen for the same reason. */
export const PLUS_INCOMPLETE_ABS_FLOOR = 3;

/* The project NUMBER is the identity. Price-list names change with every
   version, and the media tree spells the same number differently. Joined
   numbers use "-" or "_" with no spaces ("67_68_69", "70-71"); a spaced dash
   is not a join ("PLUS 4 - 502 Penthouse" is project 4, unit 502). */
export function projectKey(name: string): string | null {
  if (/house\s*-?\s*kiti/i.test(name)) return "house-kiti";
  const m = name.match(/plus\s*(\d+(?:[-_]\d+)*)/i);
  return m ? m[1].replace(/_/g, "-") : null;
}

export const publicNameFor = (key: string) => (key === "house-kiti" ? "House Kiti" : `Plus ${key}`);
export const feedKeyFor = (key: string) => `${PLUS_DEV}:${key}`;

/* What uniqueDevelopmentSlug() will mint from the public name on publish. The
   connector never writes a slug; the dry run uses this to warn about a clash. */
export const slugCandidate = (publicName: string) =>
  publicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function splitLocation(location: string | null): { town: string | null; district: string | null } {
  if (!location || !location.trim()) return { town: null, district: null };
  /* Greedy: the district is after the LAST dash, spaced or not ("Universal -
     Paphos", "Livadia – Larnaca", "Agios Tychonas-Limassol"). */
  const m = location.trim().match(/^(.*\S)\s*[-–]\s*(\S.*)$/);
  return m ? { town: m[1].trim(), district: m[2].trim() } : { town: null, district: location.trim() };
}

/* The pin (!3d<lat>!4d<lng>) is the place; @lat,lng is only where the map was
   centred, and the two differ (Plus 33: 32.4312 vs 32.4290). Anything outside
   Cyprus is a wrong link, not a location. */
export function coordsFromMapsUrl(url: string | null): { lat: number; lng: number } | null {
  if (!url) return null;
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    ?? url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat > 34.4 && lat < 35.8 && lng > 32.2 && lng < 34.7 ? { lat, lng } : null;
}

/* Only the "Project Details" block of the developer's page: a <strong> label,
   then a <ul>. Raw facts for the AI description generator and the amenity
   list; the operator reviews every draft before it is published. */
export function projectDetails(html: string): { facts: string[]; energy: string | null } {
  const root = parseHtml(html);
  const label = root.querySelectorAll("strong").find((s) => /project details/i.test(s.text));
  let el = label?.parentNode?.nextElementSibling ?? null;
  while (el && el.tagName !== "UL") el = el.nextElementSibling;
  if (!el) return { facts: [], energy: null };
  const all = el.querySelectorAll("li").map((li) => li.text.replace(/\s+/g, " ").trim()).filter(Boolean);
  const energyFact = all.find((f) => /energy/i.test(f)) ?? null;
  const energy = energyFact?.match(/:\s*([A-G]\+?)\s*$/i)?.[1]?.toUpperCase() ?? null;
  return { facts: all.filter((f) => f !== energyFact), energy };
}

/* How the website's facts land on a Development, per the spec's field mapping:
   all of them, one per line, as the raw `description` the AI generator starts
   from; plain ones ("Common Swimming Pool") as amenities; "Label: value" ones
   as extra facts. The operator reviews every draft before it is published. */
export function detailFields(d: { facts: string[]; energy: string | null } | null): {
  description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string;
} {
  if (!d) return {};
  const out: { description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string } = {};
  if (d.facts.length) out.description = d.facts.join("\n");
  const plain = d.facts.filter((f) => !/^[^:]{2,40}:\s*\S/.test(f));
  const labelled = d.facts.filter((f) => /^[^:]{2,40}:\s*\S/.test(f)).map((f) => {
    const i = f.indexOf(":");
    return { label: f.slice(0, i).trim(), value: f.slice(i + 1).trim() };
  });
  if (plain.length) out.amenities = plain;
  if (labelled.length) out.extraFacts = labelled;
  if (d.energy) out.energy = d.energy;
  return out;
}

/* The feeds' completeness rule, per project: count only what this sync can
   change (countableFeedUnits), never units already flagged unlisted. */
export function unitsDecision(input: {
  published: boolean;
  stored: { status: string | null }[];
  fresh: { status: string }[];
}): { blocked: boolean; message: string | null } {
  const before = countableFeedUnits(input.stored.filter((u) => u.status !== "unlisted"), input.published);
  const after = countableFeedUnits(input.fresh, input.published);
  const v = completenessVerdict(before, after, PLUS_INCOMPLETE_ABS_FLOOR);
  return v.blocked
    ? { blocked: true, message: `${v.missing} of ${before} units are missing from the price list (${v.pctLabel} %). Nothing was changed.` }
    : { blocked: false, message: null };
}

/* A run that lost most of its Drive requests (an expired token, an outage)
   writes nothing, rather than reading 35 projects as empty. */
export function runVerdict(input: { attempted: number; failed: number }): { ok: boolean; reason: string | null } {
  if (input.attempted > 0 && input.failed * 2 > input.attempted) {
    return { ok: false, reason: `${input.failed} of ${input.attempted} Drive request(s) failed — nothing was written` };
  }
  return { ok: true, reason: null };
}

/* Exactly "what the admin unit editor can write and this sync does not" —
   carried over by unit ref so hand-set values survive every run (Cybarco,
   2026-09-24). If the sync ever starts writing one of these, it comes off
   this list in the same commit. */
export const MANUAL_UNIT_FIELDS = ["type", "unitNumber", "guestWc", "orientation", "amenities", "photos", "plans"] as const;

export function carryOverManualUnitFields(kept: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!kept) return {};
  const out: Record<string, unknown> = {};
  for (const f of MANUAL_UNIT_FIELDS) {
    const v = kept[f];
    if (v !== null && v !== undefined) out[f] = v;
  }
  return out;
}

const str = (n: number | null) => (n == null ? null : String(n));

/* One DevelopmentUnit row. areaBuilt is what the public unit table shows
   (Covered Area = areaBuilt + areaVeranda, as for Island Blue), so the interior
   goes there as well as to areaInternal. `storage` is a yes/no column; the
   count lives in attrs. A price only ever travels with an available unit. */
export function unitRow(u: PlusUnit, developmentId: string, index: number, kept?: Record<string, unknown> | null): Record<string, unknown> {
  const attrs: { name: string; value: string }[] = [];
  const add = (name: string, v: string | number | null) => { if (v != null && v !== "") attrs.push({ name, value: String(v) }); };
  add("Parking", u.parking);
  add("Storage rooms", u.storage);
  add("Roof terrace (m²)", u.areaRoof);
  add("Garden (m²)", u.areaGarden);
  add("Common area (m²)", u.areaCommon);
  add("Total area (m²)", u.areaTotal);
  const storageCount = cleanNumber(u.storage) ?? 0;
  return {
    ...carryOverManualUnitFields(kept),
    developmentId, source: "feed",
    ref: u.ref, feedRef: u.ref, label: u.label,
    status: u.status, price: u.status === "available" ? u.price : null, currency: "EUR",
    beds: u.beds, baths: u.baths, floor: u.floor,
    /* "1", "1 Roof", "Yes" → yes. */
    storage: u.storage == null ? null : storageCount > 0 || /yes/i.test(u.storage) ? "yes" : "no",
    areaBuilt: str(u.areaBuilt), areaInternal: str(u.areaBuilt),
    areaVeranda: str(u.areaVeranda), areaVerandaOpen: str(u.areaVerandaOpen), areaPlot: str(u.areaPlot),
    attrs, sortIndex: index,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/qa/plus-sync-check.mjs`
Expected: `all passed`. If `projectDetails` returns 0 facts, print `el?.tagName` for the fixture: `nextElementSibling` must reach the `<ul>`; adjust the walk, not the fixture.

- [ ] **Step 5: Mutation-test**

| Mutation | Search → replace | Must kill |
|---|---|---|
| floor of 20 | `export const PLUS_INCOMPLETE_ABS_FLOOR = 3;` → `= 20;` | small project blocked |
| unlisted counted | `input.stored.filter((u) => u.status !== "unlisted")` → `input.stored` | unlisted stored units never count |
| viewport before pin | swap the `!3d` and `@` lines in `coordsFromMapsUrl` | pin coordinates |
| spaced dash joins | `/plus\s*(\d+(?:[-_]\d+)*)/i` → `/plus\s*(\d+(?:\s*[-_]\s*\d+)*)/i` | spaced dash never joins |
| price on sold | `price: u.status === "available" ? u.price : null,` → `price: u.price,` | sold unit never carries a price |
| manual type dropped | `"type", "unitNumber",` → `"unitNumber",` | hand-set type survives |

- [ ] **Step 6: Commit**

```bash
git add src/lib/plusPropertiesSync.ts scripts/qa/plus-sync-check.mjs
git commit -m "Plus Properties sync: identity, coordinates, website facts and write decisions"
```

---

### Task 7: The writer — gather, then write per project

**Files:**
- Modify: `src/lib/plusPropertiesSync.ts`
- Modify: `scripts/qa/plus-sync-check.mjs`

**Interfaces:**
- Consumes: Task 6 helpers; `parsePriceList` (Task 4); from `./googleDrive`: `getAccessToken(): Promise<string>`, `listFolder(folderId, token): Promise<DriveFile[]>`, `collectMedia(folderId, token, opts?): Promise<{ images: DriveFile[]; plans: DriveFile[]; sig: string }>`, `downloadFile(fileId, token): Promise<Buffer>`; from `./imageMirror`: `storeUploadedImage(buf, devKey): Promise<string | null>`, `pdfPagesToJpegs(buf, maxPages?): Promise<Buffer[]>`, `devKeyFor(feedKey): string`, `beginSyncWindow(label): () => void`, `scheduleAppRestart(): void`; `recomputeDevelopmentDerivedState(id)` from `./developmentDerivedState`; `logCronRun(job, ok, message?)` from `./cronLog`; `prisma` from `./prisma`.
- Produces:
  - `type PlusPlanRow = { key: string; publicName: string; source: "xml" | "pdf-only"; exists: boolean; published: boolean; units: { available: number; reserved: number; sold: number }; images: number; plans: number; coords: boolean; facts: number; slug: string; slugTaken: boolean; blocked: string | null; notes: string[] }`
  - `type PlusRunResult = { ok: boolean; reason: string | null; dryRun: boolean; projects: number; created: number; units: number; failed: string[]; blocked: string[]; notes: string[]; plan: PlusPlanRow[] }`
  - `syncPlusProperties(accountId: string, opts?: { force?: boolean; dryRun?: boolean }): Promise<PlusRunResult>`

- [ ] **Step 1: Add the failing wiring checks** — before the final `console.log` of `plus-sync-check.mjs`

```js
/* ── the writer's wiring ──────────────────────────────────────────────────
   The writer talks to Drive and the database, so its guarantees are checked
   on the source; the decisions it delegates are tested above. */
const src = readFileSync("src/lib/plusPropertiesSync.ts", "utf8");
check("writer exported", typeof S.syncPlusProperties, "function");
check("gather finishes before any write: the verdict gates the write loop",
  src.indexOf("runVerdict({ attempted") < src.indexOf("prisma.development.create"), true);
check("each project is isolated in its own try/catch",
  /for \(const g of gathered\) \{\s*try \{/.test(src), true);
check("a blocked project logs ok=false", /logCronRun\(`plus-incomplete:\$\{g\.key\}`, false,/.test(src), true);
check("a clean project logs ok=true on the same key", /logCronRun\(`plus-incomplete:\$\{g\.key\}`, true,/.test(src), true);
check("published projects are frozen", /published \? freezeForPublished\(row, existing\) : row/.test(src), true);
check("drafts are rewritten, published units are unlisted not deleted",
  /deleteMany\(\{ where: \{ developmentId: dev\.id, source: "feed" \} \}\)/.test(src) && /data: \{ status: "unlisted" \}/.test(src), true);
check("sold stays sold when it leaves the list", /r\.status !== "sold" && r\.status !== "unlisted"/.test(src), true);
check("media is skipped when its signature is unchanged", /existing\?\.driveImagesModified !== media\.sig/.test(src), true);
/* Read the project row literal itself: the dry run legitimately SELECTS slugs
   to warn about clashes, so a whole-file grep for "slug:" would be wrong. */
const rowStart = src.indexOf("const row: Record<string, unknown> = {");
const rowSrc = src.slice(rowStart, src.indexOf("};", rowStart));
check("the project row is where the check looks", rowStart > 0 && /feedKey/.test(rowSrc), true);
check("the connector never writes category or slug", /\b(category|slug)\b/.test(rowSrc), false);
check("…nor anything in DevelopmentOverride", /developmentOverride\./.test(src), false);
check("a dry run returns before the first write", src.indexOf("if (opts.dryRun)") < src.indexOf("prisma.development.create"), true);
check("derived state recomputed after units", /recomputeDevelopmentDerivedState\(dev\.id\)/.test(src), true);
check("the sync window is always released", /finally \{\s*release\(\);/.test(src), true);
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/qa/plus-sync-check.mjs`
Expected: `FAIL writer exported` and the wiring checks fail.

- [ ] **Step 3: Implement** — append to `src/lib/plusPropertiesSync.ts`, add these imports at the top of the file, and fold the existing `import { cleanNumber, type PlusUnit } from "./plusProperties";` into the last one (one import per module — `import/no-duplicates`)

```ts
import { prisma } from "./prisma";
import { getAccessToken, listFolder, collectMedia, downloadFile, type DriveFile } from "./googleDrive";
import { storeUploadedImage, pdfPagesToJpegs, devKeyFor, beginSyncWindow, scheduleAppRestart } from "./imageMirror";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { logCronRun } from "./cronLog";
import { cleanNumber, parsePriceList, type PlusProject, type PlusUnit } from "./plusProperties";
```

```ts
/* The feed-sync freeze, restated here like Cybarco does: content an admin has
   curated stays put once a project is published; location only once set.
   Units and prices always sync. */
const FROZEN_WHEN_PUBLISHED = ["publicName", "description", "amenities", "gallery", "plans"] as const;
const FROZEN_WHEN_PUBLISHED_IF_SET = ["district", "town", "latitude", "longitude"] as const;

function freezeForPublished(data: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const k of FROZEN_WHEN_PUBLISHED) delete out[k];
  for (const k of FROZEN_WHEN_PUBLISHED_IF_SET) if (existing[k] != null && existing[k] !== "") delete out[k];
  return out;
}

export type PlusPlanRow = {
  key: string; publicName: string; source: "xml" | "pdf-only"; exists: boolean; published: boolean;
  units: { available: number; reserved: number; sold: number };
  images: number; plans: number; coords: boolean; facts: number;
  slug: string; slugTaken: boolean; blocked: string | null; notes: string[];
};

export type PlusRunResult = {
  ok: boolean; reason: string | null; dryRun: boolean;
  projects: number; created: number; units: number;
  failed: string[]; blocked: string[]; notes: string[]; plan: PlusPlanRow[];
};

type Gathered = {
  key: string; source: "xml" | "pdf-only"; project: PlusProject | null; mediaFolder: string | null;
  coords: { lat: number; lng: number } | null; details: { facts: string[]; energy: string | null } | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function resolvedUrl(url: string): Promise<string | null> {
  try { const r = await fetch(url, { redirect: "follow", cache: "no-store" }); return r.url || null; } catch { return null; }
}

async function mediaFolders(token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const city of (await listFolder(PLUS_PROJECTS_FOLDER, token)).filter((f) => f.mimeType === FOLDER_MIME)) {
    for (const p of (await listFolder(city.id, token)).filter((f) => f.mimeType === FOLDER_MIME)) {
      const key = projectKey(p.name);
      if (key && !out.has(key)) out.set(key, p.id);
    }
  }
  return out;
}

export async function syncPlusProperties(accountId: string, opts: { force?: boolean; dryRun?: boolean } = {}): Promise<PlusRunResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: accountId }, select: { id: true, name: true } });
  if (!acct) throw new Error(`Plus Properties: no DeveloperAccount ${accountId}`);
  const result: PlusRunResult = { ok: true, reason: null, dryRun: !!opts.dryRun, projects: 0, created: 0, units: 0, failed: [], blocked: [], notes: [], plan: [] };
  const release = beginSyncWindow("plus-sync");
  let anyNewMedia = false;
  try {
    /* ── gather everything first; nothing below this block writes ── */
    const token = await getAccessToken();
    let attempted = 0, failedReq = 0;
    const tryDrive = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      attempted++;
      try { return await fn(); } catch { failedReq++; return null; }
    };
    /* Newest first: if the developer drops a new version beside the old one,
       the newest file is the list and the older one is reported, not synced. */
    const xmlFiles = ((await tryDrive(() => listFolder(PLUS_XML_FOLDER, token))) ?? [])
      .filter((f: DriveFile) => /\.xml$/i.test(f.name))
      .sort((a: DriveFile, b: DriveFile) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    const pdfFiles = ((await tryDrive(() => listFolder(PLUS_PDF_FOLDER, token))) ?? []).filter((f: DriveFile) => /\.pdf$/i.test(f.name));
    const folders = (await tryDrive(() => mediaFolders(token))) ?? new Map<string, string>();
    const gathered: Gathered[] = [];
    const xmlKeys = new Set<string>();
    for (const f of xmlFiles) {
      const key = projectKey(f.name);
      if (!key) { result.notes.push(`ignored price list without a project number: ${f.name}`); continue; }
      if (xmlKeys.has(key)) { result.notes.push(`older price list for ${publicNameFor(key)} ignored: ${f.name}`); continue; }
      xmlKeys.add(key);
      const bytes = await tryDrive(() => downloadFile(f.id, token));
      let project: PlusProject | null = null;
      if (bytes) {
        try { project = await parsePriceList(bytes.toString("utf8")); }
        catch (e) { result.failed.push(`${key}: ${e instanceof Error ? e.message : String(e)}`); continue; }
      }
      gathered.push({ key, source: "xml", project, mediaFolder: folders.get(key) ?? null, coords: null, details: null });
    }
    /* PDF-only projects (Plus 4, 29, 72 on 2026-09-25) become presentation
       pages without units — the spec's "all 35 projects exist as drafts". */
    for (const f of pdfFiles) {
      const key = projectKey(f.name);
      if (!key || xmlKeys.has(key) || gathered.some((g) => g.key === key)) continue;
      gathered.push({ key, source: "pdf-only", project: null, mediaFolder: folders.get(key) ?? null, coords: null, details: null });
    }
    for (const g of gathered) {
      if (g.project?.mapsUrl) g.coords = coordsFromMapsUrl(await resolvedUrl(g.project.mapsUrl));
      if (g.project?.websiteUrl) {
        try { g.details = projectDetails(await (await fetch(g.project.websiteUrl, { redirect: "follow", cache: "no-store" })).text()); }
        catch { g.details = null; }
      }
    }
    const verdict = runVerdict({ attempted, failed: failedReq });
    if (!verdict.ok) return { ...result, ok: false, reason: verdict.reason };

    /* ── the plan, and in a dry run the whole answer ── */
    const existingRows = await prisma.development.findMany({
      where: { feedKey: { in: gathered.map((g) => feedKeyFor(g.key)) } },
      select: { id: true, feedKey: true, publishStatus: true, driveImagesModified: true, district: true, town: true, latitude: true, longitude: true },
    });
    const byFeedKey = new Map(existingRows.map((r) => [r.feedKey, r] as const));
    const slugs = gathered.map((g) => slugCandidate(publicNameFor(g.key)));
    const [takenDev, takenLegacy] = await Promise.all([
      prisma.development.findMany({ where: { slug: { in: slugs } }, select: { slug: true, feedKey: true } }),
      prisma.project.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ]);
    for (const g of gathered) {
      const existing = byFeedKey.get(feedKeyFor(g.key));
      const slug = slugCandidate(publicNameFor(g.key));
      const units = g.project?.units ?? [];
      const count = (s: string) => units.filter((u) => u.status === s).length;
      const media = g.mediaFolder && opts.dryRun ? await tryDrive(() => collectMedia(g.mediaFolder!, token, { maxDepth: 4 })) : null;
      result.plan.push({
        key: g.key, publicName: publicNameFor(g.key), source: g.source, exists: !!existing,
        published: existing?.publishStatus === "published",
        units: { available: count("available"), reserved: count("reserved"), sold: count("sold") },
        images: media?.images.length ?? 0, plans: media?.plans.length ?? 0,
        coords: !!g.coords, facts: g.details?.facts.length ?? 0,
        slug, slugTaken: takenDev.some((t) => t.slug === slug && t.feedKey !== feedKeyFor(g.key)) || takenLegacy.some((t) => t.slug === slug),
        blocked: null, notes: g.project?.notes ?? [],
      });
    }
    if (opts.dryRun) return { ...result, projects: gathered.length };

    /* ── write, one project at a time; a failure costs only that project ── */
    for (const g of gathered) {
      try {
        const feedKey = feedKeyFor(g.key);
        const existing = byFeedKey.get(feedKey) ?? null;
        const published = existing?.publishStatus === "published";
        const devKey = devKeyFor(feedKey);
        const media = g.mediaFolder ? await collectMedia(g.mediaFolder, token, { maxDepth: 4 }) : null;
        let gallery: string[] | null = null, plans: string[] | null = null;
        if (media && (opts.force || existing?.driveImagesModified !== media.sig)) {
          gallery = [];
          for (const img of media.images) {
            const url = await storeUploadedImage(await downloadFile(img.id, token), devKey);
            if (url) gallery.push(url);
          }
          plans = [];
          for (const p of media.plans) {
            const buf = await downloadFile(p.id, token);
            const pages = p.mimeType === "application/pdf" ? await pdfPagesToJpegs(buf, 60) : [buf];
            for (const page of pages) { const url = await storeUploadedImage(page, devKey); if (url) plans.push(url); }
          }
          anyNewMedia = anyNewMedia || gallery.length + plans.length > 0;
        }
        const { town, district } = splitLocation(g.project?.location ?? null);
        const units = g.project?.units ?? [];
        const prices = units.filter((u) => u.status === "available" && u.price != null).map((u) => u.price as number);
        const row: Record<string, unknown> = {
          developerAccountId: acct.id, dev: PLUS_DEV, feedProjectId: g.key, feedKey,
          developerName: g.project?.title ?? publicNameFor(g.key), publicName: publicNameFor(g.key), developer: acct.name,
          currency: "EUR", syncedAt: new Date(),
          ...(town ? { town } : {}), ...(district ? { district } : {}),
          ...(g.project?.stage ? { stage: g.project.stage, status: g.project.stage } : {}),
          ...(g.coords ? { latitude: g.coords.lat, longitude: g.coords.lng } : {}),
          ...detailFields(g.details),
          ...(gallery ? { gallery } : {}), ...(plans ? { plans } : {}),
          ...(media && gallery ? { driveImagesModified: media.sig } : {}),
          ...(prices.length ? { priceFrom: Math.min(...prices), priceTo: Math.max(...prices) } : {}),
        };
        const dev = existing
          ? await prisma.development.update({ where: { feedKey }, data: (published ? freezeForPublished(row, existing) : row) as never })
          : await prisma.development.create({ data: { ...row, publishStatus: "draft" } as never });
        if (!existing) result.created++;
        result.projects++;

        if (g.project) {
          const stored = await prisma.developmentUnit.findMany({
            where: { developmentId: dev.id, source: "feed" },
            select: { id: true, ref: true, status: true, type: true, unitNumber: true, guestWc: true, orientation: true, amenities: true, photos: true, plans: true },
          });
          const decision = unitsDecision({ published, stored, fresh: units });
          if (decision.blocked) {
            result.blocked.push(`${g.key}: ${decision.message}`);
            await logCronRun(`plus-incomplete:${g.key}`, false, decision.message ?? undefined);
          } else {
            const keep = new Map(stored.filter((r) => r.ref).map((r) => [r.ref as string, r as unknown as Record<string, unknown> & { id: string }] as const));
            if (!published) {
              await prisma.developmentUnit.deleteMany({ where: { developmentId: dev.id, source: "feed" } });
              if (units.length) await prisma.developmentUnit.createMany({ data: units.map((u, i) => unitRow(u, dev.id, i, keep.get(u.ref))) as never });
            } else {
              const fresh = new Set(units.map((u) => u.ref));
              for (let i = 0; i < units.length; i++) {
                const hit = keep.get(units[i].ref);
                const data = unitRow(units[i], dev.id, i, hit) as never;
                if (hit) await prisma.developmentUnit.update({ where: { id: hit.id }, data });
                else await prisma.developmentUnit.create({ data });
              }
              for (const r of stored) {
                if (r.ref && !fresh.has(r.ref) && r.status !== "sold" && r.status !== "unlisted") {
                  await prisma.developmentUnit.update({ where: { id: r.id }, data: { status: "unlisted" } });
                }
              }
            }
            result.units += units.length;
            await logCronRun(`plus-incomplete:${g.key}`, true, `price list complete — ${units.length} unit(s)`);
          }
        }
        await recomputeDevelopmentDerivedState(dev.id);
      } catch (e) {
        result.failed.push(`${g.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    /* "Last synced" on the developer admin page, as for Cybarco. */
    await prisma.developerAccount.update({ where: { id: acct.id }, data: { driveSyncedAt: new Date() } });
    return result;
  } finally {
    release();
    if (anyNewMedia && !opts.dryRun) scheduleAppRestart();
  }
}
```

- [ ] **Step 4: Typecheck and run the checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "plusProperties" ; node scripts/qa/plus-sync-check.mjs && node scripts/qa/plus-parse-check.mjs && node scripts/qa/plus-pdf-check.mjs`
Expected: no `plusProperties` type errors; all three checks `all passed`. (A fresh worktree needs `next-env.d.ts` copied in, and its shared `node_modules` may carry a stale Prisma client that reports unrelated `he`-locale errors — filter for this module's files, do not "fix" those.)

- [ ] **Step 5: Mutation-test the wiring**

| Mutation | Search → replace | Must kill |
|---|---|---|
| no clean-run log | `await logCronRun(\`plus-incomplete:${g.key}\`, true,` → `// removed:` (comment out the statement) | clean project logs ok=true |
| unlisted by deleting | `data: { status: "unlisted" }` → `data: { status: "sold" }` | drafts rewritten, published unlisted |
| sold unlisted | `r.status !== "sold" && r.status !== "unlisted"` → `r.status !== "unlisted"` | sold stays sold |
| no freeze | `published ? freezeForPublished(row, existing) : row` → `row` | published projects frozen |
| media always re-mirrored | `existing?.driveImagesModified !== media.sig` → `true` | media skipped when unchanged |

- [ ] **Step 6: Commit**

```bash
git add src/lib/plusPropertiesSync.ts scripts/qa/plus-sync-check.mjs
git commit -m "Plus Properties sync: gather first, then write each project in isolation"
```

---

### Task 8: Cron route, account, and cron health

**Files:**
- Create: `src/app/api/cron/plus-sync/route.ts`
- Create: `scripts/setup-plus-properties-account.mjs`
- Modify: `src/lib/actionCenter/rules/system.ts` (the `JOBS` array, after the `cybarco-sync` entry)
- Modify: `scripts/qa/plus-sync-check.mjs`

**Interfaces:**
- Consumes: `syncPlusProperties`, `PLUS_ACCOUNT_SLUG` (Tasks 6–7); `withCronLog`, `shouldNotifyFailureStreak`, `markFailureStreakNotified` from `@/lib/cronLog`; `buildCronFailureMessage`, `sendFeedNotification` from `@/lib/feedNotifications`.
- Produces: `GET /api/cron/plus-sync?key=…[&force=1][&dryRun=1]`; DeveloperAccount with slug `plus-properties`; cron-health job `plus-sync`.

- [ ] **Step 1: Add the failing wiring checks** — before the final `console.log` of `plus-sync-check.mjs`

```js
/* ── route, account, cron health ──────────────────────────────────────── */
const route = readFileSync("src/app/api/cron/plus-sync/route.ts", "utf8");
check("route refuses without the cron secret", /key !== process\.env\.CRON_SECRET/.test(route) && /status: 401/.test(route), true);
check("route reads force and dryRun, nothing invented", [/searchParams\.get\("force"\) === "1"/.test(route), /searchParams\.get\("dryRun"\) === "1"/.test(route)], [true, true]);
check("route finds the account by its slug", /where: \{ slug: PLUS_ACCOUNT_SLUG \}/.test(route), true);
check("a dry run is not logged as a sync", /opts\.dryRun|dryRun \?/.test(route), true);
const jobs = readFileSync("src/lib/actionCenter/rules/system.ts", "utf8");
check("cron health watches plus-sync daily", /\{ job: "plus-sync", label: "plus-sync", expectedMs: 24 \* HOUR \}/.test(jobs), true);
const setup = readFileSync("scripts/setup-plus-properties-account.mjs", "utf8");
check("account setup is idempotent", /upsert\(/.test(setup), true);
check("…and keeps the generic Drive sync away from it", /driveSyncInterval: "off"/.test(setup) && !/driveFolderUrl:/.test(setup), true);
```

- [ ] **Step 2: Run to verify failure**

Run: `node scripts/qa/plus-sync-check.mjs`
Expected: `ENOENT` for the route file.

- [ ] **Step 3: Implement the route** — `src/app/api/cron/plus-sync/route.ts`

```ts
// Nightly Plus Properties sync — see src/lib/plusPropertiesSync.ts and
// docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
//   crontab:  30 2 * * * … curl -s ".../api/cron/plus-sync?key=$CRON_SECRET"
//   by hand:  &force=1 re-mirrors every project's media
//             &dryRun=1 reports what would be written and writes nothing
// Invented parameters are ignored — only these two are read.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlusProperties, PLUS_ACCOUNT_SLUG, type PlusRunResult } from "@/lib/plusPropertiesSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 3000;

function summarize(r: PlusRunResult): string {
  return [
    `${r.projects} project(s), ${r.created} created, ${r.units} unit(s) written`,
    r.failed.length ? `${r.failed.length} failed (${r.failed.slice(0, 3).join("; ")})` : null,
    r.blocked.length ? `${r.blocked.length} blocked` : null,
    r.reason,
  ].filter(Boolean).join(", ");
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const opts = {
    force: req.nextUrl.searchParams.get("force") === "1",
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
  };
  const acct = await prisma.developerAccount.findUnique({ where: { slug: PLUS_ACCOUNT_SLUG } });
  if (!acct) return NextResponse.json({ ok: false, error: `no DeveloperAccount "${PLUS_ACCOUNT_SLUG}"` }, { status: 500 });
  try {
    /* A dry run is not a sync: it is never logged as one, so it can neither
       satisfy nor trip cron health. */
    const result = opts.dryRun
      ? await syncPlusProperties(acct.id, opts)
      : await withCronLog("plus-sync", () => syncPlusProperties(acct.id, opts), summarize, (r) => r.ok);
    if (!opts.dryRun && !result.ok && (await shouldNotifyFailureStreak("plus-sync"))) {
      const msg = buildCronFailureMessage("plus-sync", summarize(result));
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("plus-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement the account script** — `scripts/setup-plus-properties-account.mjs`

```js
#!/usr/bin/env node
/* Creates (or leaves in place) the Plus Properties DeveloperAccount. Runs where
   DATABASE_URL points at production — on the VPS, in the live release:
     ssh root@72.60.89.239 'cd /var/www/cyprusvipestates && node scripts/setup-plus-properties-account.mjs'
   Idempotent: a second run changes nothing.

   driveFolderUrl is deliberately NOT set and driveSyncInterval is "off": the
   generic Drive sync picks up any account with a folder URL and an interval,
   and it would read this developer's two-tree layout wrongly. This developer
   is synced only by /api/cron/plus-sync. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const acct = await prisma.developerAccount.upsert({
  where: { slug: "plus-properties" },
  update: {},
  create: {
    slug: "plus-properties",
    name: "Plus Properties",
    website: "https://www.pluspropertiescyprus.com",
    driveSyncInterval: "off",
    notes: "Synced by /api/cron/plus-sync from Drive folder 1DOgqxKagV79t-9if8uHJi0woLLk6pTD8 (price lists: Availabilities xml - Cyprus; media: Cyprus Projects). Greece is out of scope.",
  },
});
console.log(`account ${acct.slug} → ${acct.id}`);
await prisma.$disconnect();
```

- [ ] **Step 5: Add the cron-health entry** — in `src/lib/actionCenter/rules/system.ts`, directly after `{ job: "cybarco-sync", label: "cybarco-sync", expectedMs: 24 * HOUR },` insert:

```ts
  // 2026-09-25 — added with the plus-sync route (`30 2 * * *`). Watches whether
  // the nightly Plus Properties sync fired at all; a failed run already reports
  // through withCronLog and the failure-streak notification.
  { job: "plus-sync", label: "plus-sync", expectedMs: 24 * HOUR },
```

- [ ] **Step 6: Run everything**

Run: `node scripts/qa/plus-sync-check.mjs && node scripts/qa/plus-parse-check.mjs && node scripts/qa/plus-pdf-check.mjs && npx next lint --file src/lib/plusProperties.ts --file src/lib/plusPropertiesSync.ts --file src/app/api/cron/plus-sync/route.ts`
Expected: all `all passed`; `No ESLint warnings or errors`.

- [ ] **Step 7: Mutation-test**

| Mutation | Search → replace | Must kill |
|---|---|---|
| open route | `if (!process.env.CRON_SECRET \|\| key !== process.env.CRON_SECRET) {` → `if (false) {` | refuses without the secret |
| folder URL set | in the setup script add `driveFolderUrl: "x",` to `create` | keeps the generic Drive sync away |
| job removed | delete the `plus-sync` JOBS line | cron health watches plus-sync |

- [ ] **Step 8: Commit and push**

```bash
git add src/app/api/cron/plus-sync/route.ts scripts/setup-plus-properties-account.mjs src/lib/actionCenter/rules/system.ts scripts/qa/plus-sync-check.mjs
git commit -m "Plus Properties: cron route, account setup and cron health"
git push origin HEAD:main
```

---

### Task 9: Production — dry run, operator review, first run (operator-gated)

Every step that changes production waits for the operator's explicit word in chat. Nothing here is automated.

**Files:** none changed.

- [ ] **Step 1: Deploy — on the operator's word only**

Check the range has no schema change (it should not): `git log <live-release-sha>..origin/main --name-only -- prisma/` must print nothing. Then:
```bash
CVP_PROD_REF=origin/main ./scripts/deploy-prod.sh --yes
```
Read the final `ref origin/main @ <sha>` line; it must be the pushed commit.

- [ ] **Step 2: Create the account — on the operator's word**

```bash
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'cd /var/www/cyprusvipestates && node scripts/setup-plus-properties-account.mjs'
```
Expected: `account plus-properties → <uuid>`.

- [ ] **Step 3: Dry run against production (writes nothing)**

```bash
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2); curl -s --max-time 3000 "http://127.0.0.1:3000/api/cron/plus-sync?key=$SECRET&dryRun=1"' > /tmp/plus-dryrun.json
```
Check: `projects` = 35; `failed` empty (or each entry explained); every `plan[].units` total matches the price list; `slugTaken` false everywhere; `coords` true wherever the list has a Maps link; `images`/`plans` > 0 except Plus 85 and 86 (empty folders) and House Kiti, Plus 55, 92 (no folder). Confirm `cron_run_logs` has **no** new `plus-sync` row.

- [ ] **Step 4: Show the operator the dry run and wait**

Present a table per project (name, units available/reserved/sold, images, plans, coordinates, facts, notes). Do not continue without their yes.

- [ ] **Step 5: First real run — on the operator's word**

```bash
ssh -i ~/.ssh/cvp_vps root@72.60.89.239 'SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2); curl -s --max-time 3000 "http://127.0.0.1:3000/api/cron/plus-sync?key=$SECRET" | tee -a /var/log/plus-sync-prod.log'
```

- [ ] **Step 6: Verify the acceptance criteria against production (read-only SQL)**

```sql
-- 1. 35 drafts, none published
select count(*), count(*) filter (where "publishStatus"='draft') from developments where dev='plusproperties';
-- 2. no sold or reserved unit has a price
select count(*) from development_units u join developments d on d.id=u."developmentId"
 where d.dev='plusproperties' and u.status in ('sold','reserved') and u.price is not null;   -- must be 0
-- 3. Plus 87 and Plus 57 as the PDFs say
select d."publicName", u.status, count(*) from development_units u join developments d on d.id=u."developmentId"
 where d."feedKey" in ('plusproperties:87','plusproperties:57') group by 1,2 order by 1,2;
-- 4. Plus 75 villas are nine units with block-qualified refs
select u.ref, u.status, u.price, u.beds from development_units u join developments d on d.id=u."developmentId"
 where d."feedKey"='plusproperties:75' and u.ref like '%Villa%' order by u.ref;
-- 5. every clean project logged ok=true on its plus-incomplete key
select distinct on (job) job, ok from cron_run_logs where job like 'plus-incomplete:%' order by job, "ranAt" desc;
```

- [ ] **Step 7: Second run proves idempotence and manual-field survival**

Set a `category` on one project and a unit `type` on one unit (SQL, one statement each, on the operator's word), run the sync again, and check both survived and `created` is 0.

- [ ] **Step 8: Install the crontab entry — on the operator's word**

```
30 2 * * * SECRET=$(grep "^CRON_SECRET=" /var/www/cyprusvipestates/.env | cut -d= -f2); curl -s --max-time 3000 "http://127.0.0.1:3000/api/cron/plus-sync?key=$SECRET" >> /var/log/plus-sync-prod.log 2>&1
```

- [ ] **Step 9: Record the outcome** in the memory file `plus-properties-analysis.md` (built, deployed, first-run numbers, anything the dry run surfaced).
