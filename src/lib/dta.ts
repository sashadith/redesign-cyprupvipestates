import type { DropboxFile } from "./dropbox";
import { parsePrice, type PdfPage, type PdfRow } from "./ai/availabilityTable";
import { normalizeRef } from "./unitRef";
import { refDrift } from "./stylianides";
import { stripPinnedUnitFields } from "./unitPins";

/* DTA Group (Limassol) — the pure half of their daily price-list connector
   (2026-11-13). The Dropbox + database half is dtaSync.ts.

   DTA was onboarded by hand on 2026-10-29 (scripts/dta-sync.mjs): seven
   dev:"manual" Developments, feedKey "manual:dta-<slug>", every unit
   source:"manual". This connector keeps the STATUS and PRICE of those units in
   step with the developer's own price lists; it never creates a unit, never
   deletes one, and never writes anything else (no areas, no texts, no gallery,
   no project fields). The area rules of the manual import (areaInternal and
   areaBuilt both carry the pure interior figure, the developer's inclusive total
   lives in attrs) therefore stay exactly as the import wrote them.

   WHY IT MAY TOUCH source:"manual" UNITS. Every generic sync refuses manual
   units. This one is scoped to the DTA account's own manual:dta-* Developments
   and is the reason those units exist at all: they are a transcription of these
   very price lists. A hand correction that must survive the next list is a
   per-unit PIN (unitPins.ts — status and/or price), which this connector
   honours exactly like the feed writers do.

   WHY A DETERMINISTIC READER. DTA's lists are text-layer tables with a labelled
   header ("Unit" / "House No.", "Bedrooms", "Price (€) + VAT"). The column SET
   differs per list (iHome adds Floor, Luma studio and mechanical room, Level
   plot and type), so columns are found by their header LABEL and position —
   see "Reading one list" for what the six real lists of 2026-11-13 taught. No
   model is involved; the guards are about the document changing shape, and a
   price guard (planDtaWrite) makes sure a misread can never become a price. */

/* ── Which folder and file belong to which project ───────────────────────── */

export type DtaProject = {
  /** feedKey suffix of the Development: "manual:dta-<slug>". */
  slug: string;
  name: string;
  /** Matches the project folder's name at the share root. */
  folder: RegExp;
  /** A file the price-list folder may hold that is NOT this project's list. */
  excludeFile?: RegExp;
  /** When set, the list's file name must match (LEVEL holds two lists). */
  requireFile?: RegExp;
};

/* ALTI has no price list (its one unit came from a presentation) and is left
   alone; the root deck PDF and the FOR RENT folder are out of scope. LEVEL holds
   "LEVEL RESIDENCES Price List.pdf" (ours) and "LEVEL PLOTS Price List.pdf"
   (building land, ruled out by the operator 2026-10-29). */
export const DTA_PROJECTS: DtaProject[] = [
  { slug: "mandarin", name: "Mandarin", folder: /^mandarin\b/i },
  { slug: "athina-residences", name: "Athina Residences", folder: /^athina\b/i },
  { slug: "ihome", name: "iHOME", folder: /^i\s*-?\s*home\b/i },
  { slug: "only-tower", name: "ONLY Tower", folder: /^only\b/i },
  { slug: "level-residences", name: "Level Residences", folder: /^level\b/i, requireFile: /residences/i },
  { slug: "luma-residences", name: "Luma Residences", folder: /^luma\b/i },
];

export const dtaFeedKey = (slug: string) => `manual:dta-${slug}`;

const FOLDER_MIME = "application/vnd.dropbox.folder";
const isFolder = (f: DropboxFile) => f.mimeType === FOLDER_MIME;
const PRICE_FOLDER_RE = /^price\s*-?\s*lists?$/i;
const PLOTS_RE = /\bplots?\b/i;

/** The project's folder among the share root's entries. Two candidates = ambiguous = none. */
export function findDtaProjectFolder(root: DropboxFile[], p: DtaProject): { folder: DropboxFile | null; issue?: string } {
  const hits = root.filter((f) => isFolder(f) && p.folder.test(f.name.trim()));
  if (hits.length > 1) return { folder: null, issue: `${hits.length} folders match ${p.name} (${hits.map((f) => f.name).join(", ")})` };
  return hits.length ? { folder: hits[0] } : { folder: null, issue: `no ${p.name} folder at the share root` };
}

/** "Price List" / "Price list" / "Price lists" / "Pricelist" inside a project folder. */
export function findDtaPriceFolder(entries: DropboxFile[]): DropboxFile | null {
  return entries.find((f) => isFolder(f) && PRICE_FOLDER_RE.test(f.name.trim())) ?? null;
}

/** The project's price list inside its price-list folder: the newest PDF that is not a plot list. */
export function findDtaPriceList(files: DropboxFile[], p: DtaProject): { file: DropboxFile | null; others: string[] } {
  const pdfs = files.filter((f) => !isFolder(f) && /\.pdf$/i.test(f.name))
    .filter((f) => !PLOTS_RE.test(f.name) && !(p.excludeFile && p.excludeFile.test(f.name)))
    .filter((f) => !p.requireFile || p.requireFile.test(f.name))
    .sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : a.modifiedTime > b.modifiedTime ? -1 : 0));
  return { file: pdfs[0] ?? null, others: pdfs.slice(1).map((f) => f.name) };
}

/* ── Reading one list ────────────────────────────────────────────────────── */

/* The reader works on the pdf.js worker's text items WITH their positions
   (PdfPage), never on the text in reading order. All six lists of 2026-11-13
   showed why the text alone is not enough:
   - a price is often several items: "584" "," "000" (Mandarin 101), "5"
     "95,500", "60" "7,000", "6" "90,000" (Level 12/13 — read as €90,000
     by the first, text-order version of this reader);
   - a floor label sits in the SAME visual row as a unit, left of it:
     "4" "th" "Floor" "404" … (Mandarin), "1" "st" "101" … (ONLY);
   - the header is two to four lines of fragments ("Area," / "m" / "2"), and a
     fragment row ("2" "2" "Area, m²" …) looks like a unit row to a text reader;
   - iHome has a Floor column between Unit and Bedrooms, so "the second cell"
     is the floor (7), not the bedrooms (3).
   So: find the header by its "Unit" / "House No." label, cluster the header
   items into columns by x, and read every row below it column by column —
   the reference from the reference column only, the price as ALL the items
   of the price column joined, the bedrooms from the column labelled so. Items
   left of the reference column (floor labels) belong to no column. */

export type DtaStatus = "available" | "reserved" | "sold";
export type DtaListUnit = { ref: string; status: DtaStatus; price: number | null; beds: string | null; row: string };
export type DtaParse = {
  units: DtaListUnit[];
  /** Rows that hold a unit reference but whose outcome could not be read. Any one refuses the write. */
  unreadable: string[];
  /** A reference listed twice with DIFFERENT outcomes (same outcome twice collapses silently). */
  conflicts: string[];
  /** The list's own "Last updated: dd/mm/yyyy", as yyyy-mm-dd. */
  listDate: string | null;
  /** Pages on which a price-list header was recognised (1-based). */
  tablePages: number[];
};

// "101", "A701", "B12", "12A", "House 2", "Villa 3", "Apt 204".
const REF_RE = /^(?:(?:house|villa|apt\.?|apartment|unit|no\.?)\s*)?[A-Z]?\s?-?\s?\d{1,4}[A-Z]?$/i;
// The reference column's own header label: "Unit" (five lists), "House" over "No." (Level).
const REF_LABEL_RE = /^(unit|units|apt\.?|apartment|house|villa|no\.?|unit\s*no\.?|house\s*no\.?)$/i;
const SOLD_RE = /^sold(\s*out)?$/i;
const RESERVED_RE = /^(reserved|resrved|under\s*offer|on\s*hold)$/i;
// Items in the price column that say nothing about the outcome: the euro sign,
// "+ VAT", "VAT paid" (iHome prints it under the price), a dash, a footnote star.
const TAIL_RE = /^(€|eur|euro|\+|\*+|[-–—]+|\+?\s*v\.?a\.?t\.?(\s*(paid|incl\w*|excl\w*|included|excluded|applicable))?|(plus|incl\.?|excl\.?|including|excluding)\s*v\.?a\.?t\.?|v\.?a\.?t\.?\s*paid)$/i;
const VAT_SUFFIX_RE = /\s*(\+\s*v\.?a\.?t\.?|(plus|incl\.?|excl\.?)\s*v\.?a\.?t\.?|v\.?a\.?t\.?\s*paid)\s*$/i;
// A header item that is only part of a unit or a punctuation mark ("m", "2" of
// "m²", ",", "(", "€", ")") is not a column of its own.
const HEADER_FRAGMENT_RE = /^(m|2|²|m²|m2|,|\.|\(|\)|€|\(€\)|\*+)$/i;
// Nothing DTA sells costs less. A smaller "price" is a misread, never a price.
export const DTA_MIN_PRICE = 50_000;

// Header lines of one table are ≤ 10.6 pt apart in all six lists; the first
// unit row is ≥ 18.7 pt below the last header line.
const HEADER_LINE_GAP_PT = 12;
// Two header items whose left edges are this close belong to one column
// ("C" + "overed" 4 pt, "Price (" + its "€" is dropped as a fragment anyway).
const COLUMN_MERGE_PT = 8;
// An item belongs to the column whose left edge is the nearest one at or left of
// it, with this much slack for an item that starts a hair before its header.
const COLUMN_SLACK_PT = 6;
// A table ends at the first vertical gap larger than this (unit rows are ≤ 32 pt
// apart, Luma's two-line rows included; the first text below a table ≥ 36 pt).
const TABLE_END_GAP_PT = 45;

const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
const isOutcomeLike = (t: string) => SOLD_RE.test(t) || RESERVED_RE.test(t) || /^\d{1,3}(,\d{3})+$/.test(t);

type Column = { x: number; label: string };

/** The header around `labelRow`: the run of rows no more than HEADER_LINE_GAP_PT apart. */
function headerBand(rows: PdfRow[], labelRow: number): { top: number; bottom: number } {
  let top = labelRow, bottom = labelRow;
  while (top > 0 && rows[top - 1].y - rows[top].y <= HEADER_LINE_GAP_PT) top--;
  while (bottom < rows.length - 1 && rows[bottom].y - rows[bottom + 1].y <= HEADER_LINE_GAP_PT
    && !rows[bottom + 1].cells.some((c) => isOutcomeLike(clean(c.t)))) bottom++;
  return { top, bottom };
}

function columnsOf(rows: PdfRow[]): Column[] {
  const items = rows.flatMap((r) => r.cells.map((c) => ({ x: c.x, y: r.y, t: clean(c.t) })))
    .filter((c) => c.t && !HEADER_FRAGMENT_RE.test(c.t))
    .sort((a, b) => a.x - b.x);
  const groups: { x: number; items: typeof items }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && it.x - g.x <= COLUMN_MERGE_PT) g.items.push(it);
    else groups.push({ x: it.x, items: [it] });
  }
  return groups.map((g) => ({
    x: g.x,
    label: g.items.sort((a, b) => b.y - a.y || a.x - b.x).map((i) => i.t).join(" "),
  }));
}

const columnIndexOf = (cols: Column[], x: number) => {
  let k = -1;
  cols.forEach((c, i) => { if (c.x <= x + COLUMN_SLACK_PT) k = i; });
  return k;
};

type Table = { cols: Column[]; ref: number; beds: number; price: number };

/** A header at rows[i]? Its band must hold a price column, and its LEFTMOST
 *  column must be the reference ("Unit", "House No."). Leftmost, not merely
 *  labelled: Luma's header also says "Apartment" — over its "Apartment proportion
 *  of common area" column — and reading that column as references gave "81". */
function tableAt(rows: PdfRow[], i: number): { table: Table; bottom: number } | null {
  if (!rows[i].cells.some((c) => REF_LABEL_RE.test(clean(c.t)))) return null;
  const band = headerBand(rows, i);
  const cols = columnsOf(rows.slice(band.top, band.bottom + 1));
  const ref = 0;
  const price = cols.findIndex((c) => /price/i.test(c.label));
  if (!cols.length || !REF_LABEL_RE.test(cols[0].label) || price <= ref) return null;
  const beds = cols.findIndex((c, k) => k > ref && k < price && /bedroom/i.test(c.label));
  return { table: { cols, ref, beds, price }, bottom: band.bottom };
}

function readOutcome(tokens: string[]): { status: DtaStatus; price: number | null } | null {
  const t = tokens.map(clean).filter((x) => x && !TAIL_RE.test(x));
  if (!t.length) return null;
  // "584" "," "000" / "6" "90,000": number pieces of ONE price, joined without a space.
  const joined = t.every((x) => /^[\d.,]+$/.test(x)) ? t.join("") : t.join(" ").replace(VAT_SUFFIX_RE, "").trim();
  if (SOLD_RE.test(joined)) return { status: "sold", price: null };
  if (RESERVED_RE.test(joined)) return { status: "reserved", price: null };
  const price = parsePrice(joined);
  if (price === null || price < DTA_MIN_PRICE) return null;
  return { status: "available", price };
}

function bedsOf(tokens: string[]): string | null {
  const t = tokens.map(clean).filter(Boolean).join(" ");
  if (/^studio\b/i.test(t)) return "0";
  const m = /^(\d)\b/.exec(t);
  return m ? m[1] : null;
}

function listDateOf(pages: PdfPage[]): string | null {
  for (const p of pages) for (const r of p.rows) {
    const k = r.cells.findIndex((c) => /last\s*updated/i.test(c.t));
    if (k < 0) continue;
    // "12" "/" "1" "1" "/2026" — the date is drawn in pieces; joined without spaces.
    const after = (clean(r.cells[k].t).replace(/^.*last\s*updated\s*:?/i, "") + r.cells.slice(k + 1).map((c) => clean(c.t)).join("")).replace(/\s+/g, "");
    const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})/.exec(after);
    if (!m) continue;
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Reads a DTA price list from its pdf.js pages. `knownRefs` are the references
 *  already in the database for this project: one that turns up where no unit row
 *  could be read makes that row unreadable rather than quietly skipped. */
export function parseDtaPriceList(pages: PdfPage[], knownRefs: string[], projectName: string): DtaParse {
  const known = new Set(knownRefs.map((r) => normalizeRef(r, projectName)));
  const units: DtaListUnit[] = [];
  const unreadable: string[] = [];
  const conflicts: string[] = [];
  const tablePages: number[] = [];
  const seen = new Map<string, DtaListUnit>();

  for (const page of pages) {
    const rows = page.rows.slice().sort((a, b) => b.y - a.y);
    let table: Table | null = null;
    let inTable = false;
    for (let i = 0; i < rows.length; i++) {
      const head = tableAt(rows, i);
      if (head) {
        table = head.table;
        inTable = true;
        if (!tablePages.includes(page.page)) tablePages.push(page.page);
        i = head.bottom;
        continue;
      }
      const rowText = rows[i].cells.map((c) => clean(c.t)).filter(Boolean).join(" | ");
      if (inTable && i > 0 && rows[i - 1].y - rows[i].y > TABLE_END_GAP_PT) inTable = false;
      if (!inTable || !table) {
        // Outside any recognised table, a reference we hold is a unit we failed to see.
        const stray = rows[i].cells.map((c) => clean(c.t)).find((t) => REF_RE.test(t) && known.has(normalizeRef(t, projectName)));
        if (stray && rows[i].cells.length >= 3) unreadable.push(`page ${page.page}, outside the table: ${rowText}`);
        continue;
      }

      const byCol = new Map<number, string[]>();
      for (const c of rows[i].cells) {
        const k = columnIndexOf(table.cols, c.x);
        if (k < table.ref) continue; // floor labels left of the reference column
        byCol.set(k, [...(byCol.get(k) ?? []), c.t]);
      }
      const refText = (byCol.get(table.ref) ?? []).map(clean).filter(Boolean).join(" ");
      if (!refText) continue; // a wrapped line: "House Type B", "+ 1 studio", "VAT paid"
      if (!REF_RE.test(refText)) {
        const first = refText.split(" ")[0];
        if (first !== refText && known.has(normalizeRef(first, projectName))) unreadable.push(rowText);
        continue;
      }
      let outcome = readOutcome(byCol.get(table.price) ?? []);
      // A SOLD / RESERVED in another column (a "Status" column) is the status.
      const elsewhere = Array.from(byCol.entries()).filter(([k]) => k !== table!.price && k !== table!.ref).flatMap(([, v]) => v.map(clean));
      const sold = elsewhere.some((t) => SOLD_RE.test(t));
      const reserved = elsewhere.some((t) => RESERVED_RE.test(t));
      if (sold && reserved) outcome = null;
      else if (sold || reserved) outcome = { status: sold ? "sold" : "reserved", price: null };
      if (!outcome) { unreadable.push(rowText); continue; }

      const key = normalizeRef(refText, projectName);
      const u: DtaListUnit = { ref: refText, ...outcome, beds: table.beds >= 0 ? bedsOf(byCol.get(table.beds) ?? []) : null, row: rowText };
      const prev = seen.get(key);
      if (prev) {
        if (prev.status !== u.status || prev.price !== u.price) conflicts.push(refText);
        continue;
      }
      seen.set(key, u);
      units.push(u);
    }
  }
  return { units, unreadable, conflicts, listDate: listDateOf(pages), tablePages };
}

/* ── From a read list to a write plan ────────────────────────────────────── */

export type DtaExistingUnit = {
  id: string;
  ref: string | null;
  status: string | null;
  price: number | null;
  beds: string | null;
  pinnedFields?: string[] | null;
};

export type DtaUnitWrite = { id: string; ref: string; data: { status?: string; price?: number | null }; changes: string[] };

export type DtaPlan = {
  /** Set = write NOTHING for this project. */
  refusal: string | null;
  updates: DtaUnitWrite[];
  /** Units missing from the list, to become "unlisted". */
  unlist: { id: string; ref: string }[];
  /** Reported, never blocking. */
  issues: string[];
  /** True when the list prints sold units too (Athina, Mandarin): a full table, where nothing may vanish. */
  fullTable: boolean;
};

const euro = (n: number | null | undefined) => (n == null ? "—" : `€${n.toLocaleString("en")}`);

/* The last line of defence against a misread price (2026-11-13: the first
   version of this reader read Level's "6" "90,000" as €90,000 against a stored
   €690,000, and nothing stopped it). A price is refused when it is
   - below DTA_MIN_PRICE (€50,000), or
   - more than ±40 % away from the unit's stored price, or
   - for a unit without a stored price (back from reserved/sold), outside
     ×⅓…×3 of the other prices in the same list.
   DTA reprice in single-digit percentages; a dropped or added leading digit is
   ×10 or more. Any hit refuses the WHOLE project. */
export const DTA_MAX_PRICE_MOVE = 0.4;

function priceGuard(units: DtaListUnit[], byKey: Map<string, DtaExistingUnit>, key: (r: string) => string): string[] {
  const out: string[] = [];
  const priced = units.filter((u) => u.status === "available" && typeof u.price === "number");
  for (const u of priced) {
    const p = u.price!;
    if (p < DTA_MIN_PRICE) { out.push(`${u.ref} ${euro(p)} is below ${euro(DTA_MIN_PRICE)}`); continue; }
    const cur = byKey.get(key(u.ref))?.price ?? null;
    if (cur != null && cur > 0) {
      if (Math.abs(p - cur) / cur > DTA_MAX_PRICE_MOVE) out.push(`${u.ref} ${euro(cur)}→${euro(p)} (${p > cur ? "+" : ""}${Math.round(((p - cur) / cur) * 100)} %)`);
      continue;
    }
    const others = priced.filter((o) => o !== u).map((o) => o.price!);
    if (others.length && (p < Math.min(...others) / 3 || p > Math.max(...others) * 3)) {
      out.push(`${u.ref} ${euro(p)} (no stored price) is far outside the list's other prices ${euro(Math.min(...others))}–${euro(Math.max(...others))}`);
    }
  }
  return out;
}

/* What one list does to one project's units.

   REFUSED (nothing written) when:
   - the list yields no units — "no result" is not "everything sold";
   - a row that starts with a reference could not be read, or a reference is
     listed twice with different outcomes;
   - the list holds a reference the database does not — this connector creates
     no units, and a list of strangers is a list read wrong (a shifted first
     column, another project's file) far more often than a new unit;
   - the list prints SOLD rows (a full table) and still a unit for sale or
     reserved is missing from it — a full table does not drop units, so a gap is
     a row we failed to see;
   - fewer than half of the units we list as for sale or reserved are still
     there (refDrift, the Stylianides guard; ≥ 3 units);
   - any price is implausible (priceGuard: < €50,000, or > ±40 % from the
     stored price).

   Otherwise: listed units get the list's status and price (price only while
   available, as the manual import stored them); a unit missing from the list
   becomes "unlisted" (FEED-ADAPTER-GUIDE §4) and comes back when listed again;
   an already sold or unlisted unit is left as it is. Pinned fields are never
   written. */
export function planDtaWrite(existing: DtaExistingUnit[], parsed: DtaParse, projectName: string): DtaPlan {
  const plan: DtaPlan = { refusal: null, updates: [], unlist: [], issues: [], fullTable: parsed.units.some((u) => u.status === "sold") };
  const refuse = (why: string) => ({ ...plan, refusal: why, updates: [], unlist: [] });
  const key = (r: string) => normalizeRef(r, projectName);

  if (!parsed.units.length) return refuse("the price list produced no units — nothing written");
  if (parsed.unreadable.length) return refuse(`${parsed.unreadable.length} row(s) hold a unit reference but could not be read — nothing written: ${parsed.unreadable.slice(0, 5).join(" / ")}`);
  if (parsed.conflicts.length) return refuse(`reference(s) listed twice with different outcomes — nothing written: ${parsed.conflicts.join(", ")}`);

  const byKey = new Map(existing.filter((u) => u.ref).map((u) => [key(u.ref!), u]));
  const unknown = parsed.units.filter((u) => !byKey.has(key(u.ref))).map((u) => u.ref);
  if (unknown.length) return refuse(`reference(s) in the list but not in the database: ${unknown.join(", ")} — nothing written (add a genuinely new unit by hand, with its type, bedrooms and areas)`);

  const listed = new Set(parsed.units.map((u) => key(u.ref)));
  const vanished = existing.filter((u) => u.ref && !listed.has(key(u.ref)) && u.status !== "sold" && u.status !== "unlisted");
  if (plan.fullTable && vanished.length) {
    return refuse(`the list prints sold units, so it is a full table — yet ${vanished.map((u) => u.ref).join(", ")} (for sale or reserved here) is missing from it — nothing written`);
  }
  const base = existing.filter((u) => u.ref && (u.status === "available" || u.status === "reserved")).map((u) => u.ref!);
  const drift = refDrift(base, parsed.units.map((u) => u.ref), projectName);
  if (drift) return refuse(drift);

  const priceProblems = priceGuard(parsed.units, byKey, key);
  if (priceProblems.length) return refuse(`implausible price(s) — nothing written (a misread is never written as a price; a genuine change this large needs a hand edit or a pin): ${priceProblems.join("; ")}`);

  for (const u of parsed.units) {
    const cur = byKey.get(key(u.ref))!;
    const want = { status: u.status as string, price: u.status === "available" ? u.price : null };
    const data = stripPinnedUnitFields(want, cur.pinnedFields);
    const changes: string[] = [];
    if ("status" in data && (cur.status ?? null) !== data.status) changes.push(`status ${cur.status ?? "—"}→${data.status}`);
    if ("price" in data && (cur.price ?? null) !== (data.price ?? null)) changes.push(`price ${euro(cur.price)}→${euro(data.price)}`);
    const pinnedDiff = (["status", "price"] as const).filter((f) => !(f in data) && (cur[f] ?? null) !== (want[f] ?? null));
    if (pinnedDiff.length) plan.issues.push(`${u.ref}: pinned ${pinnedDiff.join(" + ")} kept (list says ${u.status}${u.price ? ` ${euro(u.price)}` : ""})`);
    if (u.beds != null && cur.beds != null && u.beds !== cur.beds.trim()) plan.issues.push(`${u.ref}: list says ${u.beds} bedroom(s), the unit has ${cur.beds} — not written, check by hand`);
    if (!changes.length) continue;
    const write: DtaUnitWrite["data"] = {};
    if ("status" in data) write.status = data.status;
    if ("price" in data) write.price = data.price ?? null;
    plan.updates.push({ id: cur.id, ref: u.ref, data: write, changes });
  }

  for (const v of vanished) {
    if ((v.pinnedFields ?? []).includes("status")) { plan.issues.push(`${v.ref}: no longer in the list, but its status is pinned — kept ${v.status}`); continue; }
    plan.unlist.push({ id: v.id, ref: v.ref! });
  }
  return plan;
}

/** Headline price range after the write: available, priced units only. */
export function priceRangeAfter(existing: DtaExistingUnit[], plan: DtaPlan): { priceFrom: number | null; priceTo: number | null } {
  const upd = new Map(plan.updates.map((u) => [u.id, u.data]));
  const gone = new Set(plan.unlist.map((u) => u.id));
  const prices: number[] = [];
  for (const u of existing) {
    if (gone.has(u.id)) continue;
    const d = upd.get(u.id) ?? {};
    const status = d.status ?? u.status;
    const price = "price" in d ? d.price ?? null : u.price;
    if (status === "available" && typeof price === "number" && price > 0) prices.push(price);
  }
  return prices.length ? { priceFrom: Math.min(...prices), priceTo: Math.max(...prices) } : { priceFrom: null, priceTo: null };
}
