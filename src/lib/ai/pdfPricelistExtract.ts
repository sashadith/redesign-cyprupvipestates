import { extractColoredRowsFromPdf, classifyColor, type ColoredRow } from "./pdfPricelistColors";
import { extractUnitsForSection, type ExtractedPricelistProject, type ExtractedUnit } from "./pricelistExtract";

/* PDF-native price-list extraction (Motive Point, 2026-08-12) — one combined PDF
   covering multiple projects in one table (section headers, not one-PDF-per-project
   like importFromPdfs/extractProjectFromPdfs). Reuses extractUnitsForSection
   (pricelistExtract.ts) per detected project section for every semantic field (ref,
   type, beds, price, ...) — same prompt/schema/model the spreadsheet path uses.

   TWO fields are never trusted to that AI pass, both replaced with values read
   deterministically from the PDF's own data:

   1. `status` — sold/reserved units are shown only via grey text, no status column.
      An AI's context-based guess at "does this look sold" is not the same as
      reading the color the document actually used (see pdfPricelistColors.ts —
      eyeballing this exact PDF visually misclassified 4 of 42 units). Status comes
      EXCLUSIVELY from classifyColor(); anything not unambiguously black is dropped
      from the batch entirely rather than guessed at (see mergeUnit below).

   2. Project identity — extractAvailabilityFromPricelist's own catalog+
      buildCanonicalMatcher name resolution is bypassed entirely for PDF sources.
      Confirmed on this real document: "VENARA" and "VENARA VIEW" got merged into
      one project, because buildCanonicalMatcher's word-overlap scoring gives a
      guess that's a strict subset of a longer canonical name a false 1.0 (full
      confidence) score. That scoring is shared by every spreadsheet-sourced
      developer's sync, so it isn't touched here — instead, this module detects
      project boundaries itself (ALL-CAPS section-header rows, positioned via the
      same real text data pdfPricelistColors.ts already extracts) and uses its own
      name as ground truth for every unit under it, via extractUnitsForSection
      (pricelistExtract.ts) which does per-section field extraction only, no name
      guessing/reconciliation at all.

   Area figures (areaBuilt/areaPlot/areaVeranda/areaVerandaOpen) are ALSO read
   deterministically, from the same column-position data used for status — not
   because they're a safety concern, but because the fast model reformats/rounds
   them inconsistently even when given the exact source text (confirmed: one unit's
   345.78 came back as "346 m²"). Since the raw text is already unambiguous and
   already extracted for the color table, using it directly for these fields costs
   nothing extra and removes AI variability the source data never had. */

export type PdfPricelistResult =
  | { blocked: true; message: string }
  | { blocked: false; projects: ExtractedPricelistProject[]; totalUnits: number; unresolvedUnits: number };

// Same principle as feedSync.ts's checkFeedCompleteness (15% + an absolute floor) —
// don't silently publish a partial/degraded read. The floor is lower here (5, not
// 20): checkFeedCompleteness guards a whole developer's daily feed pull (hundreds of
// units), this guards ONE extraction run of a single price-list document, which may
// legitimately only have a few dozen units total (this one has 42).
const AMBIGUOUS_PCT = 0.15;
const AMBIGUOUS_ABS_FLOOR = 5;

const isAllCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase() && s.trim().length >= 2;
// A "unit row" starts with something that looks like a reference — a short
// alphanumeric token (A101, B205, 101, 7) — and has enough cells to be real table
// data, not a stray label. Deliberately loose (feeds the color/column maps, not the
// DB) — a false positive just means an extra unused map entry; a false negative
// means a real unit's data never gets looked up, which the safety net (unresolved
// -> dropped, never defaulted to available) still catches safely.
const looksLikeRef = (s: string) => /^[A-Za-z]?\d{1,4}[A-Za-z]?$/.test(s.trim());

// Header column label -> ExtractedUnit field, matched in order (first hit wins) so
// e.g. a document that has BOTH "Internal Size" and "Total Covered" columns uses
// the more complete "Total Covered" figure for areaBuilt (matches what the AI pass
// already independently chose for this document's own areaBuilt semantics), only
// falling back to "Internal Size" for a document that has no combined-total column.
const AREA_FIELD_PATTERNS: { field: keyof ExtractedUnit; re: RegExp }[] = [
  { field: "areaBuilt", re: /total\s*covered/i },
  { field: "areaPlot", re: /plot/i },
  // Negative lookbehind matters here: "covered veranda" is a literal substring of
  // "uncovered veranda", so an unanchored /covered\s*veranda/i would match BOTH
  // headers — it only picked the right one by accident before, because this
  // document's own column order happens to put "Covered Veranda" ahead of
  // "Uncovered Veranda" and Array.find() takes the first match.
  { field: "areaVeranda", re: /(?<!un)covered\s*veranda/i },
  { field: "areaVerandaOpen", re: /uncovered\s*veranda/i },
  { field: "areaBuilt", re: /internal\s*size/i }, // fallback only reached if "total covered" never matched for this doc
];
const NO_VALUE_RE = /^(n\/?a|-|—|–|)$/i;

type Section = {
  projectName: string;
  unitRows: { ref: string; cells: string[] }[];
  text: string;
  // Scoped PER SECTION, not document-wide — confirmed necessary, not just tidy:
  // extractUnitsForSection sometimes (non-deterministically — the fast model isn't
  // temperature-0) echoes a unit's ref WITHOUT its block prefix ("A101" instead of
  // "Block A A101"), even though the prompt asks for "the label as shown" and the
  // flattened text it was given has the prefix on every row. Section-scoping is
  // defense in depth against a short reformatted ref (e.g. a bare "1") ever
  // cross-matching a same-named unit in a DIFFERENT project's own table — this
  // document's sections don't actually collide that way, but nothing should rely
  // on that staying true for every future price list.
  colorByRef: Map<string, "black" | "grey" | "unclear">;
  areaByRef: Map<string, Partial<Record<keyof ExtractedUnit, string>>>;
};

// Splits the colored row table into per-project sections (project name = ground
// truth, never re-guessed downstream) and builds each section's own deterministic
// color-status and area-figure lookups, keyed by the SAME block-prefixed ref string
// that ends up in that section's flattened text — so extractUnitsForSection's
// returned `ref` matches by construction when the model echoes it as given, with a
// token-subset fallback (see lookupByRef) for when it doesn't.
function flattenToSections(rows: ColoredRow[]): { sections: Section[]; totalUnitRows: number } {
  const sections: Section[] = [];
  let currentBlock: string | null = null;
  let currentSection: Section | null = null;
  let headerCells: { label: string; x: number }[] = [];
  let totalUnitRows = 0;

  for (const row of rows) {
    const cells = row.cells.filter((c) => c.text.trim());
    if (!cells.length) continue;
    const first = cells[0].text.trim();

    // The column-header row ("Unit | List Price... | Delivery") — captured once,
    // reused for every section (columns stay aligned for the whole document), and
    // also prepended to each section's own text below so every AI call sees it.
    if (!headerCells.length && /^unit$/i.test(first) && cells.some((c) => /price/i.test(c.text))) {
      headerCells = cells.map((c) => ({ label: c.text.trim(), x: c.x }));
      continue;
    }

    if (cells.length <= 2 && isAllCaps(first)) {
      const fresh: Section = { projectName: first, unitRows: [], text: "", colorByRef: new Map(), areaByRef: new Map() };
      sections.push(fresh);
      currentSection = fresh;
      currentBlock = null;
      continue;
    }
    if (cells.length === 1 && !isAllCaps(first)) {
      currentBlock = first; // "Block A"/"Block B" — sub-group within the CURRENT section, not a new one
      continue;
    }
    if (currentSection === null) continue; // stray row before the first real section header — ignore
    const section: Section = currentSection;

    const isUnitRow = cells.length > 3 && looksLikeRef(first);
    if (isUnitRow) {
      totalUnitRows++;
      const ref = currentBlock ? `${currentBlock} ${first}` : first;
      const refKey = ref.toLowerCase();

      const rowColors = cells.map((c) => classifyColor(c.color));
      const distinct = new Set(rowColors);
      // Row-level consistency required, same as the verification step: if this
      // row's own cells don't all agree, the unit's status is unresolved — never
      // pick a majority winner for something this safety-critical.
      section.colorByRef.set(refKey, distinct.size === 1 ? rowColors[0] : "unclear");

      if (headerCells.length) {
        const raw: Partial<Record<keyof ExtractedUnit, string>> = {};
        for (const { field, re } of AREA_FIELD_PATTERNS) {
          if (raw[field]) continue; // already set by an earlier (preferred) pattern
          const col = headerCells.find((h) => re.test(h.label));
          if (!col) continue;
          const cell = cells.reduce((best, c) => (Math.abs(c.x - col.x) < Math.abs((best?.x ?? Infinity) - col.x) ? c : best), null as (typeof cells)[number] | null);
          const text = cell?.text.trim();
          if (text && !NO_VALUE_RE.test(text)) raw[field] = text;
        }
        section.areaByRef.set(refKey, raw);
      }

      section.unitRows.push({ ref, cells: [ref, ...cells.slice(1).map((c) => c.text)] });
    }
  }

  const headerLine = headerCells.length ? headerCells.map((h) => h.label).join("\t") : "";
  for (const s of sections) {
    s.text = [headerLine, ...s.unitRows.map((r) => r.cells.join("\t"))].filter(Boolean).join("\n");
  }
  return { sections, totalUnitRows };
}

// Matches an AI-extracted unit's `ref` back to this section's color/area tables.
// Primary path is exact match on the lowercased ref (expected, since the flattened
// text already carries the block-prefixed form and the prompt asks for "the label
// as shown"). Fallback: the model dropped part of it (observed: "Block A A101"
// echoed back as bare "A101") — accept a match only if EVERY token in the model's
// ref also appears in one table key (the ref is a reduced subset of the full key,
// never the other way around: a short ref like "1" must not match a longer key like
// "block a a101" just because "1" isn't literally one of the key's own tokens).
function lookupByRef<T>(ref: string, table: Map<string, T>): T | undefined {
  const norm = ref.toLowerCase().trim();
  if (table.has(norm)) return table.get(norm);
  const normTokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  if (!normTokens.length) return undefined;
  for (const [k, v] of Array.from(table.entries())) {
    const keyTokens = new Set(k.split(/[^a-z0-9]+/).filter(Boolean));
    if (normTokens.every((t) => keyTokens.has(t))) return v;
  }
  return undefined;
}

export async function extractPricelistFromPdf(buf: Buffer, _full: boolean): Promise<PdfPricelistResult> {
  const rows = await extractColoredRowsFromPdf(buf);
  const { sections, totalUnitRows } = flattenToSections(rows);
  if (!totalUnitRows) return { blocked: true, message: "No unit rows recognized in the PDF (color-table extraction found nothing to parse)." };

  let totalUnits = 0, unresolvedUnits = 0;
  const resultProjects: ExtractedPricelistProject[] = [];

  for (const section of sections) {
    if (!section.unitRows.length) continue;
    const items = await extractUnitsForSection(section.text);
    const keptUnits: ExtractedUnit[] = [];
    for (const u of items) {
      if (!u?.ref) continue;
      totalUnits++;
      const colorStatus = lookupByRef(String(u.ref), section.colorByRef);
      if (colorStatus !== "black" && colorStatus !== "grey") {
        // "unclear" or no match at all — never default to available. Drop the
        // unit rather than guess.
        unresolvedUnits++;
        continue;
      }
      const areaOverrides = lookupByRef(String(u.ref), section.areaByRef) ?? {};
      keptUnits.push({
        ref: String(u.ref),
        bedrooms: u.bedrooms || undefined,
        bathrooms: u.bathrooms || undefined,
        areaGroundFloor: u.areaGroundFloor || undefined,
        areaUpperFloor: u.areaUpperFloor || undefined,
        parking: u.parking || undefined,
        storage: u.storage || undefined,
        pool: u.pool || undefined,
        extras: u.extras || undefined,
        // Deterministic column reads win whenever available; the AI's own value is
        // only ever a fallback for a field this document's header didn't have a
        // recognizable column for.
        areaBuilt: areaOverrides.areaBuilt ?? u.areaBuilt ?? undefined,
        areaPlot: areaOverrides.areaPlot ?? u.areaPlot ?? undefined,
        areaVeranda: areaOverrides.areaVeranda ?? u.areaVeranda ?? undefined,
        areaVerandaOpen: areaOverrides.areaVerandaOpen ?? u.areaVerandaOpen ?? undefined,
        price: colorStatus === "black" ? (typeof u.price === "number" ? u.price : null) : null,
        status: colorStatus === "black" ? "available" : "sold",
        // Grey means "not available" — sold vs reserved can't be told apart by
        // color alone; "sold" is the far more common real-world meaning of a
        // greyed-out price-list row. Neither value can ever surface as buyable,
        // which is the actual safety requirement — this default is a labeling
        // judgment call, not a safety one.
      });
    }
    if (keptUnits.length) resultProjects.push({ project: section.projectName, units: keptUnits });
  }

  if (!resultProjects.length) return { blocked: true, message: "Could not extract any projects from the PDF price list." };

  const ambiguousPct = totalUnits > 0 ? unresolvedUnits / totalUnits : 0;
  if (unresolvedUnits > AMBIGUOUS_ABS_FLOOR && ambiguousPct > AMBIGUOUS_PCT) {
    return {
      blocked: true,
      message: `${unresolvedUnits} of ${totalUnits} units (${Math.round(ambiguousPct * 100)}%) had unresolvable color/status — aborted, nothing written. A partial import risks marking a sold unit available by omission just as easily as by mistake.`,
    };
  }

  return { blocked: false, projects: resultProjects, totalUnits, unresolvedUnits };
}
