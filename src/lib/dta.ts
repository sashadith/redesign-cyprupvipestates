import type { DropboxFile } from "./dropbox";
import { parsePrice } from "./ai/availabilityTable";
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

   WHY A DETERMINISTIC READER. DTA's lists are clean text-layer tables: a row
   reads "unit ref, bedrooms, areas…, price" — or SOLD / RESERVED in place of
   the price — left to right. The column SET differs per list (Luma adds studio
   and mechanical room, Level covered parking, Athina and Mandarin neither), but
   status and price are always the row's last meaningful cell and the reference
   its first, which is all this connector reads. No model is involved, so there
   is no column-mapping drift to guard against; the guards below are about the
   document itself changing shape. */

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

export type DtaStatus = "available" | "reserved" | "sold";
export type DtaListUnit = { ref: string; status: DtaStatus; price: number | null; beds: string | null; row: string };
export type DtaParse = {
  units: DtaListUnit[];
  /** Rows that start with a unit reference but whose outcome could not be read. Any one refuses the write. */
  unreadable: string[];
  /** A reference listed twice with DIFFERENT outcomes (same outcome twice collapses silently). */
  conflicts: string[];
  /** The list's own "Last updated: dd/mm/yyyy", as yyyy-mm-dd. */
  listDate: string | null;
};

// "101", "A701", "B12", "12A", "House 2", "Villa 3", "Apt 204". The FIRST cell of
// a row only — a beds or floor cell is never mistaken for one because it is never
// looked at in that position.
const REF_RE = /^(?:(?:house|villa|apt\.?|apartment|unit|no\.?)\s*)?[A-Z]?\s?-?\s?\d{1,4}[A-Z]?$/i;
const SOLD_RE = /^sold(\s*out)?$/i;
const RESERVED_RE = /^(reserved|resrved|under\s*offer|on\s*hold)$/i;
const AVAILABLE_RE = /^(available|for\s*sale)$/i;
// Cells that may follow the price at the end of a row and say nothing about the
// outcome: the euro sign printed as its own item, "+ VAT", "VAT paid" (iHome),
// a dash, a footnote star.
const TAIL_RE = /^(€|eur|euro|\+|\*+|[-–—]+|\+?\s*v\.?a\.?t\.?(\s*(paid|incl\w*|excl\w*|included|excluded|applicable))?|(plus|incl\.?|excl\.?|including|excluding)\s*v\.?a\.?t\.?|v\.?a\.?t\.?\s*paid)$/i;
// Nothing DTA sells costs less; a smaller "price" is an area or a count that
// ended up last in its row, and is read as unreadable rather than as a price.
const MIN_PRICE = 20_000;
const VAT_SUFFIX_RE = /\s*(\+\s*v\.?a\.?t\.?|(plus|incl\.?|excl\.?)\s*v\.?a\.?t\.?|v\.?a\.?t\.?\s*paid)\s*$/i;
// An area, a bedroom count: what fills a real unit row between its reference and its price.
const FIGURE_RE = /^\d+(?:[.,]\d+)?\s*(?:m2|m²|sqm)?$/i;

const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

function readRowOutcome(cells: string[]): { status: DtaStatus; price: number | null } | null {
  const rest = cells.slice(1).map(clean).filter(Boolean);
  const words = rest.filter((c) => SOLD_RE.test(c) || RESERVED_RE.test(c));
  const sold = words.some((c) => SOLD_RE.test(c));
  const reserved = words.some((c) => RESERVED_RE.test(c));
  if (sold && reserved) return null;
  let i = rest.length - 1;
  while (i >= 0 && TAIL_RE.test(rest[i])) i--;
  if (i < 0) return null;
  // "2,785,000 VAT paid" as ONE text item reads like the two-item form.
  const last = rest[i].replace(VAT_SUFFIX_RE, "").trim();
  if (SOLD_RE.test(last)) return { status: "sold", price: null };
  if (RESERVED_RE.test(last)) return { status: "reserved", price: null };
  const price = parsePrice(last);
  if (price === null || price < MIN_PRICE) return null;
  // A priced row that also carries a status word elsewhere (a "Status" column
  // left of the price) is that status. Sold and reserved units carry no price
  // here, same convention as the manual import.
  if (sold) return { status: "sold", price: null };
  if (reserved) return { status: "reserved", price: null };
  return { status: "available", price };
}

const bedsOf = (cell: string | undefined) => {
  const c = clean(cell);
  if (/^\d$/.test(c)) return c;
  if (/^studio$/i.test(c)) return "0";
  return null;
};

function listDateOf(rows: string[][]): string | null {
  const text = rows.map((r) => r.join(" ")).join("\n");
  const m = /last\s*updated\s*:?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i.exec(text);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Reads a DTA price list from its rows (each row = its cells' texts, left to right).
 *  `knownRefs` are the references already in the database for this project: a row
 *  that starts with one of them must be read, even when it is short. */
export function parseDtaPriceList(rows: string[][], knownRefs: string[], projectName: string): DtaParse {
  const known = new Set(knownRefs.map((r) => normalizeRef(r, projectName)));
  const units: DtaListUnit[] = [];
  const unreadable: string[] = [];
  const conflicts: string[] = [];
  const seen = new Map<string, DtaListUnit>();
  for (const raw of rows) {
    const cells = raw.map(clean).filter(Boolean);
    if (!cells.length) continue;
    if (!REF_RE.test(cells[0])) {
      // "A701 3" — a reference we hold, glued to the next cell into one text item.
      // Not a row we can read, and not one we may quietly skip.
      const first = cells[0].split(" ")[0];
      if (first !== cells[0] && known.has(normalizeRef(first, projectName))) unreadable.push(cells.join(" | "));
      continue;
    }
    const ref = cells[0];
    const key = normalizeRef(ref, projectName);
    const outcome = readRowOutcome(cells);
    const row = cells.join(" | ");
    if (!outcome) {
      // A row whose first cell merely LOOKS like a reference (a page number, a
      // count in a summary line) is not a unit. A row of a real table carries
      // figures (bedrooms, areas), and a row that starts with a reference we hold
      // is ours whatever it holds: a two-line cell can split a unit's row in two,
      // and silently losing it would turn a unit for sale into "unlisted".
      const figures = cells.slice(1).filter((c) => FIGURE_RE.test(c)).length;
      if ((cells.length >= 3 && figures >= 2) || known.has(key)) unreadable.push(row);
      continue;
    }
    const u: DtaListUnit = { ref, ...outcome, beds: bedsOf(cells[1]), row };
    const prev = seen.get(key);
    if (prev) {
      if (prev.status !== u.status || prev.price !== u.price) conflicts.push(ref);
      continue;
    }
    seen.set(key, u);
    units.push(u);
  }
  return { units, unreadable, conflicts, listDate: listDateOf(rows) };
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
     there (refDrift, the Stylianides guard; ≥ 3 units).

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
  if (parsed.unreadable.length) return refuse(`${parsed.unreadable.length} row(s) start with a unit reference but could not be read — nothing written: ${parsed.unreadable.slice(0, 5).join(" / ")}`);
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
