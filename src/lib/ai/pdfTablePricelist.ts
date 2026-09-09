import { readGvPriceList, type GvUnit } from "./gvPriceTable";
import type { ExtractedPricelistProject, ExtractedUnit } from "./pricelistExtract";

/* The seam between the G&V price-list reader and the Drive sync (2026-09-08).

   G&V ships one PDF price list per project folder with the status printed as
   TEXT in the price column, which is gvPriceTable's shape — not
   pdfPricelistExtract's, whose status comes from text COLOUR and whose input is
   one developer-wide document covering many projects. Which reader a developer
   gets is an explicit per-slug decision in driveAvailabilitySync.ts, never
   sniffed from the file type: both readers take a PDF, and running one on the
   other's document loses or invents availability silently.

   Deliberately holds no table logic of its own: if a G&V list stops parsing,
   the fix belongs in gvPriceTable.ts, with a fixture. */

export type PdfTablePricelistResult =
  | { blocked: true; message: string }
  | { blocked: false; project: ExtractedPricelistProject; dropped: { row: string; reason: string }[] };

export function gvUnitToExtracted(u: GvUnit): ExtractedUnit {
  const attrs = (u.attrs ?? []).filter((a) => a.name && a.value);
  /* `consumed` tracks the exact attribute OBJECTS picked into a named field
     below, not their names — so `extras` can be built by excluding those
     objects by identity rather than re-matching a name regex against the full
     list. Matching by name was the earlier bug: a broad
     /storage|parking|pool|lift/i regex excluded a "Lift" attribute from extras
     even though nothing consumed it, silently losing it. Filtering by identity
     means only an attribute whose VALUE actually became `parking`, `storage` or
     `pool` is left out of extras — "Lift", a "Swimming pool" dimension that
     didn't match `pool`, and anything else always survive into extras. Every
     attribute ends up in exactly one place: a named field, or extras — never
     both, never neither. */
  const consumed = new Set<{ name: string; value: string }>();
  const pick = (re: RegExp) => {
    const found = attrs.find((a) => !consumed.has(a) && re.test(a.name));
    if (found) consumed.add(found);
    return found?.value;
  };
  const parking = pick(/parking/i);
  const storage = pick(/storage/i);
  const pool = pick(/pool/i);
  const rest = attrs.filter((a) => !consumed.has(a));

  /* ExtractedUnit has no `areaInternal` of its own — its one built-area field
     is `areaBuilt` ("total built/internal area, when given as one figure").
     gvPriceTable's GvUnit does distinguish the two, and Georgia 12 is the one
     G&V layout that prints a dedicated Internal Area column beside a total, so
     the figure has to go somewhere or nine units silently lose it every sync.
     When the layout gives only the internal figure it IS the unit's built area
     and fills `areaBuilt` directly; when both are printed, `areaBuilt` keeps
     the total (the one the listing quotes) and the internal figure is carried
     as an extra rather than overwriting it or being dropped. */
  const areaBuilt = u.areaBuilt || (u.areaInternal ?? undefined) || undefined;
  /* Same rule for `floor`, which ExtractedUnit also has no field for: carried
     as an extra, never dropped. None of G&V's five current layouts prints a
     floor column (Georgia 12's "101"/"201"/"301" carry it in the reference),
     but a column the model maps as `floor` must not disappear. */
  const extras = [
    ...(u.areaInternal && u.areaInternal !== areaBuilt ? [`Internal area: ${u.areaInternal}`] : []),
    ...(u.floor ? [`Floor: ${u.floor}`] : []),
    ...rest.map((a) => `${a.name}: ${a.value}`),
  ];

  return {
    ref: u.ref,
    ...(u.type ? { type: u.type } : {}),
    ...(u.beds ? { bedrooms: u.beds } : {}),
    ...(u.baths ? { bathrooms: u.baths } : {}),
    ...(areaBuilt ? { areaBuilt } : {}),
    ...(u.areaPlot ? { areaPlot: u.areaPlot } : {}),
    ...(u.areaVeranda ? { areaVeranda: u.areaVeranda } : {}),
    ...(u.areaVerandaOpen ? { areaVerandaOpen: u.areaVerandaOpen } : {}),
    ...(parking ? { parking } : {}),
    ...(storage ? { storage } : {}),
    ...(pool ? { pool } : {}),
    ...(extras.length ? { extras: extras.join(", ") } : {}),
    price: u.price,
    status: u.status,
  };
}

/* Runs the G&V reader end to end for one project's PDF price list and adapts
   the units to the shape the Drive sync already consumes. Every row the reader
   refused — a surcharge line, an unreadable price cell, a duplicate reference —
   is carried through as `dropped`, unchanged, for the dry run to report to a
   human, and so is every reference-policy override. Nothing is discarded
   silently. */
export async function extractProjectFromPdfTable(
  buf: Buffer,
  projectName: string,
): Promise<PdfTablePricelistResult> {
  const result = await readGvPriceList(buf, projectName);
  if (!result.ok) return { blocked: true, message: result.message };

  const { extraction } = result;
  const project: ExtractedPricelistProject = {
    project: projectName,
    units: extraction.units.map(gvUnitToExtracted),
  };
  return {
    blocked: false,
    project,
    dropped: [...extraction.dropped, ...extraction.notes.map((note) => ({ row: projectName, reason: note }))],
  };
}
