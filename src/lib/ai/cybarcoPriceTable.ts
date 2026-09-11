import type { PdfCell, PdfPage, PdfRow, UnitStatus } from "./availabilityTable";

/* A price-list reader for Cybarco, self-contained on purpose.
   availabilityTable.ts (Korantina) and gvPriceTable.ts (G&V) read the same
   FAMILY of document — status printed as text inside the price column — but
   the one attempt to serve two developers from one engine, during the G&V
   build, produced three Korantina regressions that only a live dry-run caught:
   City Landmark 33 units to 1, Inner City 3 gaining a duplicate Development
   through a shifted table ordinal, Royal Bay 43 to 42. A third reader is
   cheaper than a fourth regression. Neither of the other two files is touched.

   Everything here was measured against the NINE real Cybarco price lists
   (scripts/qa/fixtures/cybarco/pl-*.json) — every price list the developer
   publishes: five captured on 2026-09-10, Trilogy Limassol Seafront on
   2026-09-11 (the one that proved the section-heading vocabulary was too
   narrow), and Park Residences, Limassol Greens and Seaview Heights the same
   day. Every figure quoted in the comments below was re-measured over all nine.

   Limassol Greens is the document that earned four of the fixes below at once —
   a status word the reader did not know, two tables continued over a page break
   with no repeated header, and two more reference labels — and between them
   they were losing 42 of its 115 units with no count, no null and no error to
   show for it. */

/** All cells whose left edge falls in [x0, x1), joined left to right. */
export function joinColumn(row: PdfRow, x0: number, x1: number): string {
  return row.cells
    .filter((c) => c.x >= x0 && c.x < x1)
    .sort((a, b) => a.x - b.x)
    .map((c) => c.t.trim())
    .join("");
}

/* pdf.js splits a single printed price across several cells — "5", "60", ",",
   "0", "00" for 560,000 — so the input here is already the JOINED column, and
   the separators are whatever survived that join. Anything under SIX digits is
   refused. That floor is measured, not guessed: across all NINE committed
   fixtures (scripts/qa/fixtures/cybarco/pl-*.json), every real price, once
   joined, is 6 or 7 digits — the smallest is now "320,000" (Park Residences
   units 203 and 204, and Seaview Heights D104; it was "350,000" when only six
   documents were known), the largest still "6,200,000" (Marina, unit D52). The
   largest numeric value that turns up in a NEIGHBOURING column is still only 4
   digits: plot areas up to 1035 m² (Akamas Villas, villa 7, a K4 — this comment
   used to call it a K5, which is villa 8, plot 1000), Limassol Greens' one
   comma-grouped plot "1,600" (villa 47), and bare years like 2026/2027/2028 in
   delivery-date text. A floor of 6 clears every measured price with a
   two-digit margin to spare while still refusing every measured impostor
   (which tops out at 4 digits) — reading one of those as a price is worse than
   reading nothing. */
export function cybarcoParsePrice(raw: string): number | null {
  const s = (raw || "").replace(/[€$£]/g, "").replace(/\s/g, "").trim();
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const digits = s.replace(/[.,]/g, "");
  if (!/^\d{6,9}$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Status vocabulary, English and Russian. Centro Limassol's linked list is
   Russian throughout; "ПЕРЕГОВОРЫ" (under negotiation) is treated as reserved
   because it is emphatically not a unit anyone can buy today, and reserved is
   its own status by operator decision (2026-09-10).

   "UNDER OFFER" is Limassol Greens' word for the same thing, and it is the one
   addition that was NOT a refinement: eleven of that document's 115 rows print
   it, and because an unrecognised outcome DROPS the row (see
   cybarcoUnitsFromPages), all eleven vanished — four apartments of Block A, one
   villa and all six under-offer townhouses — without any count to notice. It
   maps to reserved for exactly the reason ПЕРЕГОВОРЫ does: an offer is on the
   table, so the unit is not for sale today and it is not sold either. The list
   prints it as ONE cell ("UNDER OFFER"), but joinColumn joins a column's cells
   tight, so a future list that splits it across two cells would arrive as
   "UNDEROFFER" — hence the optional space rather than a literal one. */
const SOLD_RE = /^(SOLD(\s*OUT)?|ПРОДАНО)$/i;
const RESERVED_RE = /^(RESERVED|RESERVE|UNDER\s*OFFER|РЕЗЕРВ|ПЕРЕГОВОРЫ)$/i;

export function cybarcoReadOutcome(raw: string): { status: UnitStatus; price: number | null } | null {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (SOLD_RE.test(s)) return { status: "sold", price: null };
  if (RESERVED_RE.test(s)) return { status: "reserved", price: null };
  const price = cybarcoParsePrice(s);
  return price === null ? null : { status: "available", price };
}

/* ── Table level: a whole price list into units ──────────────────────────── */

export type CybarcoUnit = {
  ref: string;
  block: string | null;
  floor: string | null;
  beds: string | null;
  areaInternal: string | null;
  areaVeranda: string | null;
  areaBuilt: string | null;
  areaPlot: string | null;
  price: number | null;
  status: UnitStatus;
};

/* Column bounds come from the header, never from fixed offsets: the six
   committed documents differ in width, column count and order — Limassol Marina
   adds Sundeck, Pool/Spa, Basement and berth columns, Trilogy adds Parking
   Spaces, Akamas a Villa Type — and they run 8 to 11 columns wide. A column is
   the band between its header's centre and its neighbours'. */
type Column = { key: keyof CybarcoUnit | "ignore"; x0: number; x1: number };

/* ORDER IS LOAD-BEARING, and the Russian list is why. Centro's total-covered
   column is headed "Общая крытая площадь", which CONTAINS "крытая площадь" —
   the internal-area label. Testing internal first labels the total-covered
   column as the internal area and never finds the real one. Specific before
   general, always.

   The terrace rule below is the one entry that earns nothing today: "Roof
   Terraces" (Naftikos), "Uncovered Terraces" (Akamas, Marina) and "Covered
   Terraces" all contain "terrace", but the covered one is leftmost in all six
   documents and value() already takes the leftmost of a repeated key, so
   deleting the rule changes no fixture. It stays because it says WHICH terrace
   is the veranda rather than leaving that to column order. */
const HEADER_KEYS: [RegExp, Column["key"]][] = [
  /* Seaview Heights heads its villa plot column "Plot Size", not "Plot Area".
     Nothing moved and nothing was dropped — all nine of its villas were read,
     with the right prices — but their plot area came out null, which is the
     silent-null failure the per-field pins exist to catch. */
  [/plot\s*(area|size)/i, "areaPlot"],
  /* Four printed spellings of the same column across the nine documents:
     "Apt. No.", "Villa No.", "Townhouse No." and — Limassol Greens' Kinglet
     villas — a bare "Kinglet", because that list sets "Kinglet" and "No." side
     by side on ONE line 29.8 pt apart, further than COLUMN_GAP, so "No." ends up
     a column of its own (labelled, harmlessly, "ignore"). The suffix is
     therefore optional and the whole label is anchored, which is what keeps
     "Villa Type", "Townhouse Type" and "Kinglet Type" out of the reference
     column: without the anchor the type column of three documents would claim
     the key. */
  [/^(apt\.?|villa|townhouse|kinglet)(\s*(no\.?|№))?$/i, "ref"],
  [/^апарт/i, "ref"],
  [/^floor/i, "floor"],
  [/^этаж/i, "floor"],
  [/bedroom/i, "beds"],
  [/^спальни/i, "beds"],
  [/(uncovered|roof)\s*terrace/i, "ignore"],
  [/total\s*covered/i, "areaBuilt"],
  [/общая\s*крытая/i, "areaBuilt"],
  [/internal/i, "areaInternal"],
  [/крытая\s*площадь/i, "areaInternal"],
  [/terrace/i, "areaVeranda"],
  [/террас/i, "areaVeranda"],
  [/^price/i, "price"],
  [/^цена/i, "price"],
];

/* A unit's block is printed ONCE above its run of rows, never on the row
   itself: "BUILDING A" (Naftikos), "ЗДАНИЕ Б" (Centro — note that page 1 of the
   same document writes the building letter as a LATIN "A" inside a Cyrillic
   word), "Castle Residences" and "Island Villas" (Limassol Marina), "EAST
   TOWER" and "NORTH RESIDENCES (A)" (Trilogy). Centro reuses apartment numbers
   between its two buildings, so the heading is the only thing separating 101-А
   from 101-Б.

   Every one of those is the same three-part shape — up to two qualifier words,
   a building-type noun, and an optional designator that may be bare ("A") or
   parenthesised ("(A)") — so that is what is matched, rather than a list of the
   exact strings seen so far. The first version of this regex was a list, and it
   silently swallowed all three of Trilogy's towers: every unit came out with
   block null and no count moved, because the rows were still read.

   The noun is what keeps this narrow. Every heading-shaped line these six
   documents print that is NOT a section heading lacks one — "Total",
   "Available Properties", "Notes", "Terms of Payment", "Reservation Policy",
   "Ready for immediate delivery", "Covered Areas Uncovered Areas". The two
   near misses are Akamas' own notes, "Villa 21" and "Villas 22 & 41": the
   singular "Villa" is deliberately not in the vocabulary, and "22 & 41" is more
   than one designator, so neither matches.

   Widened a second time on 2026-09-11, for Limassol Greens, which captions its
   four sections "Starlings Apartments Block A", "Villas Pricelist", "Ibis
   Townhouses Pricelist" and "Kinglet Villas Pricelist". Two additions carry
   them: the nouns BLOCK and TOWNHOUSES, and an optional trailing "Pricelist"
   (a caption word, never a designator). This one is not cosmetic — that
   document numbers its townhouses 1-18 and its Kinglet villas 1-13, so with
   every block null the pair (block, ref) collides thirteen times and a sync
   keyed on it would fold two physical houses into one row.
   Re-checked line by line on 2026-09-11 against every row of all NINE fixtures
   (658 flattened lines): this regex matches those THIRTEEN headings and nothing
   else. It is also what keeps "Kinglet Villas Pricelist" from being mistaken for
   a table header, since its first cell is a bare "Kinglet" — the heading test
   runs first and consumes the line. */
const BLOCK_RE =
  /^(?:[A-Za-zА-Яа-я’'-]+ ){0,2}(BUILDING|BLOCK|TOWER|RESIDENCES|VILLAS|TOWNHOUSES|ЗДАНИЕ|КОРПУС)(?: \(?[A-ZА-Я0-9]{1,3}\)?)?(?: PRICELIST)?$/i;

/* "A 101", "B22", "101", "7". Cybarco's own fragmentation means the reference
   arrives as "A 10" + "4" and is joined back together before this is applied. */
const REF_RE = /^(?:[A-Z]{1,3}\s?)?\d{1,4}$/;

/* Header text is set in tight lines and table rows are not. Re-measured across
   all NINE fixtures on 2026-09-11: the vertical gap INSIDE a header block is
   5.1-8.4 pt, and the smallest gap between a header block and the nearest line
   that is not part of it is 11.3 pt — Akamas' spanning "Covered Areas" caption,
   which is correctly left out because it labels a group of columns, not a
   column. (Excluding it the next-smallest is 12.4 pt, Aktea 4's first data row.)

   Trilogy is still what makes this tight: it sets its header on TWO lines
   8.3-8.4 pt apart, where the others use five or six lines 5.1-6.5 pt apart. The
   three documents added on 2026-09-11 did NOT narrow the margin — this was the
   hazard they were expected to expose and they did not: their widest
   inside-header gap is 6.5 pt (Limassol Greens' townhouse table) and their
   nearest outside line is 14.4 pt (Seaview Heights). Every caption they print
   sits 36-46 pt above its header.

   Getting this wrong is loud rather than quiet, but not as loud as this comment
   used to claim. Swept over all nine fixtures, the value that survives the suite
   is 9 to 12; 8 and below takes Trilogy's two per-field pins (its header stops
   one line short and the floor goes null), 6 adds Limassol Greens', and 13 takes
   18 assertions because Aktea 4's first data row folds into its header. The
   earlier note here said "28 or 56 assertions either way", which no longer
   matches a measurement: the value is decided from BELOW, by Trilogy's 8.4 pt,
   with three points of slack above it rather than 0.6. */
const HEADER_LINE_GAP = 9;

/* A bare number or a lone "m" is a unit of measure, never a column's identity:
   pdf.js emits the "²" of "m²" as its own fragment, and where the label is set
   as "Area m" + "²" the "m" is orphaned too. They are dropped BEFORE the
   fragments are clustered, not merely before the label is matched, because they
   sit at the right-hand edge of their own label and act as stepping stones
   between columns — with them in, Limassol Marina's "Covered Terraces" and
   "Basement" columns chain into one and villa 85's 12 m² of terrace and 89 m²
   of basement are read as a single "1289". */
const NOISE_FRAGMENT_RE = /^([0-9²]+|[mм])$/;

/* Two header fragments belong to the same column when their centres are within
   this distance. Re-measured over the header blocks of all NINE fixtures, once
   the noise fragments above are gone: the widest split INSIDE one column is
   13.8 pt (Centro sets "Апарт." and "№" on two lines, off-centre from each
   other), and the narrowest gap BETWEEN two columns is 29.8 pt — Limassol
   Greens' Kinglet table, which prints "Kinglet" and "No." SIDE BY SIDE on one
   line that far apart, so the two halves of a single label become two columns.
   That split is harmless but it is where the margin now lives; the narrowest
   gap between two genuinely different columns is still 31.8 pt (Trilogy's
   "Apt. No." to "Floor No.", with Marina's villa table next at 32.4). 20 pt
   sits between those two.
   Only the UPPER bound bites: at 35 pt Marina's reference and plot columns
   merge and villa 85 loses its plot area. Going the other way is survivable
   here — at 10 pt the "." of "Апарт." becomes a column of its own, the label
   still reads "Апарт №", and no value moves — so the margin below is comfort,
   not proof. */
const COLUMN_GAP = 20;

/* Only these exact labels open a header block. They are deliberately strict:
   Marina's notes contain "Villas 54 & 85 have zero VAT..." and "Apartment B22
   has zero VAT", and a looser anchor treats each of those as the start of a new
   table — which is why the singular "apartment" is NOT in the vocabulary even
   though "apt." is.

   "townhouse" and "kinglet" were added on 2026-09-11 for Limassol Greens, whose
   six pages head their reference column four different ways. This was the
   loudest of the three predicted hazards and the quietest in practice: a page
   whose reference label is not recognised produces NO units for that whole
   table and says nothing, so the Ibis townhouses (18 rows) and the Kinglet
   villas (13 rows) were simply absent — 31 of 115 units, with every other count
   on the document still exact.
   Checked cell by cell across all nine fixtures (4,749 cells): these patterns
   match 26 cells, every one of them inside a real table header or the "Kinglet
   Villas Pricelist" caption, which BLOCK_RE consumes first. */
const REF_LABEL_RE = /^(apt\.?|villa|townhouse|kinglet|апарт)\s*(no\.?|№)?$/i;

const centre = (c: { x: number; w: number }) => c.x + c.w / 2;

/** A row's whole text, in x order, for heading detection. */
function flatten(row: PdfRow): string {
  return row.cells
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((c) => c.t.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* A price list is read page by page. Each page MAY contribute its own header
   (the villa and apartment shapes differ, and Limassol Marina changes shape
   twice within one page) and its own heading, and both carry forward until the
   next one replaces them — across a page break as well as down a page.
   Carrying them ACROSS pages is the 2026-09-11 fix. Limassol Greens runs two of
   its tables over a page break and repeats neither the heading nor the header
   on the second page: page 2 is five more Block A apartments, page 4 is one
   more villa. Resetting per page threw all six away in silence, because a page
   with no header simply yields nothing. The five documents that do repeat a
   header on their later pages — Naftikos and Centro — are unaffected: their
   page 2 prints both a heading and a header, and each overwrites what it
   inherited before a single row is read. */
export function cybarcoUnitsFromPages(pages: PdfPage[]): CybarcoUnit[] {
  const out: CybarcoUnit[] = [];
  let columns: Column[] | null = null;
  let block: string | null = null;
  for (const page of pages) {
    /* Top to bottom, sorted rather than assumed. Everything below depends on
       reading order — a heading applies to the rows BELOW it, a header to the
       table below it — and a page whose rows arrived in any other order would
       attach both to the wrong run of units without failing. */
    const rows = page.rows.slice().sort((a, b) => b.y - a.y);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const flat = flatten(row);
      if (!flat) continue;

      if (BLOCK_RE.test(flat)) {
        block = flat;
        continue;
      }

      if (row.cells.some((c) => REF_LABEL_RE.test(c.t.trim()))) {
        /* The header is several printed lines ("Covered" above "Internal" above
           "Area m²"), and the line carrying the reference label is not always
           the first of them, so the block is grown in both directions from it. */
        let from = i;
        while (from > 0 && rows[from - 1].y - rows[from].y <= HEADER_LINE_GAP) from--;
        let to = i;
        while (to + 1 < rows.length && rows[to].y - rows[to + 1].y <= HEADER_LINE_GAP) to++;
        const built = columnsFrom(rows.slice(from, to + 1));
        if (built) columns = built;
        i = to; // never read a header line as a unit
        continue;
      }

      if (!columns) continue;

      /* A cell belongs to the column its CENTRE falls in, not its left edge.
         Cybarco centres every cell, so a cell wider than the column pitch hangs
         out over both neighbours: Centro's "ПЕРЕГОВОРЫ" (70.5 pt) is wider than
         its own price column's 69.9 pt pitch and starts 0.3 pt to the LEFT of
         the boundary. Reading by left edge dropped that unit — one unit, in a
         60-unit document, silently. joinColumn works on left edges by design
         (it is the primitive that reassembles a fragmented price), so the row is
         handed to it as zero-width points at each cell's centre instead of being
         given a second, subtly different joining rule. */
      const centred: PdfRow = { y: row.y, cells: row.cells.map((c) => ({ x: centre(c), w: 0, t: c.t })) };

      /* Leftmost wins when several columns carry the same key: a document that
         repeats a word (three columns of Naftikos contain "Terraces") must not
         have the choice decided by which one happens to be last. */
      const column = (key: Column["key"]) => columns!.find((c) => c.key === key);
      const value = (key: Column["key"]) => {
        const col = column(key);
        return col ? joinColumn(centred, col.x0, col.x1).trim() : "";
      };

      /* The reference is the one field read as PRINTED rather than as joined
         text. Naftikos prints "A 101" as a single cell but "A 501" as "A" + "5"
         + "01", and joining those without regard to spacing yields "A501" for
         four units of a document whose other thirty-three say "A 101" — one
         printed reference, two strings, in the field everything downstream uses
         as identity. Every other column is joined tight on purpose: that is what
         reassembles "5" + "60" + "," + "0" + "00" into a price, and what keeps
         a split "RESERVED" from becoming "RESER VED". */
      const refColumn = column("ref");
      const ref = refColumn ? joinPrinted(row, refColumn).replace(/\s+/g, " ").trim() : "";
      if (!REF_RE.test(ref)) continue;

      /* No outcome, no unit. A row whose price cell cannot be resolved is
         DROPPED rather than defaulted to available — the rule the Korantina
         reader had to learn the hard way. The counts in
         scripts/qa/cybarco-pricelist-check.mjs are what makes a drop visible. */
      const outcome = cybarcoReadOutcome(value("price"));
      if (!outcome) continue;

      out.push({
        ref,
        block,
        floor: value("floor") || null,
        beds: value("beds") || null,
        areaInternal: value("areaInternal") || null,
        areaVeranda: value("areaVeranda") || null,
        areaBuilt: value("areaBuilt") || null,
        areaPlot: value("areaPlot") || null,
        price: outcome.price,
        status: outcome.status,
      });
    }
  }
  return out;
}

/* Builds the columns of one table from its header lines. Returns null when the
   block does not look like a table header at all, in which case the caller
   keeps the columns it already had. */
function columnsFrom(band: PdfRow[]): Column[] | null {
  type Frag = PdfCell & { y: number };
  const frags: Frag[] = [];
  for (const row of band) {
    for (const cell of row.cells) {
      const t = cell.t.trim();
      if (t && !NOISE_FRAGMENT_RE.test(t)) frags.push({ x: cell.x, w: cell.w, t, y: row.y });
    }
  }
  if (!frags.length) return null;
  frags.sort((a, b) => centre(a) - centre(b));

  /* Single-linkage by centre, not by left edge: header text is centred in its
     column while the cells under it have wildly different widths ("Apt. No."
     against "B22"), so left edges of the same column disagree by more than the
     columns themselves are apart. */
  const clusters: Frag[][] = [];
  for (const f of frags) {
    const last = clusters[clusters.length - 1];
    if (last && centre(f) - centre(last[last.length - 1]) <= COLUMN_GAP) last.push(f);
    else clusters.push([f]);
  }

  const cols = clusters.map((cluster) => ({
    key: keyFor(labelOf(cluster)),
    centre: cluster.reduce((sum, f) => sum + centre(f), 0) / cluster.length,
  }));
  if (!cols.some((c) => c.key === "ref") || !cols.some((c) => c.key === "price")) return null;

  return cols.map((c, i) => ({
    key: c.key,
    /* Open at both ends. The rightmost column is the price in every list seen,
       and closing it at the page width would be one mis-measured page away from
       dropping prices — which is the one thing this reader must never do
       quietly. */
    x0: i === 0 ? 0 : (c.centre + cols[i - 1].centre) / 2,
    x1: i === cols.length - 1 ? Number.POSITIVE_INFINITY : (c.centre + cols[i + 1].centre) / 2,
  }));
}

/* One line of fragments as it was PRINTED: fragments that touch are one word,
   fragments with real space between them are two. The threshold is 1.5 pt —
   measured, the widest gap inside a broken word is 0.1 pt ("5" + "01" of
   "A 501") and the narrowest printed space is 3.1 pt ("A" + "5" of the same
   reference). Cybarco splits header words the same way it splits references and
   prices: Aktea 4's price column is printed as "Pric" + "e", and "Pric e"
   matches nothing. */
function joinFragments(line: { x: number; w: number; t: string }[]): string {
  return line.reduce(
    (acc, f, i) => (i === 0 ? f.t : acc + (f.x - (line[i - 1].x + line[i - 1].w) > 1.5 ? " " : "") + f.t),
    "",
  );
}

/** The cells whose CENTRE falls in a column, read as printed. */
function joinPrinted(row: PdfRow, col: Column): string {
  const cells = row.cells
    .filter((c) => centre(c) >= col.x0 && centre(c) < col.x1)
    .sort((a, b) => a.x - b.x);
  return joinFragments(cells);
}

/** A column's label, read down its printed lines. */
function labelOf(cluster: { x: number; w: number; t: string; y: number }[]): string {
  const lines = Array.from(new Set(cluster.map((f) => f.y))).sort((a, b) => b - a);
  return lines
    .map((y) => joinFragments(cluster.filter((f) => f.y === y).sort((a, b) => a.x - b.x)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyFor(label: string): Column["key"] {
  const hit = HEADER_KEYS.find(([re]) => re.test(label));
  return hit ? hit[1] : "ignore";
}
