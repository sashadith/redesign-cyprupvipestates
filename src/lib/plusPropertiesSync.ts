import { parse as parseHtml } from "node-html-parser";
import { countableFeedUnits, completenessVerdict } from "./feedSync";
import { cleanNumber, type PlusUnit } from "./plusProperties";

/* Plus Properties sync. Spec:
   docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
   The pure helpers come first; syncPlusProperties() at the bottom is the only
   code here that touches the database, Drive or the network. */

export const PLUS_DEV = "plusproperties";
export const PLUS_ACCOUNT_SLUG = "plus-properties";
export const PLUS_XML_FOLDER = "1xeFHfoMUGpyAPMgUMe9qMHmyRvyOdnMu";
export const PLUS_PDF_FOLDER = "14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ";
export const PLUS_PROJECTS_FOLDER = "1aXXbOSp_-10rLlHHixQzGR-RKnc342AN";
/* The feeds' floor of 20 units cannot bind here: Plus projects hold 4 to 63
   units, so most of them could lose everything without tripping it. 3 is
   Mito's floor, chosen for the same reason. */
export const PLUS_INCOMPLETE_ABS_FLOOR = 3;

/* The project NUMBER is the identity. Price-list names change with every
   version, and the media tree spells the same number differently. Joined
   numbers use "-" or "_" with no spaces ("67_68_69", "70-71"); a spaced dash
   is not a join ("PLUS 4 - 502 Penthouse" is project 4, unit 502). */
export function projectKey(name: string): string | null {
  if (/house\s*-?\s*kiti/i.test(name)) return "house-kiti";
  const m = name.match(/plus\s*(\d+(?:[-_]\d+)*)/i);
  return m ? m[1].replace(/_/g, "-") : null;
}

export const publicNameFor = (key: string) => (key === "house-kiti" ? "House Kiti" : `Plus ${key}`);
export const feedKeyFor = (key: string) => `${PLUS_DEV}:${key}`;

/* What uniqueDevelopmentSlug() will mint from the public name on publish. The
   connector never writes a slug; the dry run uses this to warn about a clash. */
export const slugCandidate = (publicName: string) =>
  publicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function splitLocation(location: string | null): { town: string | null; district: string | null } {
  if (!location || !location.trim()) return { town: null, district: null };
  /* Greedy: the district is after the LAST dash, spaced or not ("Universal -
     Paphos", "Livadia – Larnaca", "Agios Tychonas-Limassol"). */
  const m = location.trim().match(/^(.*\S)\s*[-–]\s*(\S.*)$/);
  return m ? { town: m[1].trim(), district: m[2].trim() } : { town: null, district: location.trim() };
}

/* The pin (!3d<lat>!4d<lng>) is the place; @lat,lng is only where the map was
   centred, and the two differ (Plus 33: 32.4312 vs 32.4290). Anything outside
   Cyprus is a wrong link, not a location. */
export function coordsFromMapsUrl(url: string | null): { lat: number; lng: number } | null {
  if (!url) return null;
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    ?? url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat > 34.4 && lat < 35.8 && lng > 32.2 && lng < 34.7 ? { lat, lng } : null;
}

/* Only the "Project Details" block of the developer's page: a <strong> label,
   then a <ul>. Raw facts for the AI description generator and the amenity
   list; the operator reviews every draft before it is published. */
export function projectDetails(html: string): { facts: string[]; energy: string | null } {
  const root = parseHtml(html);
  const label = root.querySelectorAll("strong").find((s) => /project details/i.test(s.text));
  /* Most pages wrap the label in its own <p>, so the <ul> is the label's
     PARENT's next sibling; some wrap nothing, so the <ul> follows the
     <strong> directly. Try the direct sibling first. */
  let el = label?.nextElementSibling ?? null;
  if (!el || el.tagName !== "UL") {
    el = label?.parentNode?.nextElementSibling ?? null;
    while (el && el.tagName !== "UL") el = el.nextElementSibling;
  }
  if (!el) return { facts: [], energy: null };
  const all = el.querySelectorAll("li").map((li) => li.text.replace(/\s+/g, " ").trim()).filter(Boolean);
  /* "Solar Energy Panels" also matches /energy/i; only a fact that ALSO ends
     in a class letter ("… Category: A") is the energy fact. Anything else
     matching /energy/i stays a plain amenity. */
  const energyFact = all.find((f) => /energy/i.test(f) && /:\s*[A-G]\+?\s*$/i.test(f)) ?? null;
  const energy = energyFact?.match(/:\s*([A-G]\+?)\s*$/i)?.[1]?.toUpperCase() ?? null;
  return { facts: all.filter((f) => f !== energyFact), energy };
}

/* How the website's facts land on a Development, per the spec's field mapping:
   all of them, one per line, as the raw `description` the AI generator starts
   from; plain ones ("Common Swimming Pool") as amenities; "Label: value" ones
   as extra facts. The operator reviews every draft before it is published. */
export function detailFields(d: { facts: string[]; energy: string | null } | null): {
  description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string;
} {
  if (!d) return {};
  const out: { description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string } = {};
  if (d.facts.length) out.description = d.facts.join("\n");
  const plain = d.facts.filter((f) => !/^[^:]{2,40}:\s*\S/.test(f));
  const labelled = d.facts.filter((f) => /^[^:]{2,40}:\s*\S/.test(f)).map((f) => {
    const i = f.indexOf(":");
    return { label: f.slice(0, i).trim(), value: f.slice(i + 1).trim() };
  });
  if (plain.length) out.amenities = plain;
  if (labelled.length) out.extraFacts = labelled;
  if (d.energy) out.energy = d.energy;
  return out;
}

/* The feeds' completeness rule, per project: count only what this sync can
   change (countableFeedUnits), never units already flagged unlisted. */
export function unitsDecision(input: {
  published: boolean;
  stored: { status: string | null }[];
  fresh: { status: string }[];
}): { blocked: boolean; message: string | null } {
  const before = countableFeedUnits(input.stored.filter((u) => u.status !== "unlisted"), input.published);
  const after = countableFeedUnits(input.fresh, input.published);
  const v = completenessVerdict(before, after, PLUS_INCOMPLETE_ABS_FLOOR);
  return v.blocked
    ? { blocked: true, message: `${v.missing} of ${before} units are missing from the price list (${v.pctLabel} %). Nothing was changed.` }
    : { blocked: false, message: null };
}

/* A run that lost most of its Drive requests (an expired token, an outage)
   writes nothing, rather than reading 35 projects as empty. */
export function runVerdict(input: { attempted: number; failed: number }): { ok: boolean; reason: string | null } {
  if (input.attempted > 0 && input.failed * 2 > input.attempted) {
    return { ok: false, reason: `${input.failed} of ${input.attempted} Drive request(s) failed — nothing was written` };
  }
  return { ok: true, reason: null };
}

/* Exactly "what the admin unit editor can write and this sync does not" —
   carried over by unit ref so hand-set values survive every run (Cybarco,
   2026-09-24). If the sync ever starts writing one of these, it comes off
   this list in the same commit. */
export const MANUAL_UNIT_FIELDS = ["type", "unitNumber", "guestWc", "orientation", "amenities", "photos", "plans"] as const;

export function carryOverManualUnitFields(kept: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!kept) return {};
  const out: Record<string, unknown> = {};
  for (const f of MANUAL_UNIT_FIELDS) {
    const v = kept[f];
    if (v !== null && v !== undefined) out[f] = v;
  }
  return out;
}

const str = (n: number | null) => (n == null ? null : String(n));

/* One DevelopmentUnit row. areaBuilt is what the public unit table shows
   (Covered Area = areaBuilt + areaVeranda, as for Island Blue), so the interior
   goes there as well as to areaInternal. `storage` is a yes/no column; the
   count lives in attrs. A price only ever travels with an available unit. */
export function unitRow(u: PlusUnit, developmentId: string, index: number, kept?: Record<string, unknown> | null): Record<string, unknown> {
  const attrs: { name: string; value: string }[] = [];
  const add = (name: string, v: string | number | null) => { if (v != null && v !== "") attrs.push({ name, value: String(v) }); };
  add("Parking", u.parking);
  add("Storage", u.storage);
  add("Roof terrace (m²)", u.areaRoof);
  add("Garden (m²)", u.areaGarden);
  add("Common area (m²)", u.areaCommon);
  add("Total area (m²)", u.areaTotal);
  const storageCount = cleanNumber(u.storage) ?? 0;
  return {
    ...carryOverManualUnitFields(kept),
    developmentId, source: "feed",
    ref: u.ref, feedRef: u.ref, label: u.label,
    status: u.status, price: u.status === "available" ? u.price : null, currency: "EUR",
    beds: u.beds, baths: u.baths, floor: u.floor,
    /* "1", "1 Roof", "Yes" → yes. */
    storage: u.storage == null ? null : storageCount > 0 || /yes/i.test(u.storage) ? "yes" : "no",
    areaBuilt: str(u.areaBuilt), areaInternal: str(u.areaBuilt),
    areaVeranda: str(u.areaVeranda), areaVerandaOpen: str(u.areaVerandaOpen), areaPlot: str(u.areaPlot),
    attrs, sortIndex: index,
  };
}
