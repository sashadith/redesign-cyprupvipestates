import type { DropboxFile } from "./dropbox";
import type { ColumnField, RawTable, TableUnit } from "./ai/availabilityTable";
import { normalizeRef } from "./unitRef";

/* Stylianides Group — the pure half of their price-list connector (2026-10-30).

   Stylianides (CCS Stylianides Group, Limassol) share ONE Dropbox link per
   project, with no parent folder: brochure, plans, pictures and a Maps-pin docx
   in subfolders, and the current price list as a PDF at the folder's root, its
   date in the file name ("MELROSE VILLAS - PRICE LIST 28-10-2026.pdf"). The link
   lives on the project's own Development row (driveFolderId — see
   stylianidesSync.ts), never in the repo: a shared link is a bearer credential.

   The PDFs are read by Korantina's table engine (availabilityTable.ts), which
   reconstructed all eight lists of 2026-10-30 from pdf.js positions — both
   buildings where one page holds two tables (Mirror, Residence 28), both pages
   of King's Resort. The G&V reader was tried first and is the wrong one: it
   assumes one table per document and the price as the rightmost column, so it
   kept one building of two and lost every row of Harmony and Melrose.

   What is Stylianides-specific lives here, as table→table and unit→unit steps
   around the shared engine, so nothing in this file can change what Korantina's
   reader does:
   - King's Resort prints the euro sign as its own column ("€" | "390,000");
   - Harmony and Melrose print COMPLETION to the right of the price, and a sold or
     reserved villa has its status THERE, with "-" or nothing in the price cell;
   - Trianon prints the plot number once per villa group, as a row of its own;
   - nobody types a penthouse as such, and the floor is only in the reference. */

/* ── Which file is the price list ─────────────────────────────────────────── */

const NOT_A_PRICE_LIST_RE = /brochure|plans?\b|pictures?|photos?|analysis|yield|location|spec|render/i;
// "PRICE LIST", or a date in the name the way Stylianides write it on the two
// files that do not say "price list" ("MIRROR_RESIDENCE BLD A & B 27-10-2026",
// "SOUNI VILLAS 24-09-2026"): dd-mm-yy(yy), or a month name and a year.
const PRICE_LIST_NAME_RE = /price\s*-?\s*list|\b\d{1,2}[-._]\d{1,2}[-._]\d{2,4}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+20\d\d\b/i;

/** The price list among a project folder's ROOT files: a PDF named like one, the newest if several. */
export function findStylianidesPriceList(rootFiles: DropboxFile[]): DropboxFile | null {
  const candidates = rootFiles.filter((f) =>
    /\.pdf$/i.test(f.name) && PRICE_LIST_NAME_RE.test(f.name) && !NOT_A_PRICE_LIST_RE.test(f.name.replace(/price\s*-?\s*list/i, "")));
  return candidates.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : a.modifiedTime > b.modifiedTime ? -1 : 0))[0] ?? null;
}

/* ── Table repairs before the column mapping ──────────────────────────────── */

const blank = (t: string | undefined) => /^(|[-–—=.]+)$/.test((t ?? "").trim());
const STATUS_RE = /^(sold(\s*out)?|reserved)$/i;

export function normalizeStylianidesTable(t: RawTable): RawTable {
  let headers = t.headers.slice();
  let rows = t.rows.map((r) => r.slice());

  // A column holding nothing but currency signs is the price's own "€", printed
  // as a separate text item. Dropping it leaves "390,000" / "SOLD" in the next
  // column, which readOutcome reads like any other price cell.
  const currencyOnly = headers.map((_, i) =>
    rows.some((r) => /^[€$£]$/.test((r[i] ?? "").trim())) && rows.every((r) => blank(r[i]) || /^[€$£]$/.test((r[i] ?? "").trim())));
  if (currencyOnly.some(Boolean)) {
    headers = headers.filter((_, i) => !currencyOnly[i]);
    rows = rows.map((r) => r.filter((_, i) => !currencyOnly[i]));
  }

  // Status printed in the completion column: move it into the price cell, which
  // is where the column mapper and readOutcome look for it. Only when the price
  // cell is empty — a priced row keeps its price and its delivery time.
  const priceIdx = headers.findIndex((h) => /price/i.test(h));
  if (priceIdx >= 0) {
    headers.forEach((h, j) => {
      if (j <= priceIdx || !/completion|delivery/i.test(h)) return;
      for (const r of rows) {
        if (blank(r[priceIdx]) && STATUS_RE.test((r[j] ?? "").trim())) {
          r[priceIdx] = r[j].trim();
          r[j] = "";
        }
      }
    });
  }

  // A stray row with ONE short number and nothing else is a group label (the
  // plot number Trianon prints between its villas), not a unit that failed to
  // read — reporting it as a dropped row every night would bury real ones.
  const strayRows = t.strayRows.filter((r) => {
    const filled = r.filter((c) => !blank(c));
    return !(filled.length === 1 && /^\d{1,3}$/.test(filled[0].trim()));
  });

  // Villa lists give their areas PER FLOOR (Harmony "INTERNAL GR. FLOOR" +
  // "INTERNAL UP. FLOOR"; Trianon a ground- and a 1st-floor group of covered
  // area, covered veranda and uncovered veranda) and no total, so the totals are
  // added here from the raw headers, before any model sees the table, and
  // fixStylianidesMapping pins them. Left to the mapper on 2026-10-30, Harmony's
  // interior came back as its ground floor (76 m² of 164) and Trianon's ground-
  // floor interior as its "covered veranda", with the floor labels swapped.
  for (const sum of FLOOR_SUMS) {
    const parts = componentColumns(headers, sum.part);
    if (parts.length < 2) continue;
    headers = [...headers, sum.header];
    rows = rows.map((r) => {
      const total = parts.reduce((acc, i) => acc + (/^\d+(?:[.,]\d+)?$/.test((r[i] ?? "").trim()) ? Number(r[i].trim().replace(",", ".")) : 0), 0);
      return [...r, total > 0 ? String(Math.round(total * 10) / 10) : ""];
    });
  }

  return { ...t, headers, rows, strayRows };
}

const SUM_MARK = "(SUM OF FLOORS)";
const FLOOR_SUMS: { header: string; field: ColumnField; label: string; part: (h: string) => boolean }[] = [
  {
    header: `INTERNAL AREA ${SUM_MARK}`, field: "areaInternal", label: "Internal area",
    part: (h) => /internal|\bcovered\s*2?\s*area\b/i.test(h) && !/veranda|parking|basement|total|indoor|common|store|storage/i.test(h),
  },
  {
    header: `COVERED VERANDA ${SUM_MARK}`, field: "areaVeranda", label: "Covered verandas",
    part: (h) => /\bcovered\s*veranda/i.test(h) && !/un-?\s*covered/i.test(h),
  },
  {
    header: `UNCOVERED VERANDA ${SUM_MARK}`, field: "areaVerandaOpen", label: "Uncovered verandas",
    part: (h) => /un-?\s*covered\s*(veranda|terrace)/i.test(h),
  },
];
const componentColumns = (headers: string[], part: (h: string) => boolean) =>
  headers.map((h, i) => (!h.includes(SUM_MARK) && part(h) ? i : -1)).filter((i) => i >= 0);

/* An added total IS that field, and nothing else is — whatever the model
   answered. The per-floor columns it was added from are dropped from the specs:
   their labels are the model's reading of a shifted header (Trianon's came back
   swapped), and a wrong label on a public spec is worse than no line. */
export function fixStylianidesMapping<M extends { columns: ColumnField[]; labels: string[] }>(m: M, headers: string[]): M {
  const columns = m.columns.slice();
  const labels = m.labels.slice();
  for (const sum of FLOOR_SUMS) {
    const k = headers.indexOf(sum.header);
    if (k < 0) continue;
    columns.forEach((c, i) => { if (c === sum.field) columns[i] = "attr"; });
    for (const i of componentColumns(headers, sum.part)) columns[i] = "ignore";
    columns[k] = sum.field;
    labels[k] = sum.label;
  }
  return { ...m, columns, labels };
}

/** Sent to the column mapper with every table: what a reference looks like here. */
export const stylianidesMappingContext = (projectName: string) =>
  `${projectName} — Stylianides Group price list. Unit references look like A101, B402, 101, 6A or 3b. ` +
  `In a villa list a separate running number next to them (12, 13, 14 beside 6A, 6B, 6C) or a plot-group number ` +
  `is NOT the reference. A COMPLETION column holds a delivery time, never a price.`;

/* ── Unit refinement after the mapping ────────────────────────────────────── */

// "A101", "B802", "301": the hundreds digit is the floor. Villas ("6A", "3b",
// "12") have no floor in their reference and get none.
const FLOOR_REF_RE = /^[A-Z]?(\d)(\d{2})$/i;
// An uncovered veranda / roof terrace this large on the top floor of its
// building is a penthouse terrace, not a balcony. The smallest real one in the
// 2026-10-30 lists is Residence 28 B402 (61 m²); the largest ordinary balcony is
// 17.5 m² (Mirror A104).
const PENTHOUSE_TERRACE_M2 = 40;

const num = (v: string | null | undefined) => {
  const m = (v ?? "").replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Floors from references, "Studio" from the bedroom cell, "Penthouse" for top-floor units with a roof terrace. */
export function refineStylianidesUnits<T extends TableUnit>(units: T[]): T[] {
  const floorOf = (u: T) => { const m = FLOOR_REF_RE.exec(u.ref.trim()); return m ? Number(m[1]) : null; };
  const building = (u: T) => (/^[A-Z]/i.test(u.ref.trim()) ? u.ref.trim()[0].toUpperCase() : "");
  const topFloor = new Map<string, number>();
  for (const u of units) {
    const f = floorOf(u);
    if (f !== null) topFloor.set(building(u), Math.max(topFloor.get(building(u)) ?? 0, f));
  }

  return units.map((u) => {
    const out = { ...u, attrs: u.attrs.slice() };
    const f = floorOf(u);
    if (f !== null && !out.floor) out.floor = String(f);
    // The mapper's unitKind once came back as "\"Apartment\"", quotes included (Mirror, 2026-10-30).
    if (out.type) out.type = out.type.replace(/["'“”‘’]/g, "").trim() || null;

    if (/^studio$/i.test((out.beds ?? "").trim())) { out.beds = "0"; out.type = "Studio"; }
    else if (out.beds) out.beds = out.beds.replace(/(\d)\.(?=\s*\/)/, "$1").replace(/\s*\/\s*/, " / ").trim(); // "4. / 6" → "4 / 6"

    const terrace = num(u.areaVerandaOpen) ?? 0;
    const roofRoom = u.attrs.some((a) => /roof/i.test(a.name) && (num(a.value) ?? 0) > 0);
    if (f !== null && f === topFloor.get(building(u)) && (terrace >= PENTHOUSE_TERRACE_M2 || roofRoom) && (!out.type || /apartment/i.test(out.type))) {
      out.type = "Penthouse";
    }
    return out;
  });
}

/* ── Guards ───────────────────────────────────────────────────────────────── */

/* The column mapper is a model. If it ever picks a different column as the
   reference (Trianon prints 6A and a running 12 side by side), every unit would
   come back under a new ref: the old rows would turn "unlisted", new rows with
   new ids would appear, and a published page would lose its unit ids — which
   are what Xellex and client presentations hold. So a fresh list that shares
   fewer than half of the references we already list is refused, not written. */
export function refDrift(existingRefs: string[], freshRefs: string[], projectName: string): string | null {
  if (existingRefs.length < 3) return null;
  const fresh = new Set(freshRefs.map((r) => normalizeRef(r, projectName)));
  const kept = existingRefs.filter((r) => fresh.has(normalizeRef(r, projectName))).length;
  return kept / existingRefs.length < 0.5
    ? `only ${kept} of ${existingRefs.length} listed units are still in the price list — refusing the write (column mapping or a renamed list?)`
    : null;
}

/** Units of every table in the document, in document order; a ref seen twice keeps its first row. */
export function mergeTableUnits<T extends TableUnit>(tables: T[][], projectName: string): { units: T[]; duplicates: string[] } {
  const seen = new Set<string>();
  const units: T[] = [];
  const duplicates: string[] = [];
  for (const u of tables.flat()) {
    const k = normalizeRef(u.ref, projectName);
    if (seen.has(k)) { duplicates.push(u.ref); continue; }
    seen.add(k);
    units.push(u);
  }
  return { units, duplicates };
}
