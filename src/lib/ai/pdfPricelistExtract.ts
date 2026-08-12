import { extractColoredRowsFromPdf, classifyColor, type ColoredRow } from "./pdfPricelistColors";
import { extractAvailabilityFromPricelist, type ExtractedPricelistProject } from "./pricelistExtract";

/* PDF-native price-list extraction (Motive Point, 2026-08-12) — one combined PDF
   covering multiple projects in one table (section headers, not one-PDF-per-project
   like importFromPdfs/extractProjectFromPdfs). Deliberately reuses
   extractAvailabilityFromPricelist unchanged for every SEMANTIC field (ref, type,
   beds, areas, price, project grouping) by converting the color-extracted table into
   the same "### Project Name" flattened-text shape getSpreadsheetText already
   produces for XLSX — all of that function's multi-project splitting, canonical-name
   matching, and field-parsing machinery is proven and untouched.

   The ONE field never trusted to that AI pass is `status` — sold/reserved units are
   shown only via grey text, and an AI's context-based guess at "does this look sold"
   is not the same as reading the color the document actually used. Status here comes
   EXCLUSIVELY from classifyColor() (see pdfPricelistColors.ts) and overwrites
   whatever extractAvailabilityFromPricelist inferred. Anything the classifier can't
   resolve to unambiguously black is NEVER written as "available" — it's dropped from
   the batch entirely (see mergeColorStatus below) rather than guessed at. */

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
// data, not a stray label. Deliberately loose (feeds the color map, not the DB) —
// a false positive here just means an extra unused color-map entry; a false
// negative means a real unit's color never gets looked up, which the safety net
// (unresolved -> dropped, never defaulted to available) still catches safely.
const looksLikeRef = (s: string) => /^[A-Za-z]?\d{1,4}[A-Za-z]?$/.test(s.trim());

type FlattenResult = { text: string; colorByRef: Map<string, "black" | "grey" | "unclear">; totalUnitRows: number };

// Converts the raw colored table into extractAvailabilityFromPricelist's expected
// "### Project Name" text shape, AND builds the color-status lookup keyed by the
// EXACT ref string that ends up in that text — including any block prefix, applied
// here deterministically rather than left for the AI to reconstruct. This sidesteps
// the one real risk in reusing that function: PROMPT_UNITS tells the model to
// "prefix the block" itself from a bare "Block A" marker row, which would make an
// independently-produced ref hard to match back against this module's own color
// table. Baking the prefix in before either side ever sees the text means the same
// string is used for BOTH the AI's input and this module's lookup key — no
// reconciliation needed, only a defensive fallback (see mergeColorStatus) in case
// the model still reformats it.
function flattenToPricelistText(rows: ColoredRow[]): FlattenResult {
  const lines: string[] = [];
  const colorByRef = new Map<string, "black" | "grey" | "unclear">();
  let currentBlock: string | null = null;
  let totalUnitRows = 0;

  for (const row of rows) {
    const cells = row.cells.filter((c) => c.text.trim());
    if (!cells.length) continue;
    const first = cells[0].text.trim();

    if (cells.length <= 2 && isAllCaps(first)) {
      // New project section. Reset the current block — a block label only ever
      // applies within the section it appears in.
      lines.push(`### ${first}`);
      currentBlock = null;
      continue;
    }
    if (cells.length === 1 && !isAllCaps(first)) {
      // Sub-group label ("Block A", "Block B") — not a project, not a data row.
      currentBlock = first;
      continue;
    }

    const isUnitRow = cells.length > 3 && looksLikeRef(first);
    if (isUnitRow) {
      totalUnitRows++;
      const ref = currentBlock ? `${currentBlock} ${first}` : first;
      const rowColors = cells.map((c) => classifyColor(c.color));
      const distinct = new Set(rowColors);
      // Row-level consistency required, same as the verification step: if this
      // row's own cells don't all agree, the unit's status is unresolved — never
      // pick a majority winner for something this safety-critical.
      const status = distinct.size === 1 ? rowColors[0] : "unclear";
      colorByRef.set(ref.toLowerCase(), status);
      lines.push([ref, ...cells.slice(1).map((c) => c.text)].join("\t"));
    } else {
      lines.push(cells.map((c) => c.text).join("\t"));
    }
  }
  return { text: lines.join("\n"), colorByRef, totalUnitRows };
}

// Matches an AI-extracted unit's `ref` back to this module's color table. Primary
// path is exact match on the lowercased ref (expected, since the flattened text
// already carries the block-prefixed form and the prompt asks for "the label as
// shown"). Fallback: the AI reformatted it — accept a match only if the color
// table's key is fully contained as a token, never a loose substring that could
// cross-match a different unit (e.g. "1" inside "101").
function lookupColor(ref: string, colorByRef: Map<string, "black" | "grey" | "unclear">): "black" | "grey" | "unclear" | undefined {
  const norm = ref.toLowerCase().trim();
  if (colorByRef.has(norm)) return colorByRef.get(norm);
  const normTokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  for (const [key, status] of Array.from(colorByRef.entries())) {
    const keyTokens = key.split(/[^a-z0-9]+/).filter(Boolean);
    if (keyTokens.length && keyTokens.every((t) => normTokens.includes(t))) return status;
  }
  return undefined;
}

export async function extractPricelistFromPdf(buf: Buffer, full: boolean): Promise<PdfPricelistResult> {
  const rows = await extractColoredRowsFromPdf(buf);
  const { text, colorByRef, totalUnitRows } = flattenToPricelistText(rows);
  if (!totalUnitRows) return { blocked: true, message: "No unit rows recognized in the PDF (color-table extraction found nothing to parse)." };

  const projects = await extractAvailabilityFromPricelist(text, full);
  if (!projects.length) return { blocked: true, message: "Could not extract any projects from the PDF price list." };

  let totalUnits = 0, unresolvedUnits = 0;
  const resultProjects: ExtractedPricelistProject[] = [];
  for (const p of projects) {
    const keptUnits = [];
    for (const u of p.units) {
      totalUnits++;
      const colorStatus = lookupColor(u.ref, colorByRef);
      if (colorStatus === "black") {
        keptUnits.push({ ...u, status: "available" as const });
      } else if (colorStatus === "grey") {
        // Grey means "not available" — sold vs reserved can't be told apart by
        // color alone; "sold" is the far more common real-world meaning of a
        // greyed-out price-list row (see the investigation report). Neither
        // value can ever surface as buyable, which is the actual safety
        // requirement — this default is a labeling judgment call, not a safety
        // one, and is called out explicitly for review.
        keptUnits.push({ ...u, status: "sold" as const, price: null });
      } else {
        // colorStatus is "unclear" or undefined (no match at all) — never
        // default to available. Drop the unit rather than guess.
        unresolvedUnits++;
      }
    }
    if (keptUnits.length) resultProjects.push({ ...p, units: keptUnits });
  }

  const ambiguousPct = totalUnits > 0 ? unresolvedUnits / totalUnits : 0;
  if (unresolvedUnits > AMBIGUOUS_ABS_FLOOR && ambiguousPct > AMBIGUOUS_PCT) {
    return {
      blocked: true,
      message: `${unresolvedUnits} of ${totalUnits} units (${Math.round(ambiguousPct * 100)}%) had unresolvable color/status — aborted, nothing written. A partial import risks marking a sold unit available by omission just as easily as by mistake.`,
    };
  }

  return { blocked: false, projects: resultProjects, totalUnits, unresolvedUnits };
}
