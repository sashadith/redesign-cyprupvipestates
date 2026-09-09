import {
  readPdfPages,
  mapTableColumns,
  deGreek,
  type PdfPage,
  type PdfRow,
  type PdfCell,
  type RawTable,
  type TableMapping,
  type ColumnField,
  type UnitStatus,
} from "./availabilityTable";

/* G&V's per-project PDF price list → units (2026-09-08).

   WHY THIS IS ITS OWN READER, AND NOT A WIDENING OF availabilityTable.ts.

   availabilityTable.ts reads Korantina Homes' 16 availability lists and is the
   only reader 18 live projects have. An earlier attempt taught it G&V's layouts
   as well; it passed 142 synthetic assertions and then, on a read-only dry run
   against Korantina's real PDFs, City Landmark fell from 33 units to 1, Royal
   Bay lost one, and Inner City 3 split into two tables — which for Korantina
   re-keys a project, because their identity is literally `<doc>-t<tableIndex>`.
   The rules that did the damage (a row-admission test, and admitting a one-row
   run as a table) are both NECESSARY for G&V and both HARMFUL to Korantina.
   They live here, where they can only ever see G&V's documents.

   WHAT THIS READER MAY ASSUME, THAT THE SHARED ENGINE MAY NOT. All five of
   G&V's price lists (Alta Mare, Georgia 12, Georgia Residences 2, Tsada
   Superior Villa, Tsada Phase D — read 2026-09-08) are ONE table on ONE page,
   with the price as the RIGHTMOST column. So there is deliberately no
   multi-table-per-page splitting, no continuation-page joining, no group-label
   handling and no phantom-column repair here: those exist in the shared engine
   for Korantina's documents and porting them would be copying complexity that
   nothing in this developer's data justifies. One of the five carries a second
   page holding a VAT-inclusive price column; it is ignored, and falls out of
   the "one table, the one with the most unit rows" rule rather than needing a
   special case.

   WHAT IS SHARED WITH availabilityTable.ts, AND WHY ONLY THAT. Imported from
   it: readPdfPages (the pdf.js worker), mapTableColumns (the one AI step — a
   question about column LABELS, never about values) and deGreek. Everything
   that decides a VALUE or a STATUS is implemented here, because every one of
   them needs to behave differently for G&V: prices carry cents and a millions
   shorthand, "SHOW HOUSE" is a status word, the outcome is regularly drawn as
   several text items, and a table of ONE unit is legitimate. Nothing in this
   file can change what Korantina's reader does.

   THE DIVISION OF LABOUR IS THE SAME ONE, THOUGH: no unit value ever comes from
   a model. The geometry below reconstructs the table from pdf.js positions; the
   model is asked only which column is the plot size and which is the bedroom
   count. A price or status cell that cannot be parsed resolves to UNKNOWN and
   is reported — never silently to "available". */

/* ── Values ─────────────────────────────────────────────────────────────── */

const BLANK_RE = /^(|[-–—=.]+|n\.?\/?a\.?|tbc|tba)$/i;
export const isBlankCell = (t: string) => BLANK_RE.test((t || "").trim());

const SOLD_RE = /^sold(\s*out)?$/i;
/* "SHOW HOUSE" is G&V's own word for a built unit that is not for sale (Alta
   Mare 7). It sits in the price column exactly where RESERVED does and means
   the same thing to a buyer, so it reads as `reserved` rather than `sold` — if
   the developer ever prices it, it returns to the market by itself. */
const RESERVED_RE = /^(reserved|show\s*house)$/i;

/* The four price forms G&V actually prints, and nothing else. A form this does
   not recognise returns null, which becomes an UNKNOWN outcome and a reported
   row — never a guess. In particular there is no bare-decimal branch: "194.3"
   is an area, and a reader that treated it as €194.30 would publish it. */
export function gvParsePrice(raw: string): number | null {
  const s = (raw || "").replace(/[€$£]/g, "").replace(/ /g, " ").trim();
  if (!s) return null;
  const whole = (grouped: string) => {
    const n = Number(grouped.replace(/[.,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  /* Grouped with cents — "€ 580,000.00", "1.234.567,89". The LAST separator is
     followed by exactly two digits and every earlier group by exactly three, so
     which separator is the decimal is fixed by shape, not guessed. This is how
     G&V writes almost every price. */
  const cents = s.match(/^(\d{1,3}(?:[.,\s]\d{3})+)[.,]\d{2}$/);
  if (cents) return whole(cents[1]);
  // Grouped, no cents — "415,000", "1.800.000", "1 250 000".
  if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(s)) return whole(s);
  /* Millions shorthand — "€1.95M" (Tsada Superior Villa). An "M" after a number
     has no other reading in a price list. */
  const millions = s.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
  if (millions) {
    const n = Math.round(Number(millions[1].replace(",", ".")) * 1_000_000);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  // Ungrouped — "415000". Four digits is the floor, so a year or a plot size
  // three digits long can never be read as a price.
  if (/^\d{4,9}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export type GvOutcome = { status: UnitStatus; price: number | null };

/* Status + price from one outcome cell. `null` means UNRESOLVED, and every
   caller here treats that as "report this row", never as "available". G&V's
   outcome vocabulary is exactly SOLD / RESERVED / SHOW HOUSE / an amount; the
   word "AVAILABLE" is deliberately NOT accepted, because they never print it
   and a document that started to would be a change worth seeing in the dry run
   rather than absorbing silently. */
export function gvReadOutcome(raw: string): GvOutcome | null {
  const s = (raw || "").trim();
  if (isBlankCell(s)) return null;
  if (SOLD_RE.test(s)) return { status: "sold", price: null };
  if (RESERVED_RE.test(s)) return { status: "reserved", price: null };
  const price = gvParsePrice(s);
  return price === null ? null : { status: "available", price };
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

// Two cell centres within this many points belong to the same column. Same
// value the shared engine measured against Korantina's tightest layout; G&V's
// tightest (Georgia 12, ~50pt pitch) is nowhere near it.
const COLUMN_TOLERANCE_PT = 14;
// How far above the table's first row to look for column headers. Georgia 12
// spreads its header over five separate y bands ~6pt apart plus a title line,
// so a band that only covers "the row above" reads nothing.
const HEADER_BAND_PT = 110;
// Fewer cells than this is a caption or a footnote line, not a table row.
const MIN_ROW_CELLS = 3;

/* A leftmost cell that reads as a unit reference: "1", "101", "A2", "12B".
   Deliberately tight — no hyphens, no spaces, no prose. This one predicate is
   what keeps Georgia Residences 2's "SWIMMING POOL EXTRA : € 15,000" line and
   Alta Mare's whole "OPTIONAL EXTRAS" block out of the unit list, and every
   G&V reference in all five documents is a bare number. Loosening it (as the
   shared engine has to, for Korantina's "A - 01" apartments) would let those
   surcharge lines back in as units priced at €15,000. */
const looksLikeUnitRef = (s: string) => /^[A-Za-z]{0,2}\d{1,4}[A-Za-z]?$/.test(deGreek((s || "").trim()));

const byX = (cells: PdfCell[]) => cells.slice().sort((a, b) => a.x - b.x);

/* Collapses whitespace inside a cell that is nothing but digits and spaces.
   pdf.js hands Georgia 12's prices over as several text runs split at kerning
   breaks — "2" and "90" land in the same clustered column and are joined with a
   space by toCells, exactly as every other column's fragments are, but here
   "2 90" really is the digits of "290". Cells carrying real punctuation
   (",000.00") are left untouched. */
const collapseDigitSpaces = (t: string) => {
  const s = (t || "").trim();
  return /^\d[\d\s]*$/.test(s) ? s.replace(/\s+/g, "") : s;
};

/* THE one rule this file uses to reassemble an outcome drawn as several pieces:
   concatenate them with NO separator. G&V splits a price three ways —
   "€" + "580,000.00" (Alta Mare), "€" + "SOLD"/"730,000.00" in separate columns
   (Tsada Phase D), and "€" + "2" + "90" + ",000.00" (Georgia 12) — and all
   three reassemble by plain concatenation once the pieces are known. Which
   pieces belong to the outcome is decided ONCE, per table, by outcomeSpan
   below; nothing here guesses per row. */
const joinOutcome = (parts: string[]) => parts.map(collapseDigitSpaces).join("").trim();

/* Does SOME trailing run of this row's cells read as a price or a status? This
   is the loose, row-classification test — it only decides "is this a row of the
   table at all", never what the row's price IS. It is allowed to be ambiguous
   (several trailing runs of a Georgia 12 row parse, to different numbers);
   outcomeSpan resolves that ambiguity later, with the whole table in view.
   The run never starts at the leftmost cell: a row whose entire content is a
   price is a footnote, not a unit. */
function looksLikeTableRow(row: PdfRow): boolean {
  if (row.cells.length < MIN_ROW_CELLS) return false;
  const texts = byX(row.cells).map((c) => c.t);
  for (let start = texts.length - 1; start >= 1; start--) {
    if (gvReadOutcome(joinOutcome(texts.slice(start))) !== null) return true;
  }
  return false;
}

/* Maximal stretches of table-looking rows. No header-row detection and no
   multi-table splitting, unlike the shared engine: each G&V document holds one
   table. Contiguity alone is what separates Alta Mare's eight villas from its
   "OPTIONAL EXTRAS" block eleven rows further down the same page — that block's
   lines are individually price-shaped, but the "Prices don't include VAT." and
   "INCLUDED IN PRICE" lines between them break the run.

   ONE interruption does not end a run, though. A unit whose price simply is not
   printed ("ON REQUEST", a blank cell) fails looksLikeTableRow, and dropping it
   here would both hide that unit completely and cut the table in two. Kept in
   the run instead, it reaches the grid, resolves to UNKNOWN, and is reported —
   which is the whole point of never defaulting an unreadable cell. */
const RUN_GAP_TOLERANCE = 2;
function contiguousRuns(rows: PdfRow[]): PdfRow[][] {
  const isRow = rows.map(looksLikeTableRow);
  const runs: PdfRow[][] = [];
  let current: PdfRow[] | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (isRow[i]) {
      if (!current) { current = []; runs.push(current); }
      current.push(rows[i]);
      continue;
    }
    if (!current) continue;
    if (isRow.slice(i + 1, i + 1 + RUN_GAP_TOLERANCE).some(Boolean)) current.push(rows[i]);
    else current = null;
  }
  return runs;
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

function nearestAnchor(centre: number, anchors: number[]): number {
  let index = 0, best = Infinity;
  anchors.forEach((a, i) => { const d = Math.abs(a - centre); if (d < best) { best = d; index = i; } });
  return index;
}

function toCells(row: PdfRow, anchors: number[]): string[] {
  const out = anchors.map(() => "");
  for (const c of byX(row.cells)) {
    const i = nearestAnchor(c.x + c.w / 2, anchors);
    out[i] = out[i] ? `${out[i]} ${c.t}` : c.t;
  }
  return out.map((s) => s.trim());
}

/* Which trailing columns form the outcome, decided once for the whole table.

   The candidate is always a TRAILING span — the price is the rightmost column
   in all five G&V lists — so the only question is where it STARTS. Every start
   is tried and scored by how many rows it resolves for; ties go to the
   NARROWEST span, because a column the outcome does not need is a column that
   belongs to something else. Both halves of that rule are load-bearing:

     WIDEST WOULD BE WRONG. Tsada Superior Villa's land area "1100" sits
     immediately left of "€1.95M", and "1100€1.95M" parses perfectly well as
     the millions shorthand — €11,001,950,000. Narrowest stops at the price.

     NARROWEST ALONE WOULD BE WRONG. Georgia 12's last column holds ",000.00"
     on five of nine rows, which parses on none of them; two rows' last column
     happens to hold "5,000.00", which parses to a very wrong €5,000. Scoring
     by resolved-row COUNT first is what rejects that column outright and moves
     the start one column left, onto the digit fragments, where all nine rows
     resolve — to the right numbers. */
function outcomeSpan(rows: string[][], width: number): { start: number; outcomes: (GvOutcome | null)[] } | null {
  const read = (start: number) => {
    const outcomes = rows.map((r) => gvReadOutcome(joinOutcome(r.slice(start))));
    return { start, outcomes, resolved: outcomes.filter(Boolean).length };
  };
  let best: { start: number; outcomes: (GvOutcome | null)[]; resolved: number } | null = null;
  for (let start = width - 1; start >= 1; start--) {
    const candidate = read(start);
    if (!best || candidate.resolved > best.resolved) best = candidate;
  }
  if (!best || best.resolved === 0) return null;

  /* A column holding nothing but a bare currency symbol is part of the price,
     never a column of its own. G&V draws the "€" far enough from the amount
     that clustering gives it its own column on three of the five lists, and
     the narrowest-span rule above correctly stops short of it (prefixing "€"
     to an amount that already parses changes nothing). Left standing, it would
     reach mapTableColumns as a real column and could come back labelled and
     mapped as an `attr`, putting "Currency: €" on every unit's spec list.
     Absorbed only while the resolved-row count is unharmed. */
  const isBareSymbol = (t: string) => /^[€$£]$/.test((t || "").trim());
  while (best.start > 1 && rows.every((r) => isBlankCell(r[best!.start - 1] ?? "") || isBareSymbol(r[best!.start - 1] ?? ""))) {
    const wider = read(best.start - 1);
    if (wider.resolved < best.resolved) break;
    best = wider;
  }
  return { start: best.start, outcomes: best.outcomes };
}

export type GvTable = {
  page: number;
  headers: string[];
  /** Cells per row, with the outcome span already collapsed into one column. */
  rows: string[][];
  /** Index of that collapsed outcome column — always the last one. */
  outcomeIndex: number;
  /** Resolved outcome per row, index-aligned with `rows`. `null` is UNKNOWN. */
  outcomes: (GvOutcome | null)[];
  /** Rows inside the table's own band that are not units, with the reason. */
  refused: { row: string; reason: string }[];
};

/* Reconstructs G&V's single table, verbatim, with no AI involved.

   The one document-level choice is which run of rows is the table: the run with
   the most rows that OPEN with a unit reference. Not the longest run, and not
   the first: Alta Mare's "OPTIONAL EXTRAS" block is five consecutive
   price-shaped lines, and its Georgia Residences 2 sibling — the single
   "SWIMMING POOL EXTRA" line — is glued to the bottom of the real table with no
   blank row to separate it. Counting unit references tells all three apart in
   one measure. */
export function gvTableFromPages(pages: PdfPage[]): GvTable | null {
  type Candidate = { page: PdfPage; run: PdfRow[]; admitted: PdfRow[]; refused: PdfRow[] };
  let chosen: Candidate | null = null;

  const opensWithRef = (r: PdfRow) => r.cells.length > 0 && looksLikeUnitRef(byX(r.cells)[0].t);
  for (const page of pages) {
    for (const run of contiguousRuns(page.rows)) {
      const admitted = run.filter(opensWithRef);
      const refused = run.filter((r) => !opensWithRef(r));
      if (!chosen || admitted.length > chosen.admitted.length) chosen = { page, run, admitted, refused };
    }
  }
  if (!chosen || !chosen.admitted.length) return null;

  /* Column positions come from the ADMITTED rows only. A refused row's own
     geometry — Georgia Residences 2's surcharge line has three cells where the
     villas have seven — must never get a vote on where this table's columns
     are. */
  const anchors = columnAnchors(chosen.admitted);
  if (anchors.length < 3) return null;

  /* The header band is anchored on the run's FIRST row, not its first admitted
     one: rejecting a leading row must not slide the band down by that row's
     height and change every label. */
  const topY = chosen.run[0].y;
  const bodyY = new Set(chosen.run.map((r) => r.y));
  const headerRows = chosen.page.rows.filter((r) => r.y > topY && r.y <= topY + HEADER_BAND_PT && !bodyY.has(r.y));

  /* Header text is read positionally and the band deliberately does NOT exclude
     the page title that shares it — the labels are read as prose by
     mapTableColumns, whose prompt says exactly that, and whose answer is checked
     against the column's own values anyway. Losing a real label to a tidier
     band is the worse trade. Fragments are ordered top line first, then left to
     right, so a two-line header reads in the order it is printed. */
  const buckets: { t: string; y: number; x: number }[][] = anchors.map(() => []);
  for (const hr of headerRows) {
    for (const c of hr.cells) buckets[nearestAnchor(c.x + c.w / 2, anchors)].push({ t: c.t, y: hr.y, x: c.x });
  }
  const headers = buckets.map((b) =>
    b.sort((a, z) => z.y - a.y || a.x - z.x).map((c) => c.t).join(" ").replace(/\s+/g, " ").trim(),
  );

  const grid = chosen.admitted.map((r) => toCells(r, anchors));
  const span = outcomeSpan(grid, anchors.length);
  if (!span) return null;

  const rows = grid.map((r) => [...r.slice(0, span.start), joinOutcome(r.slice(span.start))]);
  const outcomeHeader = headers.slice(span.start).filter(Boolean).join(" ").trim();

  return {
    page: chosen.page.page,
    headers: [...headers.slice(0, span.start), outcomeHeader],
    rows,
    outcomeIndex: span.start,
    outcomes: span.outcomes,
    refused: chosen.refused.map((r) => ({
      row: byX(r.cells).map((c) => c.t).join(" ").trim(),
      reason: "row inside the table that does not open with a unit reference",
    })),
  };
}

/* ── Reference policy ───────────────────────────────────────────────────── */

/* Which field a G&V column header NAMES. Used for one job only: telling a real
   reference column apart from another attribute that was pressed into service
   as one.

   mapTableColumns runs the shared engine's validateMapping, which — correctly,
   for Korantina — refuses to leave `ref` unset and falls back to the leftmost
   fully-populated column. Tsada Superior Villa is one villa on one row with no
   "No." column at all, so EVERY column is fully populated and the fallback
   lands on the bedroom count: the villa would be published as unit "5", and the
   bedroom count would be gone as well, because the fallback overwrites whatever
   field the model had put there. That validator is frozen (it is Korantina's),
   so the correction is applied here instead, afterwards.

   Matching the LABEL, not just the values, is what makes this work on a
   one-row table: "5" is a perfectly reference-shaped value, and uniqueness
   proves nothing when there is a single row. A column the mapper itself named
   after another attribute is not this table's reference, whatever its values
   look like. */
const FIELD_BY_LABEL: [RegExp, ColumnField][] = [
  [/bedroom|\bbeds?\b|\bbdr\b/i, "beds"],
  [/bathroom|\bbaths?\b|\bwc\b/i, "baths"],
  [/internal/i, "areaInternal"],
  [/\bland\b|\bplot\b/i, "areaPlot"],
  [/uncovered|open\s*veranda/i, "areaVerandaOpen"],
  [/veranda|balcon/i, "areaVeranda"],
  [/covered\s*area|built|total/i, "areaBuilt"],
  [/price|\bvat\b/i, "price"],
  [/floor|level|storey/i, "floor"],
];
const fieldNamedBy = (label: string): ColumnField | null =>
  FIELD_BY_LABEL.find(([re]) => re.test(label || ""))?.[1] ?? null;

// A reference column's values must be short unit codes, and must identify a
// unit — a code repeated across rows identifies nothing.
const REF_VALUE_MIN_SHARE = 0.9;
const REF_UNIQUE_MIN_SHARE = 0.9;

export type RefPolicyResult = {
  /** Column index to read the reference from, or -1 when the table has none. */
  refIndex: number;
  /** `mapping.columns` with a rejected reference column put back to a real field. */
  columns: ColumnField[];
  /** What was overridden and why — surfaced by the dry run. */
  notes: string[];
};

/* Judges the `ref` column mapTableColumns settled on, and reassigns it when it
   is not one. A rejected column is not thrown away: it goes back to the field
   its own label names (which is what the model had said before the shared
   validator commandeered it), or to `attr` if that field is already taken, so
   Tsada Superior Villa keeps its five bedrooms instead of trading them for a
   made-up reference. */
export function applyRefPolicy(table: GvTable, mapping: TableMapping): RefPolicyResult {
  const columns = mapping.columns.slice();
  const notes: string[] = [];
  const refIndex = columns.indexOf("ref");
  if (refIndex < 0) {
    notes.push("no column was mapped as the unit reference");
    return { refIndex: -1, columns, notes };
  }

  const label = (mapping.labels?.[refIndex] || table.headers[refIndex] || "").trim();
  const values = table.rows.map((r) => (r[refIndex] ?? "").trim()).filter((v) => !isBlankCell(v));
  const named = fieldNamedBy(label);
  const codeShare = values.length ? values.filter((v) => looksLikeUnitRef(v)).length / values.length : 0;
  const uniqueShare = values.length ? new Set(values.map((v) => v.toLowerCase())).size / values.length : 0;

  let reason = "";
  if (named) reason = `its header names the ${named} column`;
  else if (values.length < table.rows.length) reason = "it is blank on some rows";
  else if (codeShare < REF_VALUE_MIN_SHARE) reason = "its values do not read as unit references";
  else if (uniqueShare < REF_UNIQUE_MIN_SHARE) reason = "its values repeat across rows";
  if (!reason) return { refIndex, columns, notes };

  const restored: ColumnField = named && !columns.includes(named) ? named : "attr";
  columns[refIndex] = restored;
  notes.push(`column ${refIndex} ("${label || "?"}") was mapped as the unit reference but ${reason} — read as "${restored}" instead, and the project name stands in as the reference`);
  return { refIndex: -1, columns, notes };
}

/* ── Unit assembly ──────────────────────────────────────────────────────── */

export type GvUnit = {
  ref: string;
  /** The kind of home (mapTableColumns' `unitKind`), never the variant letter. */
  type: string | null;
  floor: string | null;
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

export type GvExtraction = {
  units: GvUnit[];
  /** Rows deliberately not imported, with the reason — surfaced by the dry run. */
  dropped: { row: string; reason: string }[];
  /** Outcome cells that resolved to neither a status nor a price. */
  unresolved: { row: string; cell: string }[];
  /** Reference-policy overrides. */
  notes: string[];
};

const nn = (v: string | undefined) => { const s = (v || "").trim(); return s && !isBlankCell(s) ? s : null; };

/* Areas are stored bare: the public page renders them with an "m²" suffix of
   its own, and leaving the printed one in produces "147m² m²". */
function normalizeArea(v: string | null): string | null {
  if (!v) return null;
  const s = v.replace(/\s*(m²|m2|sq\.?\s*m\.?|sqm)\s*$/i, "").replace(",", ".").trim();
  return s || null;
}

/* Builds units from the reconstructed table. Status and price come from the
   table's own resolved outcomes, never from the mapping — the outcome column
   was identified by geometry before the model was ever asked anything, so a
   mis-mapped column cannot produce a wrong price here, only a wrong area
   label. */
export function unitsFromGvTable(table: GvTable, mapping: TableMapping, opts: { fallbackRef: string }): GvExtraction {
  const policy = applyRefPolicy(table, mapping);
  const cols = policy.columns;
  const at = (row: string[], field: ColumnField) => { const i = cols.indexOf(field); return i >= 0 ? nn(row[i]) : null; };
  const area = (row: string[], field: ColumnField) => normalizeArea(at(row, field));
  const labelOf = (i: number) => (mapping.labels?.[i] || table.headers[i] || "").replace(/\s+/g, " ").trim();
  const typeIdx = cols.indexOf("type");

  const units: GvUnit[] = [];
  const dropped: { row: string; reason: string }[] = table.refused.slice();
  const unresolved: { row: string; cell: string }[] = [];
  const show = (row: string[]) => row.filter(Boolean).join(" | ").slice(0, 160);

  table.rows.forEach((row, i) => {
    const outcome = table.outcomes[i];
    if (!outcome) {
      // Never "available". An outcome cell nobody could read is a row a human
      // has to look at, not a unit to publish at an unknown status.
      unresolved.push({ row: show(row), cell: row[table.outcomeIndex] ?? "" });
      dropped.push({ row: show(row), reason: "price/status cell could not be read" });
      return;
    }

    /* With no reference column (Tsada Superior Villa), the project's own name
       stands in for every row. That is only ever correct because such a table
       has exactly one row — a second row would collide, so it is refused. */
    let ref = policy.refIndex >= 0 ? nn(row[policy.refIndex]) : opts.fallbackRef;
    if (policy.refIndex < 0 && table.rows.length > 1) ref = null;
    if (!ref) { dropped.push({ row: show(row), reason: "no unit reference" }); return; }

    const attrs: { name: string; value: string }[] = [];
    cols.forEach((field, idx) => {
      if (field !== "attr") return;
      const v = nn(row[idx]);
      const name = labelOf(idx);
      if (v && name) attrs.push({ name, value: deGreek(v) });
    });
    // The developer's own variant letter is a per-unit SPEC. DevelopmentUnit.type
    // is what the public page renders as "Apartment"/"Villa", and a bare "A"
    // there reads as a bug.
    const variant = typeIdx >= 0 ? nn(row[typeIdx]) : null;
    if (variant) attrs.push({ name: labelOf(typeIdx) || "Type", value: deGreek(variant) });

    units.push({
      ref: deGreek(ref).replace(/\s+/g, " ").trim(),
      type: mapping.unitKind || null,
      floor: at(row, "floor"),
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
  });

  // A duplicate reference inside one table means the reconstruction went wrong.
  // Keep the first, report the rest, never let a later row silently overwrite
  // an earlier one downstream.
  const seen = new Set<string>();
  const unique = units.filter((u) => {
    const k = u.ref.toLowerCase();
    if (seen.has(k)) { dropped.push({ row: u.ref, reason: "duplicate unit reference within the same table" }); return false; }
    seen.add(k);
    return true;
  });

  return { units: unique, dropped, unresolved, notes: policy.notes };
}

/* ── End to end ─────────────────────────────────────────────────────────── */

export type GvReadResult =
  | { ok: false; message: string }
  | { ok: true; table: GvTable; mapping: TableMapping; extraction: GvExtraction };

/** PDF buffer → the table → units. The only AI step is the column mapping. */
export async function readGvPriceList(buf: Buffer, projectName: string): Promise<GvReadResult> {
  const table = gvTableFromPages(await readPdfPages(buf));
  if (!table) return { ok: false, message: `No price table found in the PDF price list for “${projectName}”` };
  // mapTableColumns takes the shared engine's RawTable. `page`/`index` are only
  // ever read by the sync that keys Korantina's projects on them, and
  // `strayRows` by its own dry-run reporting; neither reaches the model, and
  // neither has a meaning here.
  const asRawTable: RawTable = { page: table.page, index: 0, headers: table.headers, rows: table.rows, strayRows: [] };
  const mapping = await mapTableColumns(asRawTable, projectName);
  return { ok: true, table, mapping, extraction: unitsFromGvTable(table, mapping, { fallbackRef: projectName }) };
}
