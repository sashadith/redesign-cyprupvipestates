import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import { anthropic, AI_MODEL_FAST } from "./anthropic";

/* Availability-list PDF → units (Korantina Homes, 2026-08-26).

   Korantina publishes ONE "AL_<CODE>.pdf" per project instead of a spreadsheet —
   a real table with a real text layer, an explicit header row, and a final column
   that is either a price or the literal word SOLD / RESERVED. Confirmed across all
   16 of their availability lists before this module was written.

   THE DIVISION OF LABOUR HERE IS THE WHOLE POINT: no unit VALUE ever comes from a
   model. The geometry below reconstructs the table verbatim from pdf.js text
   positions — including which cells are EMPTY, which a plain text dump cannot
   express and which matters constantly in this data (Sunset View leaves "Cov.
   Parking" blank on 19 of 26 rows; a naive left-to-right text read shifts every
   later column on exactly those rows). Claude is asked ONE question per table, and
   it is a question about LABELS, not numbers: "which of these column headers is
   the plot size, which is the price?". Its answer is then validated against the
   column's own data (see validateMapping) before a single unit is built.

   That split is why this can be trusted weekly without a human reading every PDF:
   - a wrong price is impossible — prices are parsed from the cell text, in code;
   - a wrong STATUS is impossible for the same reason, and a cell the parser cannot
     resolve is DROPPED and reported, never defaulted to "available" (the rule
     pdfPricelistExtract.ts had to learn the hard way with grey-text status);
   - the worst a bad model answer can do is mislabel a column, which shows up as a
     nonsense area figure in the dry run rather than as a wrong price on a live page.

   The one genuinely fuzzy job — naming a table when a single PDF holds several
   (Golden View's "MAIN PHASE" + "PHASE 6", Hill Residences + Hill Panorama) — is
   also Claude's, and is deliberately NOT part of any identity key: see
   sharepointAvailabilitySync.ts, where a table is keyed by file id + ordinal so a
   re-worded title can never split one project into two. */

export type PdfCell = { x: number; w: number; t: string };
export type PdfRow = { y: number; cells: PdfCell[] };
export type PdfPage = { page: number; width: number; height: number; rows: PdfRow[] };

const WORKER_PATH = join(process.cwd(), "scripts", "pdf-table-extract-worker.mjs");

/** Runs the isolated pdf.js worker (see scripts/pdf-table-extract-worker.mjs). */
export async function readPdfPages(buf: Buffer): Promise<PdfPage[]> {
  const dir = await mkdtemp(join(tmpdir(), "pdftable-"));
  try {
    const src = join(dir, "in.pdf");
    await writeFile(src, buf);
    const json = await new Promise<string>((resolve, reject) => {
      const p = spawn(process.execPath, [WORKER_PATH, src]);
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`pdf-table-extract-worker exit ${code}: ${err.slice(0, 500)}`))));
    });
    return JSON.parse(json) as PdfPage[];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── Deterministic table reconstruction ─────────────────────────────────── */

// A cell that means "this field does not apply here". Korantina writes it four
// different ways across their 16 lists ("--", "---", "===", "n/a"), and every one
// of them must read as EMPTY rather than as a value — most importantly in the
// price column, where treating "===" as anything but "unknown" would be the
// difference between dropping a row and publishing a wrong status.
const BLANK_RE = /^(|[-–—=.]+|n\.?\/?a\.?|tbc|tba)$/i;
const isBlank = (t: string) => BLANK_RE.test((t || "").trim());

const SOLD_RE = /^sold(\s*out)?$/i;
// "RESRVED" is not a typo on our side — it is in Korantina's own City Landmark list.
const RESERVED_RE = /^(reserved|resrved|under\s*offer|on\s*hold)$/i;
const AVAILABLE_RE = /^available$/i;
// € 1.800.000 · € 995,000 · €1.250.000 · 1 250 000 € · 545000
const PRICE_RE = /^[€$£]?\s*\d{1,3}(?:[., \s]\d{3})+(?:\s*[€$£])?$|^[€$£]\s*\d{4,9}$/;

const looksLikeOutcome = (t: string) => {
  const s = (t || "").trim();
  return SOLD_RE.test(s) || RESERVED_RE.test(s) || AVAILABLE_RE.test(s) || PRICE_RE.test(s);
};

/** Parse a price cell to whole euros, or null when the text is not unambiguously a price. */
export function parsePrice(raw: string): number | null {
  let s = (raw || "").replace(/[€$£]/g, "").replace(/ /g, " ").replace(/\+\s*vat/i, "").trim();
  s = s.replace(/^from\s+/i, "").trim();
  if (!s) return null;
  // Grouped form: 1.800.000 / 995,000 / 1 250 000 — every group after the first is
  // exactly three digits, so the separator is unambiguously a thousands separator
  // whichever character it is. This is the ONLY form Korantina uses; anything else
  // returns null rather than guessing a decimal convention.
  if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(s)) {
    const n = Number(s.replace(/[.,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d{4,9}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export type UnitStatus = "available" | "reserved" | "sold";

/** Status + price from one outcome cell. `null` means UNRESOLVED — never "available". */
export function readOutcome(raw: string): { status: UnitStatus; price: number | null } | null {
  const s = (raw || "").trim();
  if (isBlank(s)) return null;
  if (SOLD_RE.test(s)) return { status: "sold", price: null };
  if (RESERVED_RE.test(s)) return { status: "reserved", price: null };
  if (AVAILABLE_RE.test(s)) return { status: "available", price: null };
  const price = parsePrice(s);
  return price === null ? null : { status: "available", price };
}

export type RawTable = {
  page: number;
  /** Ordinal across the WHOLE document (0-based). Part of the sync's stable key. */
  index: number;
  headers: string[];
  rows: string[][];
  /** Rows adjacent to the table whose outcome cell could not be read (reported, never imported). */
  strayRows: string[][];
};

/* How far above the first PRICED row to look for column headers.

   110pt, not the ~35pt a header block actually occupies, because the header is not
   always adjacent to the first priced row: Inner City 3 puts two ground-floor SHOP
   rows (price "n/a", so not data rows) between its header and its first apartment,
   which pushed the real header outside a 70pt window and left the whole project
   labelled "34 34" and "n/a n/a".

   The band deliberately does NOT try to exclude non-header text that shares it —
   page titles, and the marketing paragraph Royal Bay prints behind its header row,
   both land in these labels. That is acceptable by design: the labels are only ever
   read as prose by the column mapper, whose prompt says so and which picks the real
   column name out of the noise, and whose answer is then validated against the
   column's own values anyway. Widening the band trades tidy labels for never losing
   a real one — the right trade when the alternative is a silently mis-read table. */
const HEADER_BAND_PT = 110;
// Two cell centres within this many points belong to the same column. Measured
// against the tightest real layout (Royal Bay's 13-column villa table, ~34pt pitch).
const COLUMN_TOLERANCE_PT = 14;

function isDataRow(row: PdfRow): boolean {
  return row.cells.length >= 3 && row.cells.some((c) => looksLikeOutcome(c.t));
}

const isNumericCell = (t: string) => /^[\d]+([.,]\d+)?$/.test((t || "").trim());
const rowSpan = (row: PdfRow) => {
  if (!row.cells.length) return 0;
  const first = row.cells[0], last = row.cells[row.cells.length - 1];
  return (last.x + last.w) - first.x;
};

/* A non-data row that ENDS a table rather than interrupting it: the next table's
   header row. Three tests, all needed, all derived from real documents:

     WIDTH  — a header has about as many cells as the table has columns.
     SPREAD — a header spans the table; a group label sits in the left margin.
     WORDS  — a header names columns; it is not a row of figures.

   Each test alone lets a real case through. Golden View stacks two tables on one
   page separated by a single header line, and without this the two merged into one
   18-column phantom. But City Landmark prints five "1ST FLOOR"-style group labels
   BETWEEN its apartment rows — three cells ("1", "ST", "FLOOR"), one of them
   numeric, so the WORDS test alone called them headers and split one project into
   six. And Hill Panorama's CLUBHOUSE row is wide AND spans the table, so WIDTH and
   SPREAD alone would have cut that project in half at villa 6. */
function looksLikeHeaderRow(row: PdfRow, runMaxCells: number, runSpan: number): boolean {
  if (row.cells.length < Math.max(4, Math.ceil(runMaxCells * 0.6))) return false;
  if (runSpan > 0 && rowSpan(row) < runSpan * 0.6) return false;
  const numeric = row.cells.filter((c) => isNumericCell(c.t)).length;
  return numeric / row.cells.length < 0.34;
}

/* Splits a page into table "runs" — maximal stretches of data rows. Two things
   this must get right, both confirmed against real documents:

   1. A page can hold MORE THAN ONE table with DIFFERENT columns (Golden View's
      MAIN PHASE and PHASE 6 sit on one page, 11 columns each but not the same 11).
      Clustering column positions per PAGE merged them into 18 phantom columns;
      clustering per RUN reads both correctly.
   2. A single interruption inside a table is not the end of it. Hill Panorama's
      villa 6 is a CLUBHOUSE row with no price at all, sitting between villas 5 and
      7 — ending the run there would have produced two 5-and-7-row "projects".
      A gap only ends a run when no data row follows within two rows. */
function splitRuns(rows: PdfRow[]): { rows: PdfRow[]; strays: PdfRow[] }[] {
  const flags = rows.map(isDataRow);
  const runs: { rows: PdfRow[]; strays: PdfRow[] }[] = [];
  let current: { rows: PdfRow[]; strays: PdfRow[] } | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (flags[i]) {
      if (!current) { current = { rows: [], strays: [] }; runs.push(current); }
      current.rows.push(rows[i]);
      continue;
    }
    if (!current) continue;
    // Shape of the table so far — what a header row is measured against.
    const maxCells = Math.max(...current.rows.map((r) => r.cells.length));
    const span = Math.max(...current.rows.map(rowSpan));
    if (looksLikeHeaderRow(rows[i], maxCells, span)) { current = null; continue; }
    if (flags.slice(i + 1, i + 3).some(Boolean)) current.strays.push(rows[i]);
    else current = null;
  }
  // A "run" of one row is a stray line that happened to contain a price (a
  // footnote, a summary total) — never a table.
  return runs.filter((r) => r.rows.length >= 2);
}

function columnAnchors(rows: PdfRow[]): number[] {
  const centres = rows.flatMap((r) => r.cells.map((c) => c.x + c.w / 2)).sort((a, b) => a - b);
  if (!centres.length) return [];
  const anchors: number[] = [];
  let group = [centres[0]];
  for (let i = 1; i < centres.length; i++) {
    if (centres[i] - group[group.length - 1] <= COLUMN_TOLERANCE_PT) group.push(centres[i]);
    else { anchors.push(group.reduce((a, b) => a + b, 0) / group.length); group = [centres[i]]; }
  }
  anchors.push(group.reduce((a, b) => a + b, 0) / group.length);
  return anchors;
}

function nearestAnchor(centre: number, anchors: number[]): { index: number; distance: number } {
  let index = 0, distance = Infinity;
  anchors.forEach((a, i) => { const d = Math.abs(a - centre); if (d < distance) { distance = d; index = i; } });
  return { index, distance };
}

function toCells(row: PdfRow, anchors: number[]): string[] {
  const out = anchors.map(() => "");
  for (const c of row.cells) {
    const { index } = nearestAnchor(c.x + c.w / 2, anchors);
    out[index] = out[index] ? `${out[index]} ${c.t}` : c.t;
  }
  return out.map((s) => s.trim());
}

/* Repairs a column that the position clustering split in two.

   Hill Panorama's price column is the real case: a centred "SOLD" and a centred
   "€ 2.850.000" have centres ~25pt apart — wider than COLUMN_TOLERANCE_PT — so the
   one column arrives as two, with sold units in the left half and priced units in
   the right. Left alone, whichever half is mapped as `price` would drop every unit
   in the other half as "no readable price/status". Golden View has the same shape
   for a different reason (an all-"===" furniture-price column beside the live one).

   Merged only when the evidence is unambiguous: the two columns must be adjacent,
   never both filled on the same row, contain nothing but status words and prices,
   and hold at least one real outcome between them. Two coincidentally-empty
   neighbours (Royal Bay's unused ROOF GARDEN / STORAGE columns) fail the last test
   and are left alone. */
function mergeSplitOutcomeColumns(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  let h = headers.slice();
  let r = rows.map((row) => row.slice());
  for (let i = 0; i < h.length - 1; ) {
    const filled = (idx: number) => r.filter((row) => !isBlank(row[idx] ?? "")).length;
    const bothEver = r.some((row) => !isBlank(row[i] ?? "") && !isBlank(row[i + 1] ?? ""));
    const onlyOutcomes = r.every((row) => [row[i], row[i + 1]].every((c) => isBlank(c ?? "") || looksLikeOutcome(c ?? "")));
    const anyOutcome = filled(i) + filled(i + 1) > 0;
    if (!bothEver && onlyOutcomes && anyOutcome) {
      h = [...h.slice(0, i), [h[i], h[i + 1]].filter(Boolean).join(" ").trim(), ...h.slice(i + 2)];
      r = r.map((row) => [...row.slice(0, i), (!isBlank(row[i] ?? "") ? row[i] : row[i + 1]) ?? "", ...row.slice(i + 2)]);
      continue; // re-test the merged column against its new neighbour
    }
    i++;
  }
  return { headers: h, rows: r };
}

const headersEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((h, i) => h.trim().toLowerCase() === b[i].trim().toLowerCase());

export type PdfTableResult = {
  tables: RawTable[];
  /** Pages with real content that yielded no table at all — reported, never ignored. */
  unparsedPages: number[];
};

/** Reconstructs every table in the document, verbatim, with no AI involved. */
export function tablesFromPages(pages: PdfPage[]): PdfTableResult {
  const tables: RawTable[] = [];
  const unparsedPages: number[] = [];

  for (const page of pages) {
    const runs = splitRuns(page.rows);
    // Only pages that look like they HOLD a table we failed to read. A cover page
    // or a prose description (Royal Bay page 1, Soho page 1) has no prices and no
    // status words, and flagging those would bury the one case that matters:
    // City Landmark's page 2 commercial floors, where a single priced row cannot
    // form a table and four office units go unimported.
    if (!runs.length && page.rows.length >= 4 && page.rows.some((r) => r.cells.some((c) => looksLikeOutcome(c.t)))) unparsedPages.push(page.page);
    // Another table's body rows are never this table's headers. Golden View stacks
    // MAIN PHASE directly above PHASE 6, so without this the second table's header
    // band reaches up into the first table's villas and every label arrives with
    // "V47 V58" glued to the front of it.
    const bodyY = new Set(runs.flatMap((r) => r.rows.map((row) => row.y)));

    for (const run of runs) {
      const anchors = columnAnchors(run.rows);
      if (anchors.length < 3) continue;
      const topY = run.rows[0].y;
      const headerRows = page.rows.filter((r) => r.y > topY && r.y <= topY + HEADER_BAND_PT && !bodyY.has(r.y));

      const buckets: { t: string; y: number; x: number }[][] = anchors.map(() => []);
      for (const hr of headerRows) {
        for (const c of hr.cells) buckets[nearestAnchor(c.x + c.w / 2, anchors).index].push({ t: c.t, y: hr.y, x: c.x });
      }
      const rawHeaders = buckets.map((b) =>
        b.sort((a, z) => z.y - a.y || a.x - z.x).map((c) => c.t).join(" ").replace(/\s+/g, " ").trim(),
      );
      const merged = mergeSplitOutcomeColumns(rawHeaders, run.rows.map((r) => toCells(r, anchors)));

      tables.push({
        page: page.page,
        index: tables.length,
        headers: merged.headers,
        rows: merged.rows,
        strayRows: run.strays.map((r) => toCells(r, anchors)).filter((cells) => cells.some(Boolean)),
      });
    }
  }

  /* A table that continues onto the next page arrives here as two tables with an
     identical header row (Korantina repeats the header on every page). Soho's East
     and West tower lists are 4 pages each and would otherwise become two separate
     "projects" per tower — the exact failure the folder-per-project rule is meant
     to prevent. Merged only on an EXACT header match, so Royal Bay's villa table
     (page 2) and apartment table (page 3) stay the two distinct projects they are. */
  const joined: RawTable[] = [];
  for (const t of tables) {
    const prev = joined[joined.length - 1];
    if (prev && headersEqual(prev.headers, t.headers)) {
      prev.rows.push(...t.rows);
      prev.strayRows.push(...t.strayRows);
      continue;
    }
    joined.push({ ...t, index: joined.length });
  }
  return { tables: joined, unparsedPages };
}

export async function extractPdfTables(buf: Buffer): Promise<PdfTableResult> {
  return tablesFromPages(await readPdfPages(buf));
}

/* ── Column mapping (the one AI step) ───────────────────────────────────── */

export const COLUMN_FIELDS = [
  "ref", "block", "floor", "type", "beds", "baths",
  "areaInternal", "areaBuilt", "areaPlot", "areaVeranda", "areaVerandaOpen",
  "price", "priceAlt", "attr", "ignore",
] as const;
export type ColumnField = (typeof COLUMN_FIELDS)[number];

export type TableMapping = {
  /** Free-text name for THIS table, "" when the document holds only one. Display only. */
  title: string;
  columns: ColumnField[];
  /* Cleaned-up column labels. The positional header read deliberately keeps noise
     (page titles, the marketing paragraph Royal Bay prints behind its header), and
     those raw strings would otherwise become the visible names of `attr` specs on
     the public page — "above sea first - the purest BASEMENT" is a real example
     from Royal Bay's villa list. Same call, same answer, no extra cost. */
  labels: string[];
  /* What kind of home this table lists ("Villa", "Apartment", "Townhouse", "Shop"),
     or "" when mixed/unknown. Becomes DevelopmentUnit.type, which the public page
     renders as the property type — so the developer's own variant letter ("A", "C",
     "F") must NOT land there; it is kept as a per-unit spec instead. */
  unitKind: string;
  /** Set when validateMapping had to override the model — surfaced in the dry run. */
  corrections: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Name of THIS table when the document contains several distinct ones (e.g. 'Main Phase', 'Phase 6', 'East Tower', 'Hill Panorama', 'Apartments', 'Villas'). Empty string if the document has only one table or the table carries no name of its own.",
    },
    unitKind: {
      type: "string",
      description:
        "The kind of home this table lists, singular and capitalised: 'Villa', 'Apartment', 'Penthouse', 'Townhouse', 'House', 'Shop', 'Office'. Use the column headers as evidence ('Villa No' -> Villa, 'APARTMENT NO' -> Apartment). Empty string if the table clearly mixes kinds or gives no evidence.",
    },
    columns: {
      type: "array",
      description: "Exactly one entry per column, in order.",
      items: {
        type: "object",
        properties: {
          index: { type: "number", description: "0-based column index" },
          field: { type: "string", enum: COLUMN_FIELDS as unknown as string[] },
          label: {
            type: "string",
            description:
              "The column's own clean title, with page titles and any unrelated prose removed (e.g. 'above sea first - the purest BASEMENT' -> 'Basement'). Keep the unit of measure if the header has one.",
          },
        },
        required: ["index", "field", "label"],
      },
    },
  },
  required: ["title", "columns"],
};

const PROMPT = `You are mapping the columns of a real-estate availability list to a fixed set of internal fields.

Field meanings:
- ref: the unit's own identifier (villa number, apartment number, plot number). Exactly one column.
- block: a building, block, phase or tower letter/label that qualifies the ref (e.g. "Phase", "Block", "Tower"). Only if a SEPARATE column carries it.
- floor: floor / level of an apartment.
- type: the developer's own unit VARIANT label — the villa/apartment type letter or code ("A", "B", "C", "F"). NOT the bedroom count, and NOT the kind of home (that is the separate "unitKind" answer).
- beds: number of bedrooms. baths: number of bathrooms.
- areaInternal: internal / covered living area (excluding verandas).
- areaBuilt: the TOTAL covered area (the combined figure), when the table has one.
- areaPlot: plot / land area.
- areaVeranda: covered veranda(s). areaVerandaOpen: uncovered / open veranda(s).
- price: the column holding the sale price OR the words SOLD / RESERVED. Exactly one column, normally the last.
- priceAlt: a SECOND price column (e.g. "Price incl. furniture"), when the table has two.
- attr: a meaningful per-unit column with no field above (basement area, roof garden, storage, mechanical room, parking area, communal area, private swimming pool, building area). Its header becomes the label — prefer this over "ignore" so nothing is silently lost.
- ignore: page decoration, running totals, empty columns, or text that is clearly not table data.

Rules:
- Return EXACTLY one entry per column, covering every index from 0 to N-1.
- Header text may be noisy: headers are read positionally, so a column's label can contain fragments of a page title or of a marketing paragraph printed behind the table. Pick the part that names the column and ignore the rest.
- If a header is unreadable, decide from the sample VALUES instead.
- Never map two columns to the same field except "attr" and "ignore".
- Give every column a clean "label", even the ones you map to a named field.

`;

function signature(headers: string[]): string {
  return crypto.createHash("sha256").update(headers.join("").toLowerCase()).digest("hex").slice(0, 16);
}

// Per-process memo. Deliberately NOT persisted: the same layout is read once per
// sync run anyway, and a stored mapping would keep being applied after Korantina
// changed a column — a stale right-looking answer is worse than a fresh call that
// costs a fraction of a cent. Keyed by header text, so two projects that share a
// layout share one call within a run.
const mappingMemo = new Map<string, TableMapping>();

/* Deterministic sanity pass over the model's answer, applied against the column's
   OWN data. Every rule here exists because a plausible mis-map would otherwise
   corrupt units silently:
   - a `ref` column must actually be populated. Korantina's City Colors list has a
     vertically-merged "FLOOR" cell that lands on ONE row of each five-row group,
     producing a column that is 80% empty and looks like an identifier; if that were
     accepted as ref, 4 of every 5 units would arrive with no reference at all.
   - a `block` column is prefixed onto every ref (see unitsFromTable), so a sparse
     column mapped as `block` would corrupt refs on exactly the rows it does cover.
   - duplicate `price`/`ref` mappings are impossible to resolve later, so the first
     wins and the rest degrade to `attr`, which keeps the data without acting on it. */
export function validateMapping(table: RawTable, columns: ColumnField[]): { columns: ColumnField[]; corrections: string[] } {
  const cols = columns.slice(0, table.headers.length);
  while (cols.length < table.headers.length) cols.push("ignore");
  const corrections: string[] = [];
  const fill = (i: number) => (table.rows.filter((r) => !isBlank(r[i] ?? "")).length) / Math.max(1, table.rows.length);

  const demote = (i: number, why: string) => { corrections.push(`column ${i} ("${table.headers[i] || "?"}") ${why}`); cols[i] = "attr"; };

  // Single-instance fields: keep the first, demote the rest.
  for (const field of ["ref", "block", "floor", "type", "beds", "baths", "areaInternal", "areaBuilt", "areaPlot", "areaVeranda", "areaVerandaOpen", "price"] as ColumnField[]) {
    const hits = cols.map((c, i) => (c === field ? i : -1)).filter((i) => i >= 0);
    for (const i of hits.slice(1)) demote(i, `duplicated "${field}" → attr`);
  }

  const blockIdx = cols.indexOf("block");
  if (blockIdx >= 0 && fill(blockIdx) < 0.8) demote(blockIdx, `mapped as "block" but only ${Math.round(fill(blockIdx) * 100)}% filled → attr`);

  let refIdx = cols.indexOf("ref");
  if (refIdx >= 0 && fill(refIdx) < 0.9) { demote(refIdx, `mapped as "ref" but only ${Math.round(fill(refIdx) * 100)}% filled → attr`); refIdx = -1; }
  if (refIdx < 0) {
    // Fall back to the leftmost fully-populated column — which is what a reference
    // column looks like in every one of these documents.
    const candidate = cols.findIndex((_, i) => fill(i) >= 0.9);
    if (candidate >= 0) { cols[candidate] = "ref"; corrections.push(`no usable "ref" column from the model — using column ${candidate} ("${table.headers[candidate] || "?"}")`); }
  }

  if (!cols.includes("price")) {
    // The outcome column is the one whose cells actually read as SOLD/RESERVED/€.
    const candidate = table.headers.map((_, i) => i).find((i) => table.rows.filter((r) => looksLikeOutcome(r[i] ?? "")).length / Math.max(1, table.rows.length) >= 0.6);
    if (candidate !== undefined) { cols[candidate] = "price"; corrections.push(`no "price" column from the model — using column ${candidate} ("${table.headers[candidate] || "?"}")`); }
  }
  return { columns: cols, corrections };
}

export async function mapTableColumns(table: RawTable, context: string): Promise<TableMapping> {
  const sig = signature(table.headers);
  let memo = mappingMemo.get(sig);

  if (!memo) {
    const client = anthropic();
    if (!client) throw new Error("ANTHROPIC_API_KEY not configured — cannot map availability-list columns");
    const sample = table.rows.slice(0, 6).map((r, n) => `row ${n}: ${r.map((c, i) => `[${i}]${c || "(empty)"}`).join(" ")}`).join("\n");
    const prompt =
      `${PROMPT}Document context: ${context}\n\n` +
      `Columns (${table.headers.length}):\n${table.headers.map((h, i) => `[${i}] ${h || "(no header text)"}`).join("\n")}\n\n` +
      `Sample rows:\n${sample}\n`;

    for (let attempt = 0; attempt < 3 && !memo; attempt++) {
      const msg = await client.messages.create({
        model: AI_MODEL_FAST,
        max_tokens: 2000,
        // temperature 0: this is a classification with one right answer, and the
        // mapping must not drift between weekly runs for an unchanged document.
        temperature: 0,
        tools: [{ name: "mapping", description: "Column mapping for one availability table.", input_schema: SCHEMA as any }],
        tool_choice: { type: "tool", name: "mapping" },
        messages: [{ role: "user", content: prompt }],
      });
      const raw = (msg.content.find((b: any) => b.type === "tool_use") as any)?.input;
      if (!raw || !Array.isArray(raw.columns)) continue;
      const columns: ColumnField[] = table.headers.map(() => "ignore");
      const labels: string[] = table.headers.map(() => "");
      for (const c of raw.columns) {
        const i = Number(c?.index);
        if (!Number.isInteger(i) || i < 0 || i >= columns.length) continue;
        if ((COLUMN_FIELDS as readonly string[]).includes(c?.field)) columns[i] = c.field;
        if (typeof c?.label === "string") labels[i] = c.label.trim();
      }
      memo = {
        title: typeof raw.title === "string" ? raw.title.trim() : "",
        unitKind: typeof raw.unitKind === "string" ? raw.unitKind.trim() : "",
        columns,
        // Falling back to the RAW header keeps a spec visible (with an ugly name)
        // rather than dropping it, which matters for `attr` columns whose label is
        // the only thing naming them.
        labels: labels.map((l, i) => l || table.headers[i] || ""),
        corrections: [],
      };
    }
    if (!memo) throw new Error("Column mapping failed after 3 attempts");
    mappingMemo.set(sig, memo);
  }

  const validated = validateMapping(table, memo.columns);
  return { ...memo, columns: validated.columns, corrections: validated.corrections };
}

/* ── Deterministic unit assembly ────────────────────────────────────────── */

export type TableUnit = {
  ref: string;
  label: string | null;
  block: string | null;
  floor: string | null;
  type: string | null;
  beds: string | null;
  baths: string | null;
  areaInternal: string | null;
  areaBuilt: string | null;
  areaPlot: string | null;
  areaVeranda: string | null;
  areaVerandaOpen: string | null;
  price: number | null;
  status: UnitStatus;
  attrs: { name: string; value: string }[];
};

export type TableExtraction = {
  units: TableUnit[];
  /** Rows deliberately not imported, with the reason — surfaced by the dry run. */
  dropped: { row: string; reason: string }[];
};

const nn = (v: string | undefined) => { const s = (v || "").trim(); return s && !isBlank(s) ? s : null; };

/* Area cells arrive with or without their unit of measure depending on the list
   (Golden View writes "123m²", every other project writes a bare "123"). Stored
   bare, because DevelopmentUnit's area fields are rendered with a "m²" suffix by
   the site — leaving the suffix in produces "123m² m²" on the public page. */
function normalizeArea(v: string | null): string | null {
  if (!v) return null;
  const s = v.replace(/\s*(m²|m2|sq\.?\s*m\.?|sqm)\s*$/i, "").replace(",", ".").trim();
  return s || null;
}

// Korantina's lists mix Greek Alpha/Nu into Latin words ("Villa Νο", villa type
// "Α") because the sheets were typed on a Greek keyboard. Left untouched, "Α4"
// and "A4" are different refs — so the same unit would be created twice, once per
// spelling, the first time they fix their template. Normalised on the way in.
// Only letters whose Greek and Latin glyphs are visually IDENTICAL are listed —
// mapping by sound instead (β→b, η→n) would rewrite text the developer meant as
// Greek. Lowercase matters as much as uppercase: their "Villa Νο" header is a
// capital Nu followed by a lowercase omicron.
const GREEK_LOOKALIKES: Record<string, string> = {
  "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M",
  "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
  "α": "a", "ε": "e", "ι": "i", "κ": "k", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "ν": "v",
};
export const deGreek = (s: string) => s.replace(/[\u0370-\u03FF]/g, (c) => GREEK_LOOKALIKES[c] ?? c);

export function unitsFromTable(table: RawTable, mapping: TableMapping): TableExtraction {
  const cols = mapping.columns;
  const at = (row: string[], field: ColumnField) => { const i = cols.indexOf(field); return i >= 0 ? nn(row[i]) : null; };
  const area = (row: string[], field: ColumnField) => normalizeArea(at(row, field));
  const labelOf = (i: number) => (mapping.labels?.[i] || table.headers[i] || "").replace(/\s+/g, " ").trim();
  const refIdx = cols.indexOf("ref");
  const blockIdx = cols.indexOf("block");
  const typeIdx = cols.indexOf("type");
  const priceIdx = cols.indexOf("price");
  const priceAltIdx = cols.indexOf("priceAlt");
  const blockLabel = blockIdx >= 0 ? labelOf(blockIdx) : "";

  const units: TableUnit[] = [];
  const dropped: { row: string; reason: string }[] = [];
  const show = (row: string[]) => row.filter(Boolean).join(" | ").slice(0, 160);

  for (const row of table.rows) {
    const bare = refIdx >= 0 ? nn(row[refIdx]) : null;
    if (!bare) { dropped.push({ row: show(row), reason: "no unit reference" }); continue; }

    // Outcome (status + price) is read ONLY from the mapped price column(s), in
    // order, and a row whose outcome cannot be read is dropped rather than
    // assumed available — the single most important rule in this file.
    const outcome =
      (priceIdx >= 0 ? readOutcome(row[priceIdx] ?? "") : null) ??
      (priceAltIdx >= 0 ? readOutcome(row[priceAltIdx] ?? "") : null);
    if (!outcome) { dropped.push({ row: show(row), reason: "no readable price/status" }); continue; }

    const block = blockIdx >= 0 ? nn(row[blockIdx]) : null;
    // The block value is prefixed onto the ref UNCONDITIONALLY when a block column
    // exists — not "only when refs collide". Cap St Georges genuinely has a villa 1
    // in phase H and another in phase P, and a collision-triggered rule would flip
    // every ref in the project the day one of those two sells out, orphaning the
    // whole unit table against the database.
    const refRaw = block ? `${block} ${bare}` : bare;
    const ref = deGreek(refRaw).replace(/\s+/g, " ").trim();

    const attrs: { name: string; value: string }[] = [];
    cols.forEach((field, i) => {
      if (field !== "attr") return;
      const v = nn(row[i]);
      const name = labelOf(i);
      if (v && name) attrs.push({ name, value: deGreek(v) });
    });
    // The developer's own variant letter ("Type A") is a per-unit SPEC, not the
    // property type — DevelopmentUnit.type is what the public page renders as
    // "Apartment"/"Villa", and putting a bare "A" there reads as a bug.
    const variant = typeIdx >= 0 ? nn(row[typeIdx]) : null;
    if (variant) attrs.push({ name: labelOf(typeIdx) || "Type", value: deGreek(variant) });
    if (priceAltIdx >= 0 && priceAltIdx !== priceIdx) {
      const alt = nn(row[priceAltIdx]);
      const altName = labelOf(priceAltIdx) || "Alternative price";
      if (alt && alt !== (row[priceIdx] ?? "").trim()) attrs.push({ name: altName, value: alt });
    }

    units.push({
      ref,
      label: block ? `${blockLabel ? `${blockLabel} ` : ""}${block} · ${deGreek(bare)}`.replace(/\s+/g, " ").trim() : null,
      block,
      floor: at(row, "floor"),
      type: mapping.unitKind || null,
      beds: at(row, "beds"),
      baths: at(row, "baths"),
      areaInternal: area(row, "areaInternal"),
      areaBuilt: area(row, "areaBuilt"),
      areaPlot: area(row, "areaPlot"),
      areaVeranda: area(row, "areaVeranda"),
      areaVerandaOpen: area(row, "areaVerandaOpen"),
      price: outcome.price,
      status: outcome.status,
      attrs,
    });
  }

  for (const stray of table.strayRows) dropped.push({ row: show(stray), reason: "row inside the table with no readable price/status" });

  // A duplicate ref inside one table means the reconstruction went wrong (two rows
  // collapsed, or the wrong column was chosen as ref) — keep the first, report the
  // rest, and never let a later row silently overwrite an earlier one downstream.
  const seen = new Set<string>();
  const unique = units.filter((u) => {
    const k = u.ref.toLowerCase();
    if (seen.has(k)) { dropped.push({ row: u.ref, reason: "duplicate unit reference within the same table" }); return false; }
    seen.add(k);
    return true;
  });

  return { units: unique, dropped };
}
