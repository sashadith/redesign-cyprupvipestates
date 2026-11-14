/* DOMO Properties — the master price list, read as data (2026-11-14, phase 2).
 *
 * DOMO publish ONE public PDF for their whole portfolio, at domoproperties.com/mp,
 * and it is the only source of units and prices for this developer (the per-project
 * brochures in the SharePoint share carry prices too, dated two months older — see
 * the account notes in scripts/data/domo/2026-11-13.json for why they are read for
 * copy and never for figures).
 *
 * Korantina's engine (../ai/availabilityTable.ts) reconstructs the tables: same
 * pdf.js positions, same "a row whose price/status cannot be read is DROPPED, never
 * assumed available" rule, same block-prefixed refs. What is DOMO-specific lives
 * here, as steps around that engine — so nothing in this file can change how any
 * other developer's lists are read.
 *
 * The one deliberate difference: Korantina asks a model which column is the price.
 * This does not. DOMO print one template on all 24 price pages with a closed
 * vocabulary of fourteen column names (measured on the 2026-11-12 list, every page),
 * so the mapping is a table lookup and a word we have not seen is a REPORTED PROBLEM
 * rather than a guess. A model could only make that worse here, and it would cost a
 * call per page on every sync.
 *
 * ── The stale-layer trap, which is the whole reason this file reads coordinates ──
 *
 * Eleven of the 24 price pages carry TWO "Delivery: Qn YYYY" lines in their text
 * layer, with different quarters. They are not two phases: they are the designer's
 * previous version of the header, left behind in the file and painted over by the
 * black header band, so only one of the two is visible. Siena's page says Q3 2027
 * underneath and Q4 2027 on top; Aalto's says Q4 2027 underneath and Q3 2028 on top.
 * A plain text dump returns both in reading order and cannot tell them apart, which
 * is why phase 1 wrote no completion dates at all rather than a coin-flip date on a
 * lead page.
 *
 * What separates them is the template geometry, and it is the same on all 24 pages:
 * the visible title sits at y≈523.9, x≈23.2, and the visible delivery line is the
 * one directly under it, LEFT-ALIGNED WITH IT to within a point. The stale copies
 * sit at another y (532.2, 534.0, 516.2, 513.5) or another x (18.7, 6.0, 15.4, 26.2,
 * 31.3). Every one of the 24 pages was rendered and read by eye on 2026-11-14 to
 * confirm the rule picks the line a human sees; domoPriceList.test.ts carries the
 * three real traps as fixtures.
 *
 * Nothing here is allowed to guess: a page whose band does not match the template
 * exactly once yields `delivery: null` and a problem, and the sync writes no
 * completion for it.
 */
import {
  parsePrice,
  tablesFromPages,
  unitsFromTable,
  type ColumnField,
  type PdfPage,
  type PdfRow,
  type RawTable,
  type TableMapping,
  type TableUnit,
} from "../ai/availabilityTable";

/** The page that links the current list. The PDF's own URL changes on every re-upload. */
export const PRICE_LIST_PAGE = "https://domoproperties.com/mp";

/* The /mp page is a Framer site whose only PDF link is the price list itself
   (checked on the 2026-11-12 build: exactly one match in the whole document).
   Finding none, or finding several, is reported rather than resolved by picking
   one — a second PDF on that page would mean DOMO changed what /mp is for. */
export function priceListPdfUrl(html: string): string {
  const urls = Array.from(new Set(html.match(/https:\/\/[^"'<>\s]+\.pdf/g) ?? []));
  if (urls.length !== 1) {
    throw new Error(`expected exactly one PDF link on ${PRICE_LIST_PAGE}, found ${urls.length}${urls.length ? `: ${urls.join(", ")}` : ""}`);
  }
  return urls[0];
}

/* ── The header band ──────────────────────────────────────────────────────── */

/* Everything at or above this y is the black title band; everything below is the
   page's own content. Measured across all 24 price pages of the 2026-11-12 list:
   the lowest band item is the delivery line at y=506.0, the highest content row is
   Milford Heights' table header at y=494.7. The gap is 11pt wide and the split sits
   in the middle of it. */
const BAND_MIN_Y = 500;
const TITLE_Y_MIN = 522, TITLE_Y_MAX = 526;
const DELIVERY_Y_MIN = 504.5, DELIVERY_Y_MAX = 508.5;
/* The template's own left margin: every visible title on all 24 pages starts at
   x=23.2, every visible delivery line between x=22.4 and x=24.1 (the line is
   centred under a title of varying width). Stale copies sit 3 to 17pt away. */
const TEMPLATE_X_MIN = 22.0, TEMPLATE_X_MAX = 24.5;
/* How far the delivery line may sit from its title's left edge. The closest stale
   line on any page is 3.0pt away (Liora, 26.2 against a title at 23.2); the
   furthest real one is 1.7pt (Liora again, 22.4). */
const ALIGN_TOLERANCE_PT = 2.2;

const isDeliveryCell = (t: string) => /^delivery\s*:/i.test(t.trim());
const DELIVERY_VALUE_RE = /^(Q[1-4]\s+)?20\d\d$/;

export type DomoHeaderBand = {
  /** The project name as the page prints it, trailing full stop removed. */
  title: string | null;
  /** "Q4 2027", or a bare year for the three whole-building pages. */
  delivery: string | null;
  problems: string[];
};

/** Title and delivery of one price page, from the template geometry above. */
export function readHeaderBand(rows: PdfRow[], page: number): DomoHeaderBand {
  const problems: string[] = [];
  const band = rows.filter((r) => r.y >= BAND_MIN_Y);

  const titles = band
    .filter((r) => r.y >= TITLE_Y_MIN && r.y <= TITLE_Y_MAX)
    .flatMap((r) => r.cells)
    .filter((c) => c.x >= TEMPLATE_X_MIN && c.x <= TEMPLATE_X_MAX && !isDeliveryCell(c.t) && c.t.trim() !== "." && c.t.trim() !== "");
  if (titles.length !== 1) {
    problems.push(`p${page}: ${titles.length} title(s) at the template position, expected exactly 1${titles.length ? ` (${titles.map((t) => t.t).join(", ")})` : ""}`);
    return { title: null, delivery: null, problems };
  }
  const titleCell = titles[0];
  const title = titleCell.t.replace(/\s*\.\s*$/, "").replace(/\s+/g, " ").trim();

  const deliveries = band
    .filter((r) => r.y >= DELIVERY_Y_MIN && r.y <= DELIVERY_Y_MAX)
    .flatMap((r) => r.cells)
    .filter((c) => isDeliveryCell(c.t) && Math.abs(c.x - titleCell.x) <= ALIGN_TOLERANCE_PT);
  if (deliveries.length !== 1) {
    problems.push(`p${page} (${title}): ${deliveries.length} delivery line(s) aligned with the title, expected exactly 1 — the stale-layer rule no longer holds, refusing to pick one`);
    return { title, delivery: null, problems };
  }
  const value = deliveries[0].t.replace(/^delivery\s*:/i, "").replace(/\s+/g, " ").trim();
  if (!DELIVERY_VALUE_RE.test(value)) {
    problems.push(`p${page} (${title}): delivery "${value}" is not a quarter or a year`);
    return { title, delivery: null, problems };
  }
  return { title, delivery: value, problems };
}

/* ── Table repairs ────────────────────────────────────────────────────────── */

/* A status too wide for its column wraps onto a second line, and pdf.js reports
   that line as a row of its own: Milford Heights prints "UNDER" and "OFFER" on two
   rows for two of its twenty units. The engine's isDataRow then sees no outcome in
   either row and the unit is silently lost — the exact failure the row-count guard
   below exists to catch, fixed here at the source.
   Only a row holding ONE cell is folded, and only into the cell directly above it:
   a real data row never arrives alone, and a continuation always sits in the column
   its first line is in. */
const WRAP_MAX_GAP_PT = 9;
const WRAP_MAX_X_DRIFT_PT = 4;

export function mergeWrappedCells(rows: PdfRow[]): PdfRow[] {
  const out: PdfRow[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    const only = row.cells.length === 1 ? row.cells[0] : null;
    const target = prev?.cells[prev.cells.length - 1];
    if (only && prev && target && prev.y - row.y > 0 && prev.y - row.y <= WRAP_MAX_GAP_PT && Math.abs(target.x - only.x) <= WRAP_MAX_X_DRIFT_PT && prev.cells.length > 1) {
      target.t = `${target.t} ${only.t}`.replace(/\s+/g, " ").trim();
      continue;
    }
    out.push({ ...row, cells: row.cells.map((c) => ({ ...c })) });
  }
  return out;
}

/* Liora numbers its Block B flats "B101" while Block A's are a bare "101", so the
   engine's unconditional block prefix would write "B B101". The letter is dropped
   from the reference only when EVERY row of that table repeats its own block letter
   — never when a single row happens to start with it — so the two blocks come out
   symmetrical ("A 101" / "B 101") and a numbering where the letter means something
   else is left alone. */
export function stripRedundantBlockLetter(table: RawTable): RawTable {
  const blockIdx = table.headers.findIndex((h) => /^block$/i.test(h.trim()));
  const refIdx = table.headers.findIndex((h) => /^ap\.?$/i.test(h.trim()));
  if (blockIdx < 0 || refIdx < 0 || !table.rows.length) return table;
  const redundant = table.rows.every((r) => {
    const b = (r[blockIdx] ?? "").trim();
    const ref = (r[refIdx] ?? "").trim();
    return b && ref.toUpperCase().startsWith(b.toUpperCase()) && ref.length > b.length;
  });
  if (!redundant) return table;
  return {
    ...table,
    rows: table.rows.map((r) => {
      const copy = r.slice();
      const b = (r[blockIdx] ?? "").trim();
      copy[refIdx] = (r[refIdx] ?? "").trim().slice(b.length);
      return copy;
    }),
  };
}

/* ── The column vocabulary ────────────────────────────────────────────────── */

/* Every column name printed on the 24 price pages of the 2026-11-12 list, and
   nothing else. `field` is the engine's own field; "attr" becomes a per-unit spec
   shown on the public page, which is why those carry a written-out label instead of
   the sheet's abbreviation.

   Areas: "Indoor Area" is the interior and "Total Area" is indoor + verandas + roof
   garden, verified by addition on every page (Siena 302: 75 + 17 + 62 = 154). That
   is exactly the pair areaInternal/areaBuilt the site expects — interiorArea() reads
   areaInternal and coveredArea() adds the veranda to it, so mapping Total Area to
   areaBuilt cannot double-count (src/lib/formatArea.ts). */
const DOMO_COLUMNS: { re: RegExp; field: ColumnField; label?: string }[] = [
  { re: /^block$/i, field: "block" },
  { re: /^ap\.?$/i, field: "ref" },
  { re: /^floor$/i, field: "floor" },
  { re: /^bedrooms$/i, field: "beds" },
  { re: /^indoor\s*area$/i, field: "areaInternal" },
  { re: /^cov\.?\s*veranda$/i, field: "areaVeranda" },
  { re: /^uncovered\s*veranda$/i, field: "areaVerandaOpen" },
  { re: /^roof\s*garden$/i, field: "attr", label: "Roof garden" },
  { re: /^total\s*area$/i, field: "areaBuilt" },
  { re: /^common\s*area$/i, field: "attr", label: "Common area" },
  { re: /^green\s*terrace$/i, field: "attr", label: "Green terrace" },
  { re: /^parking$/i, field: "attr", label: "Parking" },
  { re: /^storage$/i, field: "attr", label: "Storage" },
  { re: /^(asking\s*)?price$/i, field: "price" },
];

/* The engine reads column labels out of a band above the table and keeps whatever
   noise shares it. Two kinds reach these pages:
   - a label printed on two lines ("Indoor" / "Area", "Asking" / "Price"), which
     already joins in the right order, so collapsing whitespace is enough;
   - the project's own name off the location map, whose badge sits just above the
     table on three pages and arrives glued to the front of a column ("SIENA Common
     Area", "Hampton Parking", "Delta Common Area").
   The second is removed by name — the page's own printed title, nothing else — so
   the lookup below stays an exact match and a column word DOMO have never used
   still has to be reported rather than guessed at by a loose suffix rule. */
export function domoMapping(headers: string[], context: string, title: string | null): { mapping: TableMapping; problems: string[] } {
  const problems: string[] = [];
  const columns: ColumnField[] = [];
  const labels: string[] = [];
  const badge = title ? new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i") : null;
  for (const raw of headers) {
    const h = (raw ?? "").replace(/\s+/g, " ").trim().replace(badge ?? /^$/, "");
    const hit = DOMO_COLUMNS.find((c) => c.re.test(h));
    if (!hit) {
      problems.push(`${context}: unknown column "${h}" — not imported`);
      columns.push("ignore");
      labels.push(h);
      continue;
    }
    columns.push(hit.field);
    labels.push(hit.label ?? h);
  }
  for (const required of ["ref", "price"] as ColumnField[]) {
    if (!columns.includes(required)) problems.push(`${context}: no ${required === "ref" ? '"Ap."' : "price"} column — table not imported`);
  }
  return { mapping: { title: "", columns, labels, unitKind: "Apartment", corrections: [] }, problems };
}

/* ── Units ────────────────────────────────────────────────────────────────── */

export type DomoUnit = TableUnit & {
  /** DevelopmentUnit.storage is a yes/no column; the size stays in the specs. */
  storage: string | null;
};

// "101", "B802", "403*": the hundreds digit is the floor. Same convention as every
// other Limassol list in this repo (see stylianides.ts).
const FLOOR_REF_RE = /^[A-Z]?(\d)(\d{2})\*?$/i;
const num = (v: string | null | undefined) => {
  const m = (v ?? "").replace(",", ".").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/* DOMO never type the word "penthouse", but they sell them: on every project the
   top-floor flats with a private roof garden are the expensive ones (Siena 302, 75
   m² indoor, costs €500,000 against €360,000 for the identical 202 one floor down).
   "Penthouse" is its own value in the property-type filter and a term buyers search
   for, so leaving all of them filed as "Apartment" would hide the best stock on the
   page. The rule is deliberately narrow — the top floor of its own block, and either
   a roof garden or the whole floor to itself. Measured against all 209 units of the
   2026-11-12 list, exactly two cases turn on that second clause: Milford Heights
   A401 (alone on floor 4, four bedrooms, 168 m², €1,300,000) becomes a penthouse,
   and Delta 402 (one of two on floor 4, no roof garden) stays an apartment. Liora's
   303 and 305 — 50 m² one-beds identical to the ones below them — stay apartments,
   which is why "top floor" on its own is not the rule. */
export function refineDomoUnits(units: TableUnit[]): DomoUnit[] {
  const floorOf = (u: TableUnit) => {
    if (u.floor && /^\d+$/.test(u.floor.trim())) return Number(u.floor.trim());
    const m = FLOOR_REF_RE.exec((u.block ? u.ref.slice(u.block.length) : u.ref).trim());
    return m ? Number(m[1]) : null;
  };
  const topFloor = new Map<string, number>();
  const onFloor = new Map<string, number>();
  for (const u of units) {
    const f = floorOf(u);
    if (f === null) continue;
    topFloor.set(u.block ?? "", Math.max(topFloor.get(u.block ?? "") ?? 0, f));
    const key = `${u.block ?? ""}|${f}`;
    onFloor.set(key, (onFloor.get(key) ?? 0) + 1);
  }

  return units.map((u) => {
    const f = floorOf(u);
    const roof = u.attrs.find((a) => /^roof garden$/i.test(a.name));
    const storageAttr = u.attrs.find((a) => /^storage$/i.test(a.name));
    const out: DomoUnit = {
      ...u,
      ref: u.ref.replace(/\*$/, ""),
      floor: u.floor ?? (f === null ? null : String(f)),
      storage: storageAttr ? "yes" : null,
      attrs: u.attrs.slice(),
    };
    const alone = f !== null && onFloor.get(`${u.block ?? ""}|${f}`) === 1;
    if (f !== null && f === topFloor.get(u.block ?? "") && ((num(roof?.value) ?? 0) > 0 || alone)) out.type = "Penthouse";
    return out;
  });
}

/* ── Whole-building pages ─────────────────────────────────────────────────── */

export type DomoBuildingPrice = { sale: number | null; rent: number | null };

/* The three commercial pages list no apartments: they price the whole building, for
   sale and (on two of the three) per month. Read from the text of the cell, not from
   where it sits — Roman House prints its sale price in the column the other two use
   for rent, and a geometric rule would have called a €6,000,000 villa a monthly rent. */
export function readBuildingPrice(rows: PdfRow[]): DomoBuildingPrice {
  let sale: number | null = null;
  let rent: number | null = null;
  for (const cell of rows.flatMap((r) => r.cells)) {
    const t = cell.t.trim();
    if (!/^[€$£]/.test(t)) continue;
    const perMonth = /\/\s*month|p\.?\s*m\.?$/i.test(t);
    const value = parsePrice(t.replace(/\/\s*month|p\.?\s*m\.?$/i, "").trim());
    if (value === null) continue;
    if (perMonth) rent ??= value;
    else sale ??= value;
  }
  return { sale, rent };
}

/* ── One page ─────────────────────────────────────────────────────────────── */

/* A row that prints a unit reference, whatever else is wrong with it. Counted
   straight off the page and compared with the units actually produced, so a row the
   reconstruction loses — a wrapped status, a column that shifted — is reported
   instead of quietly going missing. This is the guard that caught the two "UNDER
   OFFER" rows of Milford Heights. */
const UNIT_REF_RE = /^[A-Z]?\d{3}\*?$/;
export const looksLikeUnitRow = (row: PdfRow) =>
  row.cells.length >= 5 && row.cells.slice(0, 2).some((c) => UNIT_REF_RE.test(c.t.trim()));

export type DomoPricePage = {
  page: number;
  title: string | null;
  delivery: string | null;
  units: DomoUnit[];
  /** Unit rows visible on the page — must equal units.length. */
  unitRows: number;
  building: DomoBuildingPrice;
  dropped: { row: string; reason: string }[];
  problems: string[];
};

export function readPricePage(page: PdfPage): DomoPricePage {
  const band = readHeaderBand(page.rows, page.page);
  const problems = [...band.problems];
  const body = mergeWrappedCells(page.rows.filter((r) => r.y < BAND_MIN_Y));
  const unitRows = body.filter(looksLikeUnitRow).length;
  const context = `p${page.page}${band.title ? ` (${band.title})` : ""}`;

  const units: DomoUnit[] = [];
  const dropped: { row: string; reason: string }[] = [];
  if (unitRows) {
    /* One page at a time, deliberately. tablesFromPages joins consecutive tables
       whose headers match, which is right inside one project (Navarre's two blocks
       are two pages of one table) and catastrophic across projects — Avon and Arden
       print the identical header and would merge into one eleven-unit "project".
       Pages are grouped into projects by the data file, not by header equality. */
    const { tables } = tablesFromPages([{ ...page, rows: body }]);
    if (!tables.length) problems.push(`${context}: ${unitRows} unit rows on the page but no table could be reconstructed`);
    for (const raw of tables) {
      const table = stripRedundantBlockLetter(raw);
      const { mapping, problems: mapProblems } = domoMapping(table.headers, context, band.title);
      problems.push(...mapProblems);
      if (!mapping.columns.includes("ref") || !mapping.columns.includes("price")) continue;
      const extraction = unitsFromTable(table, mapping);
      units.push(...refineDomoUnits(extraction.units));
      dropped.push(...extraction.dropped);
    }
    if (units.length !== unitRows) {
      problems.push(`${context}: ${unitRows} unit rows on the page but ${units.length} imported — ${dropped.length ? dropped.map((d) => `${d.row} (${d.reason})`).join("; ") : "no reason recorded"}`);
    }
  }

  return { page: page.page, title: band.title, delivery: band.delivery, units, unitRows, building: readBuildingPrice(body), dropped, problems };
}

/* ── The document ─────────────────────────────────────────────────────────── */

export type DomoProjectPrices = {
  slug: string;
  pages: number[];
  title: string | null;
  completion: string | null;
  units: DomoUnit[];
  building: DomoBuildingPrice;
  problems: string[];
};

/** How the data file points a project at its pages. */
export type DomoPageMap = { slug: string; name: string; pages: number[] };

const sameName = (a: string, b: string) => a.replace(/[^a-z0-9]/gi, "").toLowerCase() === b.replace(/[^a-z0-9]/gi, "").toLowerCase();

/* Pages → projects. The mapping comes from the data file and is CHECKED against
   each page's own printed title: if DOMO reorder the list, every page still parses
   perfectly and would land on the wrong project, and a wrong price on the wrong
   project is the worst thing this file could do. */
export function readPriceList(pages: PdfPage[], map: DomoPageMap[]): { projects: DomoProjectPrices[]; pageProblems: string[] } {
  const parsed = new Map<number, DomoPricePage>();
  const pageProblems: string[] = [];
  for (const entry of map) {
    for (const n of entry.pages) {
      if (parsed.has(n)) continue;
      const page = pages.find((p) => p.page === n);
      if (!page) { pageProblems.push(`page ${n} is not in the PDF (${pages.length} pages)`); continue; }
      const read = readPricePage(page);
      parsed.set(n, read);
      pageProblems.push(...read.problems);
    }
  }

  const projects = map.map((entry) => {
    const own = entry.pages.map((n) => parsed.get(n)).filter((p): p is DomoPricePage => !!p);
    const problems: string[] = [];
    for (const p of own) {
      if (p.title && !sameName(p.title, entry.name)) problems.push(`${entry.slug}: page ${p.page} is titled "${p.title}", not "${entry.name}" — the list was reordered, nothing imported`);
    }
    const titleMismatch = problems.length > 0;
    const deliveries = Array.from(new Set(own.map((p) => p.delivery).filter((d): d is string => !!d)));
    if (deliveries.length > 1) problems.push(`${entry.slug}: pages disagree on the delivery date (${deliveries.join(" vs ")}) — no completion written`);

    const units: DomoUnit[] = [];
    const seen = new Set<string>();
    if (!titleMismatch) {
      for (const u of own.flatMap((p) => p.units)) {
        const key = u.ref.toLowerCase();
        if (seen.has(key)) { problems.push(`${entry.slug}: reference ${u.ref} appears on two pages — the second is ignored`); continue; }
        seen.add(key);
        units.push(u);
      }
    }
    const sale = own.map((p) => p.building.sale).find((v) => v !== null) ?? null;
    const rent = own.map((p) => p.building.rent).find((v) => v !== null) ?? null;

    return {
      slug: entry.slug,
      pages: entry.pages,
      title: own[0]?.title ?? null,
      completion: !titleMismatch && deliveries.length === 1 ? deliveries[0] : null,
      units,
      building: { sale: units.length ? null : sale, rent: units.length ? null : rent },
      problems,
    };
  });

  return { projects, pageProblems };
}
