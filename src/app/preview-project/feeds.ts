import { parseStringPromise } from "xml2js";
import type { UnitVM } from "./UnitsView";
import { sizeKey, sizeOf } from "./imageSize";
import { toTitleCaseName } from "@/lib/textCase";

/* Developer-agnostic feed adapters → one canonical ProjectVM the preview page
   renders. Each adapter maps a raw feed (Island Blue XML, Qubehub API, …) to the
   same shape. Extra fields (stage/completion/energy/area/price-range/heroVideo)
   are populated only when the feed provides them; otherwise left undefined and
   simply not rendered. In production the "otherwise" becomes an admin field. */

export type ProjectVM = {
  id: string; dev: string; publicName: string; developerName: string; developer: string;
  location: string; district: string; town?: string; area: string; status: string; category?: string;
  stage?: string; completion?: string; energy?: string; // extra features (feed-driven)
  priceFrom?: number | null; priceTo?: number | null; currency?: string;
  description: string; gallery: string[]; plans: string[]; renders: string[];
  amenities?: string[]; // project-level features/benefits (feed) — else unit features
  extraFacts?: { label: string; value: string }[]; // extra development specs for the facts panel
  heroVideo?: string; // looping hero video (admin-uploaded in prod)
  vatApplies?: boolean | null; // admin override only — null/undefined = unknown, don't show "+VAT"
  center: { lat: number; lng: number } | null; units: UnitVM[];
  // Auto-computed (haversine), DB pipeline only — see src/lib/developmentDistances.ts.
  // undefined/null for live-feed-rendered projects (no DB row yet to read it from).
  distances?: Record<string, number> | null;
};

// ---------- shared helpers ----------
const parseXml = (xml: string) => parseStringPromise(xml, { explicitArray: false, trim: true, explicitRoot: true });
// In-memory cache of the fetched + parsed feed, shared across requests and across
// projects of the same feed — avoids re-downloading/re-parsing multi-MB XML on
// every page load (Island Blue 1.9 MB, BBF 3.6 MB). In prod this becomes a 24h sync.
const feedCache = new Map<string, { at: number; data: any }>();
const FEED_TTL = 5 * 60 * 1000;
async function cachedParse(url: string, headers?: Record<string, string>): Promise<any> {
  const hit = feedCache.get(url);
  if (hit && Date.now() - hit.at < FEED_TTL) return hit.data;
  const data = await parseXml(await fetch(url, { headers, cache: "no-store" }).then((r) => r.text()));
  feedCache.set(url, { at: Date.now(), data });
  return data;
}
const arr = <T,>(x: T | T[] | undefined | null): T[] => (x == null ? [] : ([] as T[]).concat(x as any));
const secure = (u: string) => u.replace(/^http:\/\//i, "https://");
const txt = (v: any): string => (v == null ? "" : typeof v === "object" ? String(v._ ?? v["#text"] ?? v.cdata ?? "") : String(v));
const toNum = (v: any): number | null => {
  const n = Number(String(txt(v)).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
// feeds ship literal "null"/"0"/empty for missing fields — treat those as absent
const clean = (v: any): string => { const s = txt(v).trim(); return s && s.toLowerCase() !== "null" ? s : ""; };
// qubehub (bbf/inex) project names sometimes arrive with a stray leading
// ":" (e.g. ":balance") — a pipeline artifact on the provider's side, never
// part of the real name (confirmed: never appears on their own site's
// titles/URLs). Strips it so it can't leak into new projects going forward.
export const stripLeadingColon = (s: string): string => s.replace(/^:\s*/, "");
const areaM2 = (v: any): string => { const n = toNum(v); return n ? `${n}\u00A0m²` : ""; }; // nbsp keeps "105 m²" on one line
// Sub-regions of the coarse longitude band below, checked FIRST because the
// band alone cannot separate them: Polis Chrysochous sits at roughly the same
// longitude as Paphos city but 40 km north, and Kouklia straddles the 32.6
// Paphos/Limassol boundary (which is exactly why Villa Infinity and Ridge
// Residences, both in Venus Rock, were labelled Limassol).
// The two Polis boxes are bounded on the east by their longitude caps, which is
// what keeps Nicosia, Morphou and Kyrenia out; Kouklia is bounded instead by
// its latitude range, all three of those lying far north of 34.75.
// Validated against all 244 developments: 10 geo matches (4 Polis, 6 Kouklia),
// no false positives. Two further affected rows, Grigio Court and Trinity
// Residences, carry no coordinates in the feed and are classified by text here.
// MIRRORED in scripts/backfill-development-districts.mjs — change both.
// See docs/DISTRICTS-POLIS-KOUKLIA.md.
const SUB_REGIONS = [
  // Polis Chrysochous: Chrysochou bay plus the Tillyria strip (Pomos →
  // Pachyammos → Kato Pyrgos), which runs further east as the coast turns.
  // One box, not two: once the latitude floor moved to 35.0 (below) both
  // halves shared the same band, so they merged.
  //   lngMax 32.75 keeps Morphou (32.99) and all of Kyrenia outside, while
  //     still admitting Kato Pyrgos at ~32.69 — without which a
  //     coordinate-bearing row there would be labelled Limassol by the coarse
  //     band, contradicting the `kato pyrgos` entry in the text rule. (The box
  //     does not make that token reachable — geo short-circuits the text
  //     fallback whenever coordinates exist — it makes the geo answer agree
  //     with the token instead of contradicting it.)
  //   latMin 35.0 keeps Drouseia (34.964) and Lara Bay (34.956) in Paphos,
  //     where they belong. Raised from 34.95 in the Task 3 review; our
  //     northernmost Polis row sits at 35.0245, so the margin is 0.024.
  { name: "Polis", latMin: 35.0, latMax: 36.0, lngMin: 32.0, lngMax: 32.75 },
  // Kouklia / Venus Rock. lngMax lowered from 32.7 to 32.65 in the Task 3
  // review: Pissouri Bay (34.660/32.693) is a real Limassol property market
  // and sat inside the old box. Our easternmost Kouklia row is at 32.6136, so
  // the margin is 0.036 on our side and 0.043 to Pissouri.
  { name: "Kouklia", latMin: 34.65, latMax: 34.75, lngMin: 32.55, lngMax: 32.65 },
];
const districtFor = (center?: { lat: number; lng: number } | null): string => {
  if (!center) return "";
  const { lat, lng } = center;
  for (const r of SUB_REGIONS)
    if (lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax) return r.name;
  return lng < 32.6 ? "Paphos" : lng < 33.4 ? "Limassol" : "Larnaca";
};
// Fallback for projects with no coordinates at all (some Aristo units carry no
// Latitude/Longitude) — match the feed's own area/town text against known towns
// per district, so district isn't silently blank just because geo is missing.
// Order is load-bearing: districtFromText returns on FIRST match, so Polis and
// Kouklia must precede Paphos, and their town names were removed from the
// Paphos regex (it previously listed polis/latchi/latsi/venus rock as Paphos
// towns). "kato pyrgos" sits in Polis ahead of Limassol's "pyrgos".
const DISTRICT_TOWNS: Record<string, RegExp> = {
  Polis: /\bpolis\b|prodromi|latchi|\blatsi\b|neo chorio|argaka|pomos|kato pyrgos|chrysochou/i,
  Kouklia: /kouklia|venus rock|secret valley|aphrodite hills|petra tou romiou/i,
  Paphos: /paphos|pafos|chloraka|peyia|pegeia|coral bay|geroskipou|yeroskipou|anavargos|emba|empa|konia|tala|mesogi|mesoyi|kissonerga|tombs of the kings/i,
  Limassol: /limassol|lemesos|agios athanasios|agia fyla|germasogeia|agios nikolaos|mesa geitonia|polemidia|katholiki|tsiflikoudia|petrou kai pavlou|agios tychonas|parekklisia|erimi|pyrgos/i,
  Larnaca: /larnaca|larnaka|oroklini|pyla|livadia|dhekelia|aradippou/i,
  Nicosia: /nicosia|lefkosia|strovolos|engomi|aglantzia/i,
};
const districtFromText = (s: string): string => {
  for (const [district, re] of Object.entries(DISTRICT_TOWNS)) if (re.test(s)) return district;
  return "";
};
const placeLabel = (place: string, district: string) => {
  const p = (place || "").trim();
  if (!district) return p;
  if (!p) return district;
  return new RegExp(district, "i").test(p) ? p : `${district} · ${p}`;
};
// join location levels (District · Town · Area), dropping empties + case-insensitive dupes
const joinLoc = (...parts: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = (raw || "").trim();
    if (p && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); out.push(p); }
  }
  return out.join(" · ");
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anonymize = (text: string, dev: string, alias: string) => {
  if (!text || !dev || dev === alias) return text;
  let t = text.replace(new RegExp(escapeRe(dev), "gi"), alias);
  const first = dev.split(/\s+/)[0];
  // skip the first-word pass when the alias already contains it, else we'd
  // double it (e.g. dev "cirvis", alias "Cirvis Residences" → "…Residences Residences")
  if (first && first.length > 3 && !new RegExp(`\\b${escapeRe(first)}\\b`, "i").test(alias))
    t = t.replace(new RegExp(`\\b${escapeRe(first)}\\b`, "gi"), alias);
  return t;
};
// feeds truncate previews with a trailing "…"; end on a clean sentence instead
const tidyDesc = (s: string) => s.trim().replace(/,\s*\S+\s*(\.{3,}|…)\s*$/, ".").replace(/\s*(\.{3,}|…)\s*$/, ".");
// A feed may ship small/medium/large of the same image. Group the variants and
// return ONE url per image at the requested size — "medium" is the page-load
// default (grids/cards/thumbnails); the hero main image and lightbox upgrade to
// "large" on demand via atSize(). Single-size feeds (Island Blue) pass through.
const sizedImages = (imgs: string[], prefer: "small" | "medium" | "large" = "medium") => {
  const groups = new Map<string, Record<string, string>>();
  for (const raw of imgs) {
    const u = secure(raw);
    const key = sizeKey(u);
    const size = sizeOf(u);
    (groups.get(key) ?? groups.set(key, {}).get(key)!)[size] = u;
  }
  return Array.from(groups.values()).map((g) => g[prefer] ?? g.large ?? g.medium ?? g.small ?? g.single ?? Object.values(g)[0]).filter(Boolean);
};
const validDate = (s: string) => { const y = new Date(s).getFullYear(); return Number.isFinite(y) && y > 2000 && y < 2100; };
const fmtCompletion = (s: string) => { if (!validDate(s)) return ""; const d = new Date(s); return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`; };

// ---------- demo overrides (in prod: admin fields per project) ----------
type Ov = { name?: string; area?: string; mainImage?: string; heroVideo?: string };
const OVERRIDES: Record<string, Ov> = {
  "island-blue:76": { name: "Design City Residences", area: "Universal", mainImage: "https://portal.islandbluecyprus.com/projects/project_76/artist_impressions/8bebe402bceee965dae5b25f88305daddd3b73a0.jpg" },
  "inex:1": { name: "Morea Residences", mainImage: "https://qubehub.fra1.digitaloceanspaces.com/inex/project_images/1/68c7c3bed23fdc28ea47a753_07_medium.avif" }, // area comes from the feed (Coral Bay)
  "bbf:36": { name: "Flow Residences", area: "Agios Nicolaos", mainImage: "https://qubehub.fra1.digitaloceanspaces.com/bbf/images/projects/MEDIUM_0f5b9660-485b-407f-ae74-500d90fc5cc4.jpg" },
  "aristo:Pelagos Beachfront Villas": { name: "Azure Beachfront Villas", area: "Chloraka" },
  "pafilia:Elysia Blu": { name: "Elysia Blu Residences", area: "Kato Paphos" },
  "domenica:cirvis": { name: "Cirvis Residences" },

  // bbf feed data-quality fix (2026-07-31): these 35 arrive with a stray
  // leading ":" AND all-lowercase (e.g. ":balance") — confirmed via BBF's
  // own site that neither is their real formal name (their <title> tags/
  // URLs are lowercase-no-colon too, but our own catalogue's convention is
  // Title Case, so normalized to that here rather than adopted verbatim).
  // stripLeadingColon() above already handles the ":" for every bbf/inex
  // project including future ones; these entries fix the capitalization,
  // which can't be done mechanically without risking words like "of"/"dei".
  "bbf:72": { name: "Balance" },
  "bbf:7": { name: "Berengaria" },
  "bbf:47": { name: "Blackpine" },
  "bbf:26": { name: "Capri House" },
  "bbf:19": { name: "Cypress Grove" },
  "bbf:126": { name: "Dream Tower" },
  "bbf:32": { name: "Eden Bay" },
  "bbf:68": { name: "Eden Coast" }, // feed also has a stray Cyrillic "с" in the raw name; this override sidesteps it entirely
  "bbf:12": { name: "Eden Roc Residence Block D" },
  "bbf:18": { name: "Evolution Tower" },
  "bbf:4": { name: "Force" },
  "bbf:57": { name: "Forma" },
  "bbf:59": { name: "Glow" },
  "bbf:127": { name: "Glow 2" },
  "bbf:44": { name: "Grand Valley Homes" },
  "bbf:6": { name: "Gravity" },
  "bbf:5": { name: "Heart" },
  "bbf:11": { name: "Hide" },
  "bbf:55": { name: "Land of Tomorrow" }, // lowercase "of" is correct
  "bbf:125": { name: "Legacy" }, // delisted from the live feed as of 2026-07-31 — kept in case bbf relists it; see DB backfill for the published row meanwhile
  "bbf:24": { name: "Life" },
  "bbf:69": { name: "Montville" },
  "bbf:43": { name: "Nest" },
  "bbf:48": { name: "Ridge" },
  "bbf:25": { name: "Rise" },
  "bbf:35": { name: "Rosa dei Venti" }, // lowercase "dei" is correct
  "bbf:124": { name: "Ruby Project" }, // "Project" is part of BBF's own name (bbf.com/en/projects/ruby-project/), not a generic suffix
  "bbf:21": { name: "Salt" }, // delisted from the live feed as of 2026-07-31 — kept in case bbf relists it; see DB backfill for the published row meanwhile
  "bbf:2": { name: "Sense" },
  "bbf:28": { name: "Sky Tower" },
  "bbf:30": { name: "Spirit" },
  "bbf:3": { name: "Synergy" },
  "bbf:63": { name: "Upside" },
  "bbf:27": { name: "Verde" },
  "bbf:13": { name: "Vision" },

  // Same cleanup, domenica-sourced projects whose feed `name` is a raw slug
  // string instead of a real name (e.g. "amelia-luxury-apartments-paphos-
  // city-centre"). Currently masked on-site by an admin `alias` override,
  // but the raw value still leaks into paths that read publicName directly
  // (see resolveIdentifiedProject() in crm/compose/generate.ts).
  "domenica:amelia-luxury-apartments-paphos-city-centre": { name: "Amelia Luxury Apartments" },
  "domenica:apartments-in-paphos-eniko-mare": { name: "Eniko Mare" },
  "domenica:villas-for-sale-kissonerga-lyra": { name: "Lyra" },
  "domenica:villas-for-sale-kissonerga": { name: "Lyra B" },
  "domenica:villas-for-sale-tala-montes": { name: "Montes" },
  "domenica:new-apartments-paphos-thea": { name: "Thea" },
  "domenica:uptown-luxury-villas-in-tremithousa-paphos": { name: "Uptown Villas" },
  "domenica:villas-for-sale-in-paphos-virgo": { name: "Virgo" },

  // Medousa's new live XML feed (2026-08-03) ships generic project names —
  // 4 of the 12 are literally "Apartments in Paphos", which would collide
  // on slug. Real names come from Medousa's own project report, not
  // guessed: matched to these project refs via a 273/273 exact match on
  // unit ids between the feed and that report (every one of this
  // developer's units accounted for, 100% per project) — the highest-
  // confidence source available, not a name/slug heuristic. Keyed by the
  // project's own `ref` attribute (permanent), replacing the old file-
  // based adapter's "medousa:<raw Name text>" keys entirely — those never
  // match anything in this feed's id scheme and are gone, not migrated.
  "medousa:PRJ-10034": { name: "Cypress Park Living" },
  "medousa:PRJ-11601": { name: "Panorama Apartments" },
  "medousa:PRJ-25735": { name: "MEDOUSA RESALES" },
  "medousa:PRJ-26010": { name: "Infinity" },
  "medousa:PRJ-28135": { name: "Golden Hills" },
  "medousa:PRJ-29060": { name: "Business Centre (MBC)" },
  "medousa:PRJ-29921": { name: "Aurelia Homes" },
  "medousa:PRJ-29943": { name: "Marelia Valley" },
  "medousa:PRJ-30014": { name: "Royal Horizon" },
  "medousa:PRJ-30561": { name: "Michelle Park" },
  "medousa:PRJ-30622": { name: "Amore Hills" },
  "medousa:PRJ-31439": { name: "Azure Living" },
};

// ==================================================================
// Mito (Qobrix). Kyero v3, but the properties are siblings of <kyero> under
// <root> rather than children of it — squareOne's `kyero.property` path does not
// reach them.
// ==================================================================
const MITO_URL = "https://mito-invest.eu1.qobrix.com/api/v2/feeds/7062fe516e5e70b7e38af8207894f5590f9a2c53048626a7dbd116ec508ae809";
// Two properties belong to the same project when they are within this distance
// OR share a description. Measured on the live feed 2026-08-28: distances inside
// a project run 0–9 m, there is a single 61 m case, and the next pair is over
// 400 m away — so any value from 100 to 400 yields the same four projects. 150
// sits in the middle of that plateau rather than on either edge of it.
const MITO_SAME_PROJECT_M = 150;

// ==================================================================
// Island Blue (two XML feeds: projects + units, linked by ParentProject)
// ==================================================================
const IB_PROJECTS = "https://portal.islandbluecyprus.com/v1/api/xml/projects";
const IB_UNITS = "https://portal.islandbluecyprus.com/v1/api/xml/units";

async function islandBlue(id = "76"): Promise<ProjectVM | null> {
  const [pData, uData] = await Promise.all([cachedParse(IB_PROJECTS), cachedParse(IB_UNITS)]);
  const projects = arr(pData?.Projects?.Project);
  const allUnits = arr(uData?.Properties?.Property);
  const project = projects.find((p: any) => txt(p.Id) === id);
  if (!project) return null;
  const rawUnits = allUnits.filter((u: any) => txt(u.ParentProject) === id);

  const units: UnitVM[] = rawUnits.map((u) => {
    const attrs = arr(u?.Attributes?.Attribute).map((a: any) => ({ name: txt(a.Name), value: txt(a.Value) })).filter((a) => a.name);
    // Each <Feature> carries its own Yes/No <Value> — a "No" (e.g. "BBQ Area: No")
    // was being shown as if the unit HAD it, since only the Name was ever read.
    const features = arr(u?.Features?.Feature)
      .filter((f: any) => typeof f !== "object" || /^\s*yes\s*$/i.test(txt(f.Value)))
      .map((f: any) => txt(f.Name ?? f)).filter(Boolean);
    // Location per unit (e.g. "Emba") — the feed also gives it, distinct from the
    // project's own Location; useful context when it differs (corner/sea-facing plots).
    const unitLocation = clean(u.Location);
    if (unitLocation) attrs.push({ name: "Location", value: unitLocation });
    const getAttr = (re: RegExp) => attrs.find((a) => re.test(a.name.toLowerCase()))?.value ?? "";
    const st = txt(u.Status).toLowerCase();
    const c = txt(u.Coordinates).split(",").map((s) => Number(s.trim()));
    return {
      ref: txt(u.ReferenceNo), name: txt(u.Name),
      label: `Nr. ${txt(u.Name).replace(/^.*?-\s*/, "") || txt(u.ReferenceNo) || txt(u.Name)}`,
      type: txt(u.PropertyType),
      status: st.includes("sold") ? "sold" : st.includes("reserv") ? "reserved" : "available",
      statusLabel: txt(u.Status), price: toNum(u?.Price?.Value), currency: txt(u?.Price?.Currency) || "EUR",
      beds: getAttr(/bedroom/), baths: getAttr(/bathroom/),
      // "Total Built Area" is Covered Internal Area + Covered Veranda already
      // summed (confirmed against live feed data, e.g. 147.9 = 132.94 + 14.96,
      // true for all 220 units) — areaBuilt must be the pure interior figure
      // so Covered Area (= areaBuilt + areaVeranda, computed at display time)
      // doesn't double-count the veranda. 2026-07-26.
      areaBuilt: getAttr(/covered internal|internal area/),
      areaPlot: getAttr(/plot area|plot size/), areaVeranda: getAttr(/covered veranda/), floor: getAttr(/floor|level/),
      attrs, features,
      photos: arr(u?.Photos?.Photo).map(txt).filter(Boolean).map(secure),
      plans: arr(u?.FloorPlans?.FloorPlan).map(txt).filter(Boolean).map(secure),
      coords: c.length === 2 && c.every((n) => Number.isFinite(n)) ? { lat: c[0], lng: c[1] } : null,
      description: txt(u.DescriptionEnglish),
    };
  });
  const center = units.find((u) => u.coords)?.coords ?? null;
  const ov = OVERRIDES[`island-blue:${id}`] ?? {};
  const developerName = toTitleCaseName(txt(project.Name));
  const publicName = ov.name ?? developerName;
  const renders = arr(project?.ArtistImpressions?.ArtistImpression).map(txt).filter(Boolean).map(secure);
  const photos = arr(project?.Photos?.Photo).map(txt).filter(Boolean).map(secure);
  const rawGallery = [...renders, ...photos];
  const main = ov.mainImage ? secure(ov.mainImage) : null;
  const gallery = main ? [main, ...rawGallery.filter((u) => u !== main)] : rawGallery;
  const ibArea = ov.area ?? txt(project.Location);
  const ibDistrict = districtFor(center) || districtFromText(ibArea);
  return {
    id, dev: "island-blue", publicName, developerName, developer: "Island Blue",
    area: ibArea, district: ibDistrict, town: "",
    location: joinLoc(ibDistrict, ibArea),
    status: txt(project.Status),
    description: anonymize(txt(project.DescriptionEnglish), developerName, publicName),
    gallery, plans: arr(project?.FloorPlans?.FloorPlan).map(txt).filter(Boolean).map(secure), renders,
    heroVideo: ov.heroVideo, center, units,
    priceFrom: units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b)[0] ?? null,
  };
}

// ==================================================================
// Qubehub API (INEX / BBF): realty-feed → projects → units (nested)
// ==================================================================
const QUBE_URL: Record<string, string> = {
  inex: "https://inex.in.qubehub.ai/api/agent/v3/feed",
  bbf: "https://bbf.in.qubehub.ai/api/agent/v3/feed",
};
const STAGE_LABEL: Record<string, string> = { planned: "Off-plan", "under construction": "Under construction", finished: "Completed", ready: "Completed" };

async function qubehub(dev: string, id = "1"): Promise<ProjectVM | null> {
  const url = QUBE_URL[dev];
  const key = process.env[`DEV_FEED_KEY_${dev.toUpperCase()}`] ?? ""; // read at call time
  if (!url || !key) return null;
  // Qubehub: <projects> repeats (each = a project); <units> repeats inside each.
  // Must be a real id match — no projects[0] fallback: a requested id that's
  // been delisted upstream (e.g. sold, removed from the feed) has to resolve
  // to "not found", not silently substitute an unrelated project. Confirmed
  // live 2026-07-29: BBF removed a sold project's id from its feed, and this
  // fallback overwrote that development's category/price/units with
  // whichever unrelated project happened to be first in the feed array.
  const projects = arr((await cachedParse(url, { "x-api-key": key }))?.["realty-feed"]?.projects);
  const project = projects.find((p: any) => txt(p.id) === id);
  if (!project) return null;

  const units: UnitVM[] = arr(project?.units).map((u: any) => {
    const a = u.areas ?? {};
    const attrs = [
      ["Total area", areaM2(a.total)], ["Sellable", areaM2(a.sellable)],
      ["Indoor", areaM2(a.indoor)], ["Covered veranda", areaM2(a.covered_veranda)],
      ["Open veranda", areaM2(a.open_veranda)], ["Floor", clean(u.floor)], ["Block", clean(u.block)],
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    const beds = clean(u.bedrooms), baths = clean(u.bathrooms);
    return {
      ref: clean(u.unit_number) || txt(u.id), name: clean(u.name) || clean(u.unit_number),
      label: (clean(u.block) ? `Block ${clean(u.block)} · ` : "") + `Nr. ${clean(u.unit_number) || txt(u.id)}`,
      type: clean(u.type),
      status: "available", statusLabel: "Available",
      price: toNum(u?.prices?.price), currency: txt(u?.prices?.currency) || "EUR",
      beds: beds !== "0" ? beds : "", baths: baths !== "0" ? baths : "",
      areaBuilt: areaM2(a.total), areaPlot: "", areaVeranda: areaM2(a.covered_veranda),
      floor: clean(u.floor), attrs, features: [],
      photos: sizedImages(arr(u.images).map(txt).filter(Boolean)),
      plans: [], coords: null, description: "",
    };
  });

  const loc = project.location ?? {};
  const lat = Number(txt(loc.latitude)), lng = Number(txt(loc.longitude));
  const center = Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null;
  const ov = OVERRIDES[`${dev}:${id}`] ?? {};
  const developerName = toTitleCaseName(stripLeadingColon(txt(project.name)));
  const publicName = ov.name ?? developerName;
  const stage = STAGE_LABEL[txt(project.stage).toLowerCase()] ?? txt(project.stage);
  // location levels: District (from coords) · Town (city, if distinct) · Area
  const district = districtFor(center) || districtFromText(clean(loc.city)) || districtFromText(clean(loc.area)) || clean(loc.city);
  const areaName = ov.area ?? clean(loc.area);
  const cityTown = clean(loc.city);
  const town = cityTown && cityTown.toLowerCase() !== district.toLowerCase() && cityTown.toLowerCase() !== areaName.toLowerCase() ? cityTown : "";
  const galleryAll = sizedImages(arr(project.images).map(txt).filter(Boolean));
  const main = ov.mainImage ? secure(ov.mainImage) : null; // admin-selected hero image, shown first
  const gallery = main ? [main, ...galleryAll.filter((u) => u !== main)] : galleryAll;
  const amenities = arr(project.benefits).map(txt).filter(Boolean);
  // AVAILABLE units only. This feeds Development.priceFrom/priceTo, which
  // resolveDevelopmentPrice() treats as the AUTHORITATIVE project price and
  // prefers over any unit-derived figure — so a sold unit priced below the
  // cheapest available one silently becomes the advertised "from" price.
  // Observed on Royal Horizon: two sold villas at €550,000 set the headline
  // while the cheapest villa a buyer could actually get was €950,000, and the
  // SEO description repeated the same €550,000 through {priceFrom}.
  // Leaving this null when nothing is available is deliberate: resolveDevelopment-
  // Price() then applies its own documented sold-out fallback ("sold from …"),
  // which is the single place that semantics belongs. Matches what the aristo
  // adapter already did.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  return {
    id, dev, publicName, developerName, developer: dev.toUpperCase(),
    // area from the feed (e.g. "Coral Bay"); district from coordinates
    area: areaName, district, town, location: joinLoc(district, town, areaName),
    status: stage, stage, category: clean(project.category), completion: fmtCompletion(txt(project.completion_date)),
    description: anonymize(txt(project.description), developerName, publicName),
    gallery, plans: [], renders: [], amenities, heroVideo: ov.heroVideo, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: units[0]?.currency || "EUR",
  };
}

// ==================================================================
// Aristo (single XML: flat list of units, grouped by their Project field)
// ==================================================================
const ARISTO_URL = "https://www.aristodevelopers.com/downloads/AristoDevelopersUnits.xml";
const aristoImg = (s: any) => { const u = txt(s); return u.startsWith("//") ? "https:" + u : secure(u); };
const energyGrade = (s: any) => (txt(s).match(/\(([A-G][+]?)\)/i)?.[1] ?? "").toUpperCase();
const naClean = (v: any) => { const s = clean(v); return s && s.toUpperCase() !== "N/A" ? s : ""; };

async function aristo(id: string): Promise<ProjectVM | null> {
  const group = arr((await cachedParse(ARISTO_URL))?.xml?.property).filter((u: any) => txt(u.Project) === id);
  if (!group.length) return null;
  const first = group[0];

  const units: UnitVM[] = group.map((u: any) => {
    const st = txt(u.Status).toLowerCase();
    const lat = Number(txt(u.Latitude)), lng = Number(txt(u.Longitude));
    const attrs = [
      ["Covered area", areaM2(u.Total_Covered_Areas)], ["Internal covered", areaM2(u.Internal_Covered_Areas)],
      ["Plot", areaM2(u.Plot_Size)], ["Covered veranda", areaM2(u.Covered_Verandas)],
      ["Uncovered veranda", areaM2(u.Uncovered_Verandas)], ["Covered parking", areaM2(u.Covered_Parking)],
      ["Semi-covered parking", areaM2(u.Semi_Covered_Parking)], ["Uncovered parking", areaM2(u.Uncovered_Parking)],
      ["Storage", areaM2(u.Storage_Size)], ["Swimming pool", /yes/i.test(txt(u.Swimming_Pool)) ? "Yes" : ""],
      ["Floor", naClean(u.Apartment_Floor)], ["Block", naClean(u.Block)], ["Energy rating", energyGrade(u.Energy_Efficient_Content)],
      // Cyprus buyers weigh VAT status heavily (5% reduced rate vs 19% standard) —
      // the feed marks it per unit but it was never surfaced anywhere.
      ["VAT applicable", /yes/i.test(txt(u.VAT)) ? "Yes" : /no/i.test(txt(u.VAT)) ? "No" : ""],
      ["Setting", naClean(u.Location)], // e.g. "Seaside", "City Centre" — a positioning descriptor, not the address
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    return {
      ref: txt(u.Unit_Number) || txt(u.Property_Reference), name: txt(u.Title),
      label: `Nr. ${naClean(u.Unit_Number) || txt(u.Title).replace(/^.*?-\s*/, "")}`,
      type: txt(u.Type), status: st.includes("sold") ? "sold" : st.includes("reserv") ? "reserved" : "available",
      statusLabel: txt(u.Status), price: toNum(u.Price), currency: "EUR",
      beds: naClean(u.Bedrooms), baths: naClean(u.Bathrooms),
      // Total_Covered_Areas already includes Covered_Verandas (confirmed
      // against live feed data — equal in every sampled unit, e.g.
      // 154.54 = 128.90 + Covered_Verandas + other covered extras) —
      // areaBuilt needs the pure interior figure so Covered Area (computed
      // at display time as areaBuilt + areaVeranda) doesn't double-count.
      // 269/288 units carry Internal_Covered_Areas; the remaining 19 have
      // neither field populated in either direction, so this is not a
      // regression. 2026-07-26.
      areaBuilt: areaM2(u.Internal_Covered_Areas), areaPlot: areaM2(u.Plot_Size), areaVeranda: areaM2(u.Covered_Verandas),
      floor: naClean(u.Apartment_Floor), attrs, features: [],
      photos: arr(u?.gallery?.image).map(aristoImg).filter(Boolean), plans: [],
      coords: Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null,
      description: txt(u.Description),
    };
  });

  const center = units.find((u) => u.coords)?.coords ?? null;
  const ov = OVERRIDES[`aristo:${id}`] ?? {};
  const developerName = toTitleCaseName(id), publicName = ov.name ?? developerName;
  const area = ov.area ?? txt(first.Area);
  const district = districtFor(center) || districtFromText(area) || districtFromText(naClean(first.Location));
  const stage = txt(first.Construction_Stage), energy = energyGrade(first.Energy_Efficient_Content);
  const gallery0 = Array.from(new Set(group.flatMap((u: any) => arr(u?.gallery?.image).map(aristoImg)))).filter(Boolean);
  const main = ov.mainImage ? secure(ov.mainImage) : null;
  const gallery = main ? [main, ...gallery0.filter((u) => u !== main)] : gallery0;
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  // Aristo has no benefits list — derive amenity chips from its structured fields
  const amenities = [
    group.some((u: any) => /yes/i.test(txt(u.Swimming_Pool))) && "Swimming pool",
    group.some((u: any) => toNum(u.Covered_Verandas) || toNum(u.Semi_Covered_Verandas) || toNum(u.Uncovered_Verandas)) && "Private verandas",
    group.some((u: any) => toNum(u.Covered_Parking) || toNum(u.Semi_Covered_Parking) || toNum(u.Uncovered_Parking)) && "Private parking",
    group.some((u: any) => toNum(u.Storage_Size)) && "Storage room",
    group.some((u: any) => clean(u.Yard)) && "Private garden",
    energy && `Energy class ${energy}`,
  ].filter(Boolean) as string[];

  return {
    id, dev: "aristo", publicName, developerName, developer: "Aristo Developers",
    area, district, town: "", location: joinLoc(district, area),
    status: stage, stage, category: "Residential", completion: "", energy,
    description: anonymize(txt(first.Description), developerName, publicName),
    gallery, plans: [], renders: [], amenities, heroVideo: ov.heroVideo, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: "EUR",
  };
}

// ==================================================================
// xml2u feed (Pafilia, Domenica): flat <Property> listings grouped into a
// development; each Property is a config/type (no per-unit availability).
// ==================================================================
const XML2U: Record<string, { url: string; developer: string; groupKey: (p: any) => string }> = {
  pafilia: {
    url: "https://www.xml2u.com/Xml/Pafilia%20Property%20Developers_3814/6768_Default.xml",
    developer: "Pafilia", groupKey: (p) => txt(p?.Address?.number),
  },
  domenica: {
    url: "https://www.xml2u.com/Xml/Hadjidemosthenous%20Constructions%20Ltd_3655/6333_Default.xml",
    developer: "Domenica", groupKey: (p) => txt(p?.link?.dataSource).match(/\/portfolio\/([^/?#]+)/i)?.[1] ?? "",
  },
};

// xml2u ships two fields as nested objects instead of flat text — a shape
// the generic txt()/clean()/toNum() helpers above don't unwrap (they only
// handle xml2js's own attribute-object shape via _/#text/cdata). FloorSize/
// PlotSize are { floorSize, floorSizeUnits } / { plotSize, plotSizeUnits };
// passing the whole object to areaM2() silently evaluated to "" and the
// area was lost entirely — fixed 2026-07-26 by reading the inner key.
//
// description is { en: "<p>...</p>" } (HTML, not plain text) — same
// nested-object blindness plus a second problem: the renderer
// (splitDescriptionParagraphs, src/lib/text.ts) expects plain text with
// blank-line paragraph breaks, so raw markup must be converted, not passed
// through (previously this field silently failed to parse too, and the
// truncated shortDescription preview was used instead of the full text).
const htmlToText = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
// { en: "..." } → the "en" text — the only locale ever seen in either feed
// (checked against live Domenica + Pafilia data, 2026-07-26); falls back to
// whichever locale IS present rather than dropping the field if that changes.
const fullDescriptionText = (v: any): string => {
  if (v == null) return "";
  if (typeof v !== "object") return htmlToText(String(v));
  const raw = v.en ?? Object.values(v)[0];
  return raw ? htmlToText(String(raw)) : "";
};
// "A103Cirvis" -> "A103": Price.reference carries the project's own id as a
// case-insensitive suffix for Domenica; Pafilia references (e.g.
// "PA-232-6521") never carry this suffix, so they pass through unchanged —
// confirmed against real data for both, this is deliberate, not a gap.
// projectId is stripped of separators before matching — a multi-word
// project's dataSource slug is hyphenated ("absolute-villas") but its
// reference suffix concatenates the words with no separator at all
// ("N03AbsoluteVillas") — found via real-data testing 2026-07-26, without
// this the suffix would never match and "Villas N03AbsoluteVillas" would
// survive instead of the intended "Villas N03".
const stripProjectSuffix = (ref: string, projectId: string): string => {
  const suffix = (projectId || "").replace(/[^a-z0-9]/gi, "");
  if (!ref || !suffix) return ref;
  return ref.toLowerCase().endsWith(suffix.toLowerCase()) ? ref.slice(0, ref.length - suffix.length).trim() : ref;
};
// Domenica's own Features list carries a per-unit "Status: Sold" / "Status:
// Available For Sale" line; Pafilia's Feature1 is marketing copy, never a
// status line, so this safely no-ops for Pafilia — it only ever matches a
// Feature that literally starts with "Status:".
const unitStatusFrom = (features: any): "available" | "sold" | "reserved" => {
  const line = arr(Object.values(features ?? {})).map(txt).find((f: string) => /^status\s*:/i.test(f));
  if (!line) return "available";
  const v = line.slice(line.indexOf(":") + 1);
  if (/sold/i.test(v)) return "sold";
  if (/reserved/i.test(v)) return "reserved";
  return "available";
};
const unitStatusLabel = (s: "available" | "sold" | "reserved") => (s === "sold" ? "Sold" : s === "reserved" ? "Reserved" : "Available");

async function xml2u(dev: string, id: string): Promise<ProjectVM | null> {
  const cfg = XML2U[dev];
  if (!cfg) return null;
  const props = arr((await cachedParse(cfg.url))?.document?.Clients?.Client?.properties?.Property);
  const group = props.filter((p: any) => cfg.groupKey(p).toLowerCase() === id.toLowerCase());
  if (!group.length) return null;
  const first = group[0];

  const units: UnitVM[] = group.map((p: any) => {
    const d = p.Description ?? {};
    const beds = clean(d.bedrooms) !== "0" ? clean(d.bedrooms) : "";
    const baths = clean(d.fullBathrooms) !== "0" ? clean(d.fullBathrooms) : "";
    const orientation = clean(d.orientation);
    const status = unitStatusFrom(d.Features);
    const attrs = [
      ["Floor area", areaM2(d.FloorSize?.floorSize)], ["Plot", areaM2(d.PlotSize?.plotSize)],
      ["Bedrooms", beds], ["Bathrooms", baths],
      ["En-suites", clean(d.ensuites) !== "0" ? clean(d.ensuites) : ""],
      ["Floors", clean(d.numberOfFloors) !== "0" ? clean(d.numberOfFloors) : ""],
      ["Year built", clean(d.yearBuilt)], ["Orientation", orientation],
      // Real YouTube/Matterport links exist for a good share of Pafilia's units —
      // previously never read at all. UnitsView renders a URL-shaped attrs value
      // as a clickable link rather than raw text.
      ["Video walkthrough", clean(p?.link?.video)], ["Virtual tour", clean(p?.link?.virtualTour)],
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    const propertyType = txt(d.propertyType);
    const refCode = stripProjectSuffix(txt(p?.Price?.reference), id);
    // label mirrors name — like every other adapter (islandBlue/qubehub/aristo),
    // label is the short unique display string. The old "propertyType · X bed"
    // formula gave every same-type unit in a project an identical label. 2026-07-26.
    const unitName = (propertyType && refCode ? `${propertyType} ${refCode}` : "") || clean(d.title) || propertyType;
    return {
      ref: txt(p?.Price?.reference), name: unitName,
      label: unitName,
      type: propertyType, status, statusLabel: unitStatusLabel(status),
      price: toNum(p?.Price?.price), currency: txt(p?.Price?.currency) || "EUR",
      beds, baths, areaBuilt: areaM2(d.FloorSize?.floorSize), areaPlot: areaM2(d.PlotSize?.plotSize), areaVeranda: "",
      floor: clean(d.floorNumber), orientation, attrs, features: [],
      // prefer "large": only affects Domenica's weblium-hosted images, where
      // the feed sometimes lists both a full-size and a smaller derivative
      // of the same photo as separate entries (see imageSize.ts's WEBLIUM_RE
      // comment) — this is what makes the bigger one win instead of the
      // default "medium" tier, which would otherwise pick the smaller one
      // whenever both exist. No effect on Pafilia (this adapter's other
      // source): its images never match any of the three size patterns, so
      // they always fall through the "single" bucket regardless of prefer.
      photos: sizedImages(arr(p?.images?.image).map((e: any) => aristoImg(e?.image)).filter(Boolean), "large"),
      plans: arr(p?.Floorplans?.floorplan).map((e: any) => aristoImg(e?.floorplan)).filter(Boolean),
      coords: null, description: fullDescriptionText(d.description) || clean(d.shortDescription),
    };
  });

  const lat = Number(txt(first?.Address?.latitude)), lng = Number(txt(first?.Address?.longitude));
  const center = Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null;
  const ov = OVERRIDES[`${dev}:${id}`] ?? {};
  const developerName = toTitleCaseName(id), publicName = ov.name ?? developerName;
  const area = ov.area ?? txt(first?.Address?.location);
  const district = districtFor(center) || districtFromText(area) || districtFromText(clean(first?.Address?.region)) || districtFromText(clean(first?.Address?.subRegion));
  const d0 = first.Description ?? {};
  const descText = tidyDesc(fullDescriptionText(d0.description) || clean(d0.shortDescription));
  // EPC/GEC (energy performance / green energy cert) — both always empty
  // across every property in either feed as of 2026-07-26, so this has no
  // visible effect today; wired up so it starts working the moment either
  // feed ever populates it, same "first unit wins" pattern as the rest of
  // this project-level data.
  const energy = clean(first?.EPC) || clean(first?.GEC) || "";
  // Domenica ships a structured "Key: Value" Features list; Pafilia's is a placeholder
  const featMap: Record<string, string> = {};
  arr(Object.values(d0.Features ?? {})).map(txt).forEach((f: string) => {
    const i = f.indexOf(":");
    if (i > 0 && !/coming soon/i.test(f)) featMap[f.slice(0, i).trim().toLowerCase()] = f.slice(i + 1).trim();
  });
  const stage = featMap["construction stage"] || "";
  const amenities = [
    ...([["Swimming pool", d0.swimmingPool], ["Elevator", d0.elevator], ["Balcony", d0.balcony], ["Terrace", d0.terrace], ["Private parking", d0.garages || d0.offRoadParking || d0.carports], ["Fitted kitchen", d0.fittedKitchen]] as [string, any][]).filter(([, v]) => /yes|^\s*[1-9]/i.test(txt(v))).map(([k]) => k),
    /gated/i.test(descText) ? "Gated community" : "",
    clean(d0.orientation) ? `${clean(d0.orientation)} facing` : "",
  ].filter(Boolean) as string[];
  const sizeRange = (featMap["flat size"] || featMap["area"] || "").replace(/\s*sq\.?\s*meters?/i, " m²").trim();
  const extraFacts = [
    (featMap["apartments"] || featMap["units"]) ? { label: "Total units", value: featMap["apartments"] || featMap["units"] } : null,
    sizeRange ? { label: "Unit size", value: sizeRange } : null,
    clean(d0.bedroomRange) && clean(d0.bedroomRange) !== clean(d0.bedrooms) ? { label: "Bedrooms", value: clean(d0.bedroomRange) } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  // prefer "large" — see the matching comment on the unit-photos sizedImages()
  // call above; same reasoning, same no-op on Pafilia.
  const gallery = sizedImages(Array.from(new Set(group.flatMap((p: any) => arr(p?.images?.image).map((e: any) => aristoImg(e?.image))))).filter(Boolean), "large");
  const plans = Array.from(new Set(group.flatMap((p: any) => arr(p?.Floorplans?.floorplan).map((e: any) => aristoImg(e?.floorplan))))).filter(Boolean);
  // AVAILABLE units only. This feeds Development.priceFrom/priceTo, which
  // resolveDevelopmentPrice() treats as the AUTHORITATIVE project price and
  // prefers over any unit-derived figure — so a sold unit priced below the
  // cheapest available one silently becomes the advertised "from" price.
  // Observed on Royal Horizon: two sold villas at €550,000 set the headline
  // while the cheapest villa a buyer could actually get was €950,000, and the
  // SEO description repeated the same €550,000 through {priceFrom}.
  // Leaving this null when nothing is available is deliberate: resolveDevelopment-
  // Price() then applies its own documented sold-out fallback ("sold from …"),
  // which is the single place that semantics belongs. Matches what the aristo
  // adapter already did.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  return {
    id, dev, publicName, developerName, developer: cfg.developer,
    area, district, town: "", location: joinLoc(district, area),
    status: stage || txt(first?.Price?.status) || "Available", stage, category: "Residential",
    completion: (clean(d0.newBuild).toLowerCase() === "yes" || Number(clean(d0.yearBuilt)) >= 2025) && clean(d0.yearBuilt) ? String(clean(d0.yearBuilt)) : "", energy,
    description: anonymize(descText, developerName, publicName),
    gallery, plans, renders: [], amenities, extraFacts, heroVideo: ov.heroVideo, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: units[0]?.currency || "EUR",
  };
}

// ==================================================================
// Medousa Developers (2026-08-03) — live XML feed at agent-portal.cloud,
// replaces the old manually-uploaded "project report" file
// (public/medousa-feed.xml, ProjectsReport > Project > Unit — a completely
// different shape this new feed can't be squeezed into; that file/adapter
// is retired, not reused). New feed root:
//   feed > projects > project[@ref] > properties > property[@ref]
// First medousa feed with a real per-unit status (sold/active/reserved) —
// "active" normalizes to "available" via the same inline pattern Island
// Blue/Aristo already use below; our DB only knows sold/available/reserved,
// "active" must never be written through. "medousa" was added to
// STATUS_SYNC_DEVS (feedSync.ts) accordingly.
// Project names arrive generic ("Apartments in Paphos" ×4, would collide on
// slug) — real names come from Medousa's own project report, matched to
// these project refs via 273/273 unit-id cross-reference; see the OVERRIDES
// block below for the 12 corrections this adapter depends on for readable,
// non-colliding names/slugs.
// ==================================================================
const MEDOUSA_URL = "https://medousa.agent-portal.cloud/api/feed/v7a996A70CWQWgWobsAxCWqB9lB3YVcBgcgQMAc50nk.xml";
// Names and descriptions are ABSENT from the primary feed: <project> is missing
// entirely and every <descriptions><description> is empty (verified 2026-08-22,
// 0/13 names, 0/13 descriptions), so all 13 projects arrive as generic
// "Apartments in Paphos"/"Villas in Paphos" — five of each, colliding on slug —
// with no copy at all. That empty description is also what blocks all 14
// Medousa developments at the publish gate (computePublishGate requires one).
//
// Medousa's portal exposes the SAME 13 projects under a second token that does
// carry both, keyed by identical PRJ- refs. That feed is availability-only
// (112 of 326 units, no floorplans, no unit specs) so it can never replace the
// primary one — it is read here purely as a metadata sidecar: 13/13 names,
// 11/13 descriptions, same refs, same developer account.
const MEDOUSA_META_URL = "https://medousa.agent-portal.cloud/api/feed/4gZq0OKRf37VpuUQcF56_QWFKGFjhfTgx6V3obAl2Ws.xml";

type MedousaMeta = { name: string; description: string };
// Failure here is deliberately non-fatal. This vendor rotates feed tokens
// (four distinct ones seen in a single day), and a dead sidecar must never
// take the primary feed — units, prices, floorplans — down with it. On failure
// names fall back to OVERRIDES and description to "", i.e. exactly the
// behaviour that existed before this sidecar was added.
async function medousaMeta(): Promise<Map<string, MedousaMeta>> {
  const out = new Map<string, MedousaMeta>();
  try {
    for (const p of arr((await cachedParse(MEDOUSA_META_URL))?.feed?.projects?.project)) {
      const r = txt(p?.$?.ref);
      if (r) out.set(r, { name: clean(p.project), description: tidyDesc(clean(arr(p.descriptions?.description)[0])) });
    }
  } catch {
    /* sidecar unavailable — see comment above */
  }
  return out;
}

const MEDOUSA_STAGE_LABEL: Record<string, string> = { off_plan: "Off Plan", under_construction: "Under Construction", completed: "Completed" };
// amenity/feature codes arrive snake_case ("vrf_system", "furniture_package") —
// title-case them for display; the couple of acronyms that'd otherwise read
// oddly ("Vrf System") get a manual fixup.
const MEDOUSA_WORD_FIX: Record<string, string> = { vrf: "VRF" };
const humanizeCode = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w+\b/g, (w) => MEDOUSA_WORD_FIX[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const medousaImages = (media: any, role: string) => sizedImages(arr(media?.image).filter((im: any) => txt(im?.$?.role) === role).map((im: any) => txt(im)));
// Project-level plans (site plan / master plan). This adapter hardcoded
// `plans: []`, so nothing could ever arrive here even if the feed carried it.
// It currently does not: Golden Hills, checked 2026-08-22, ships only
// image role="hero" ×7 and document role="brochure" ×7 at project level — and
// those "brochures" are byte-identical copies of the hero JPEGs (1280×853),
// not PDFs and not site plans. Wired anyway so the moment Medousa starts
// exporting one it lands in the right place instead of being dropped silently.
// Matched on a role CONTAINING "plan" rather than a fixed literal, since the
// exact name they would use (siteplan | site_plan | masterplan | …) is not
// knowable in advance; "hero" cannot match it, and unit floorplans live on the
// property, not here, so they cannot leak in either.
const medousaPlanImages = (media: any) =>
  sizedImages(arr(media?.image).filter((im: any) => /plan/i.test(txt(im?.$?.role))).map((im: any) => txt(im)));

async function medousa(id: string): Promise<ProjectVM | null> {
  const [data, meta] = await Promise.all([cachedParse(MEDOUSA_URL), medousaMeta()]);
  const projects = arr(data?.feed?.projects?.project);
  const project = projects.find((p: any) => txt(p?.$?.ref) === id) ?? projects[0];
  if (!project) return null;
  const ref = txt(project.$?.ref);
  const loc = project.location ?? {};
  const lat = toNum(loc.latitude), lng = toNum(loc.longitude);

  const units: UnitVM[] = arr(project.properties?.property).map((p: any) => {
    const areas = p.areas ?? {};
    const st = clean(p.status).toLowerCase();
    // "active" (the majority status in this feed) falls through to
    // "available" here exactly like every other unmatched value would —
    // deliberate, not a gap: it's the one normalization this adapter must
    // never skip (see file header).
    const status: UnitVM["status"] = st.includes("sold") ? "sold" : st.includes("reserv") ? "reserved" : "available";
    const poolRaw = clean(p["swimming-pool"]);
    const pool = poolRaw ? (/^communal$/i.test(poolRaw) ? "Communal" : poolRaw) : "";
    const vatRate = clean(p.price?.["vat-rate"]);
    const vatElig = clean(p.price?.["vat-eligibility"]);
    const attrs = [
      ["Swimming pool", pool],
      ["Block", clean(p.block)],
      ["VAT", vatElig === "eligible" && vatRate ? `${vatRate}% VAT` : vatElig === "not_eligible" ? "VAT not applicable" : ""],
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    const referenceName = clean(p["reference-name"]);
    const unitRef = txt(p.$?.ref);
    return {
      // reference-name is the display value (renamed freely on Medousa's
      // side over time); ref is the property's own numeric attribute,
      // stable, and what unitRow() in feedSync.ts writes to
      // DevelopmentUnit.feedRef — never swap these two.
      ref: unitRef, name: referenceName, label: referenceName ? `Nr. ${referenceName}` : `Nr. ${unitRef}`,
      type: clean(p.type),
      status, statusLabel: status === "sold" ? "Sold" : status === "reserved" ? "Reserved" : "Available",
      price: toNum(p.price?.amount), currency: "EUR",
      // bedrooms/bathrooms/swimming-pool are absent (not empty) on the 7
      // commercial units — clean()/toNum() already return ""/pool="" for a
      // missing node, so this falls through correctly with no special case.
      beds: clean(p.bedrooms), baths: clean(p.bathrooms),
      // areaM2()/toNum() already treat 0 as absent (toNum: `n > 0` gate) —
      // the 170 non-villa units carrying <plot>0</plot> correctly produce
      // "" here, not "0 m²", with no extra handling needed.
      areaBuilt: areaM2(areas["internal-area"]), areaPlot: areaM2(areas.plot), areaVeranda: areaM2(areas["covered-veranda"]),
      floor: "", attrs, features: arr(p.features?.feature).map((f: any) => humanizeCode(clean(f))).filter(Boolean),
      photos: [], plans: medousaImages(p.media, "floorplan"),
      coords: null, description: "",
    };
  });

  const ov = OVERRIDES[`medousa:${ref}`] ?? {};
  const m = meta.get(ref);
  // OVERRIDES still win: they cover PRJ-29060, which no longer appears in
  // either feed, and they are the fallback if the sidecar token rotates. The
  // other 11 now agree with the sidecar verbatim (checked 2026-08-22), so they
  // are belt-and-braces rather than the only source they used to be. The
  // sidecar additionally supplies two names OVERRIDES never had: "Adonidos
  // Gardens" (PRJ-15357) and "MBC III" (PRJ-31879), which until now rendered
  // as "Apartments In Paphos" and "Mbc Iii".
  const developerName = toTitleCaseName(clean(project.name) || ref);
  const publicName = ov.name ?? m?.name ?? developerName;
  // Geo first, exactly like every other adapter in this file. This one used to
  // take the feed's own district/city verbatim, which meant the Polis/Kouklia
  // sub-regions could never fire for Medousa: the feed answers "Paphos" for
  // everything, so a project in Polis Chrysochous or Venus Rock would have been
  // filed under Paphos with nothing to correct it. The feed values stay on as
  // the fallback for PRJ-25735, which ships <country>CY</country> and nothing
  // else. Verified 2026-08-22 against all 13 live projects: zero classification
  // changes today — this closes a future gap, it does not move existing data.
  const center = lat != null && lng != null ? { lat, lng } : null;
  const district =
    districtFor(center) ||
    districtFromText(clean(loc.district)) ||
    districtFromText(clean(loc.city)) ||
    clean(loc.district) ||
    clean(loc.city) ||
    "";
  const town = clean(loc.city);
  const area = ov.area ?? "";
  // completion/status (off_plan|under_construction|completed) is present on all
  // 13 projects and is a CONSTRUCTION STAGE, so it belongs in `stage` — not in
  // `completion`, which is the completion date. It used to be written to
  // `completion` as a fallback, which left `stage` empty and produced two wrong
  // rows on the project page: resolveStageLabel() fell through to `status` and
  // printed "Available" as the construction stage, while the real stage showed
  // up under the "Completion" label. Empty `stage` also failed the publish gate
  // for all 14 developments. expected-date is populated on only 1 of 13, so
  // `completion` is now simply blank when there is no date — the stage row
  // carries the information instead.
  const expectedDate = clean(project.completion?.["expected-date"]);
  const stage = MEDOUSA_STAGE_LABEL[clean(project.completion?.status).toLowerCase()] || "";
  const completion = expectedDate && validDate(expectedDate) ? fmtCompletion(expectedDate) : "";
  const amenities = arr(project.amenities?.amenity).map((a: any) => humanizeCode(clean(a))).filter(Boolean);
  // AVAILABLE units only. This feeds Development.priceFrom/priceTo, which
  // resolveDevelopmentPrice() treats as the AUTHORITATIVE project price and
  // prefers over any unit-derived figure — so a sold unit priced below the
  // cheapest available one silently becomes the advertised "from" price.
  // Observed on Royal Horizon: two sold villas at €550,000 set the headline
  // while the cheapest villa a buyer could actually get was €950,000, and the
  // SEO description repeated the same €550,000 through {priceFrom}.
  // Leaving this null when nothing is available is deliberate: resolveDevelopment-
  // Price() then applies its own documented sold-out fallback ("sold from …"),
  // which is the single place that semantics belongs. Matches what the aristo
  // adapter already did.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);

  return {
    id: ref, dev: "medousa", publicName, developerName, developer: "Medousa Developers",
    area, district, town, location: joinLoc(district, town, area),
    status: "Available", category: "Residential", stage, completion, energy: "",
    description: m?.description ?? "",
    // PRJ-25735 ("Medousa Resales") ships <location><country>CY</country></location>
    // only — no city/lat/lng at all. lat/lng end up null (no map pin, by
    // design, not an error); district/town/area all resolve to "" the same
    // way any other project with a sparse location already would.
    gallery: ov.mainImage ? [secure(ov.mainImage)] : medousaImages(project.media, "hero"), plans: medousaPlanImages(project.media), renders: [],
    amenities, heroVideo: ov.heroVideo,
    center,
    units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: "EUR",
  };
}

// AGG Luxury Homes had a one-time Cloudflare-scrape fixture here
// (2026-07-12 -> 2026-08-13) — retired 2026-08-13, AGG is now maintained
// manually (dev: "manual") like any other hand-entered development. See
// DEPLOYMENT.md / git history around 2026-08-13 for the removal.

// ==================================================================
// Square One (Kyero-standard XML): flat <property> list, one per unit, with
// NO explicit project field — grouped by the project slug embedded in each
// unit's own <url> (".../projects/neon"). The project name/description is
// duplicated verbatim across every unit of the same project as a "[NAME]"
// bracket-prefixed <desc>, same shape Aristo/xml2u use for their own feeds.
// ==================================================================
const SQUAREONE_URL = "https://admin.squareone.com.cy/api/project/projects/xml/";
const projectSlugFrom = (url: any) => txt(url).match(/projects\/([^/?#]+)/i)?.[1] ?? "";

async function squareOne(id: string): Promise<ProjectVM | null> {
  const all = arr((await cachedParse(SQUAREONE_URL))?.kyero?.property);
  const group = all.filter((p: any) => projectSlugFrom(p.url) === id);
  if (!group.length) return null;
  const first = group[0];

  const units: UnitVM[] = group.map((u: any) => {
    const lat = Number(txt(u.location_lat)), lng = Number(txt(u.location_lng));
    const feats = arr(u?.features?.feature).map(txt);
    const parking = feats.find((f) => /^parking/i.test(f))?.split(":")[1]?.trim() ?? "";
    const hasPool = txt(u.pool) === "1" || feats.some((f) => /swimming pool/i.test(f));
    const attrs = [["Parking spaces", parking]].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    return {
      ref: txt(u.ref) || txt(u.id), name: `Nr. ${txt(u.ref) || txt(u.id)}`, label: `Nr. ${txt(u.ref) || txt(u.id)}`,
      type: txt(u.type), status: "available", statusLabel: "Available",
      price: toNum(u.price), currency: txt(u.currency) || "EUR",
      beds: clean(u.beds) !== "0" ? clean(u.beds) : "", baths: clean(u.baths) !== "0" ? clean(u.baths) : "",
      areaBuilt: areaM2(u.built), areaPlot: areaM2(u.plot), areaVeranda: "",
      floor: "", attrs, features: hasPool ? ["Private pool"] : [],
      photos: sizedImages(arr(u?.images?.image).map((im: any) => txt(im?.url)).filter(Boolean)),
      plans: [], coords: Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null,
      description: "",
    };
  });

  const center = units.find((u) => u.coords)?.coords ?? null;
  const ov = OVERRIDES[`squareone:${id}`] ?? {};
  const descRaw = tidyDesc(txt(first?.desc?.en));
  const bracket = descRaw.match(/^\[\s*(.+?)\s*\]/)?.[1] ?? id;
  const developerName = toTitleCaseName(bracket);
  const publicName = ov.name ?? developerName;
  const descBody = descRaw.replace(/^\[\s*.+?\s*\]\s*/, "");
  const district = districtFor(center) || districtFromText(clean(first.province)) || districtFromText(clean(first.town)) || clean(first.province);
  const town = clean(first.town);
  const area = ov.area ?? (town && town.toLowerCase() !== district.toLowerCase() ? town : "");
  const gallery = sizedImages(Array.from(new Set(group.flatMap((p: any) => arr(p?.images?.image).map((im: any) => txt(im?.url))))).filter(Boolean));
  // AVAILABLE units only. This feeds Development.priceFrom/priceTo, which
  // resolveDevelopmentPrice() treats as the AUTHORITATIVE project price and
  // prefers over any unit-derived figure — so a sold unit priced below the
  // cheapest available one silently becomes the advertised "from" price.
  // Observed on Royal Horizon: two sold villas at €550,000 set the headline
  // while the cheapest villa a buyer could actually get was €950,000, and the
  // SEO description repeated the same €550,000 through {priceFrom}.
  // Leaving this null when nothing is available is deliberate: resolveDevelopment-
  // Price() then applies its own documented sold-out fallback ("sold from …"),
  // which is the single place that semantics belongs. Matches what the aristo
  // adapter already did.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  const amenities = units.some((u) => u.features.includes("Private pool")) ? ["Private pool (selected units)"] : [];
  return {
    id, dev: "squareone", publicName, developerName, developer: "Square One",
    area, district, town: "", location: joinLoc(district, area),
    status: "Available", category: "Residential", completion: "", energy: "",
    description: anonymize(descBody, developerName, publicName),
    gallery, plans: [], renders: [], amenities, heroVideo: ov.heroVideo, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: units[0]?.currency || "EUR",
  };
}

// ==================================================================
// Mito (Qobrix) — clustering. The feed carries no project id, no project name
// field and no <url> — the hook squareOne uses. Projects are therefore derived
// by grouping properties, and NEITHER available signal is sufficient on its own.
// Both failure modes are real, measured on the live feed:
//
//   - proximity alone splits Mamba, whose 1074 sits 450 m from its own project;
//   - identical descriptions alone split Paramount, whose four units carry two
//     different texts.
//
// So: same project when within MITO_SAME_PROJECT_M **or** sharing a description,
// unioned transitively.
// ==================================================================
export type MitoCluster = { units: any[]; description: string; center: { lat: number; lng: number } | null };

const mitoCoords = (p: any): { lat: number; lng: number } | null => {
  const lat = Number(txt(p?.location?.latitude)), lng = Number(txt(p?.location?.longitude));
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? { lat, lng } : null;
};

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

// Exported for the QA script — and because a future reader should be able to
// run the grouping without the network.
export function clusterMitoProperties(props: any[]): MitoCluster[] {
  const parent = props.map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const coords = props.map(mitoCoords);
  const descs = props.map((p) => tidyDesc(txt(p?.desc?.en)));
  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const near = coords[i] && coords[j] && metresBetween(coords[i]!, coords[j]!) < MITO_SAME_PROJECT_M;
      const sameText = !!descs[i] && descs[i] === descs[j];
      if (near || sameText) union(i, j);
    }
  }

  const byRoot = new Map<number, number[]>();
  props.forEach((_, i) => { const r = find(i); byRoot.set(r, [...(byRoot.get(r) ?? []), i]); });

  return Array.from(byRoot.values()).map((idxs) => {
    const units = idxs.map((i) => props[i]);
    // Longest variant wins where a project carries more than one text (Paramount
    // does), with a lexical tie-break so the result does not depend on the order
    // the feed happened to list the units in. Deterministic on purpose: a
    // description that flipped between syncs would churn the project's content
    // and its generated SEO text for no reason.
    const description = idxs
      .map((i) => descs[i])
      .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0))[0] ?? "";
    const withCoords = idxs.map((i) => coords[i]).filter(Boolean) as { lat: number; lng: number }[];
    const center = withCoords.length
      ? { lat: withCoords.reduce((s, c) => s + c.lat, 0) / withCoords.length, lng: withCoords.reduce((s, c) => s + c.lng, 0) / withCoords.length }
      : null;
    return { units, description, center };
  });
}

// Fetches and clusters. Separate from clusterMitoProperties so the pure grouping
// can be tested without the network.
export async function mitoClusters(): Promise<MitoCluster[]> {
  return clusterMitoProperties(arr((await cachedParse(MITO_URL))?.root?.property));
}

/* One cluster → one ProjectVM. `id` is supplied by the caller rather than derived
   here: Mito's identity is anchored in the database (see the Mito sync path in
   feedSync.ts), because the operator names these projects by hand and a
   recomputed key would orphan those names the first time the feed shifts. */
export function mitoVm(cluster: MitoCluster, id: string): ProjectVM {
  const units: UnitVM[] = cluster.units.map((u: any) => {
    const ref = txt(u.ref) || txt(u.id);
    const c = mitoCoords(u);
    return {
      ref, name: `Nr. ${ref}`, label: `Nr. ${ref}`,
      type: toTitleCaseName(clean(u.type)),
      // No status field anywhere in this feed. Presence IS availability, and a
      // unit that leaves the feed is pruned by the shared sync path — the same
      // mechanic as the other XML developers, but with no total to measure it
      // against, so "N available" here is not "N of M".
      status: "available", statusLabel: "Available",
      price: toNum(u.price), currency: clean(u.currency) || "EUR",
      beds: clean(u.beds) !== "0" ? clean(u.beds) : "",
      baths: clean(u.baths) !== "0" ? clean(u.baths) : "",
      areaBuilt: areaM2(u?.surface_area?.built), areaPlot: areaM2(u?.surface_area?.plot), areaVeranda: "",
      floor: "", attrs: [], features: [],
      photos: sizedImages(arr(u?.images?.image).map((im: any) => txt(im?.url)).filter(Boolean)),
      plans: [], coords: c, description: "",
    };
  });

  const first = cluster.units[0] ?? {};
  const center = cluster.center;
  const district = districtFor(center) || districtFromText(clean(first.province)) || districtFromText(clean(first.town)) || clean(first.province);
  // The most common town across the cluster, not whichever unit the feed listed
  // first. Members genuinely disagree: Paramount's 1078 says "Chlorakas" while
  // three units 61 m away say "Agios Theodoros". Taking units[0] happens to give
  // the majority value today only because the feed lists one of the three first.
  // `district` already has an equivalent safeguard — it comes from the cluster's
  // averaged coordinates rather than any single member.
  const townCounts = new Map<string, number>();
  for (const u of cluster.units) {
    const t = clean(u.town);
    if (t) townCounts.set(t, (townCounts.get(t) ?? 0) + 1);
  }
  const town = Array.from(townCounts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? "";
  // AVAILABLE units only, exactly as squareOne does — see the Royal Horizon
  // comment there. Every unit is "available" in this feed, so today this is the
  // whole set; the shape is kept so it stays correct if a status field ever
  // appears.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((p): p is number => p != null);

  return {
    id, dev: "mito",
    // Deliberately the id, not a guess from the description. Two of the four
    // projects are never named in the feed, and the operator names all of them
    // by hand through the public-name override.
    publicName: id, developerName: id, developer: "Mito",
    location: joinLoc(district, town), district, town,
    area: town && town.toLowerCase() !== district.toLowerCase() ? town : "",
    status: "", category: "",
    priceFrom: prices.length ? Math.min(...prices) : null,
    priceTo: prices.length ? Math.max(...prices) : null,
    currency: "EUR",
    description: cluster.description,
    gallery: sizedImages(Array.from(new Set(cluster.units.flatMap((p: any) => arr(p?.images?.image).map((im: any) => txt(im?.url))))).filter(Boolean)),
    plans: [], renders: [],
    // Project-level, not per-unit. Every unit carries pool=1 and the feed says
    // nothing about private versus communal — while one project's own text says
    // "a spacious communal swimming pool". A chip on each apartment card would
    // claim a private pool the feed never promised. squareOne solves the same
    // ambiguity the other way ("Private pool (selected units)") because its feed
    // marks pools per unit; this one does not.
    amenities: cluster.units.some((u: any) => txt(u.pool) === "1") ? ["Pool"] : [],
    center, units,
  };
}

// ==================================================================
// Leptos Estates (Kyero v3). Unlike Mito, this feed carries project identity:
// the ref is structured, e.g. A-BAG-Z-206 = Apartment, Bel Air Gardens, block
// Zefiro, unit 206. Grouping by that code puts 377 in-scope units into 48
// groups whose members never lie more than 9 m apart (measured 2026-08-30) —
// so Leptos uses the ordinary id-driven path (listProjectIds /
// getPreviewProject), not Mito's clustering detour.
// See docs/superpowers/specs/2026-08-30-leptos-feed-adapter-design.md
// ==================================================================
const LEPTOS_URL =
  "https://www.leptosestates.com/wp-content/themes/leptos-estates/template-export-xml-keyro.php?country=all";

export type LeptosRow = {
  ref: string; price: number; type: string;
  town: string; province: string; country: string;
  h2: string; body: string; descHtml: string;
  lat: number | null; lng: number | null;
  images: string[]; plans: string[];
  features: string[]; benefits: string[];
  beds: string; baths: string; plot: number | null; covered: number | null;
};

// Cyprus only, residential + commercial, no land parcels (operator's decision,
// 2026-08-30). Greece is filtered HERE rather than downstream because
// districtFor() resolves by longitude with no country check — lng < 32.6 means
// "Paphos", and Paros (25.15), Crete (23.8), Santorini (25.4) and Athens (23.7)
// all fall under it. Excluding them at the boundary means that function is
// never handed a coordinate it would answer wrongly.
export const leptosInScope = (r: { country: string; type: string }): boolean =>
  r.country.trim().toLowerCase() === "cyprus" &&
  r.type.trim().toLowerCase() !== "plots & land parcels";

// Leading segment is the property TYPE, not the project: A=Apartment,
// V=Villa, P=Plot, C=Commercial, S=Studio (plus two one-off spellings).
const LEPTOS_TYPE_PREFIX = new Set(["A", "V", "P", "C", "S", "AP", "PENT"]);

// The code is read at a KNOWN POSITION — the segment after the type prefix —
// never by searching the ref for a token that looks like a code. "PG" is
// Peyia Gardens in segment 2 (A-PG-BLK-D-204, Peyia) and Paphos Gardens in the
// last segment (A-A09-109-PG, Kato Paphos), two projects 12 km apart. A
// substring or last-segment rule merges them. This is the single most likely
// way a future edit breaks this adapter.
export function leptosCode(ref: string): string {
  const seg = String(ref || "").split("-").map((s) => s.trim()).filter(Boolean);
  if (!seg.length) return "";
  const i = seg.length > 1 && LEPTOS_TYPE_PREFIX.has(seg[0].toUpperCase()) ? 1 : 0;
  const code = (seg[i] ?? "").toUpperCase();
  // Limassol Blu Marine holds two separately branded towers. The tower is the
  // NEXT segment when it is alphabetic (CT = Cavalli); Poseidon's refs put a
  // bedroom count there instead (A-LBM-3-2604), so plain "LBM" means Poseidon.
  if (code === "LBM") {
    const next = seg[i + 1] ?? "";
    if (/^[A-Za-z]{2,}$/.test(next)) return `LBM-${next.toUpperCase()}`;
  }
  return code;
}

// Two codes that name one project. Both verified on the live feed 2026-08-30:
// same town, same coordinates, identical heading prefixes.
const LEPTOS_MERGE: Record<string, string> = {
  ZAN: "ZANATZIA",
  // Paphos Gardens puts the project token LAST (A-A09-109-PG), so the
  // positional rule reads the block as the code and yields four one-unit
  // projects. Merged under PAPHOSG — deliberately NOT "PG", which already
  // belongs to Peyia Gardens.
  A09: "PAPHOSG", B11: "PAPHOSG", B08: "PAPHOSG", B10: "PAPHOSG",
};

// Display names. The code alone (BAG, AKMT, PRDSGIII) is meaningless in the
// admin, and the heading is a UNIT title, not a project name — stripping it
// splits Kamares Village into three when every one of its units says, in
// identical words, that it is one development. 45 rows, reviewed once.
// A code NOT listed here is not an error: it falls back to its heading.
const LEPTOS_NAMES: Record<string, string> = {
  "LBM-CT": "Cavalli Tower", LBM: "Poseidon Tower",
  BAG: "Bel Air Gardens", LPARK: "Limassol Park", KAM: "Kamares Village",
  CORALG: "Coral Gardens", ADN: "Adonis Beach Villas", MAND: "Mandria Gardens",
  COR: "Coral Bay Villas", MBV: "Maniki Beach Villas", OLY: "Olympus Village",
  CORS: "Coral Seas Villas", IAS: "Iasonas Beach Villas", VEN: "Venus Gardens",
  ZANATZIA: "Zanatzia", AKMT: "Akamantis", PER: "Perneri",
  ARM: "Armonia Beach Villas", APHS: "Aphrodite Springs", AKAK: "Akakia",
  KINGC: "Kings Court", DEL: "Limassol Del Mar", RUBY: "The Ruby",
  PG: "Peyia Gardens", PAPHOSG: "Paphos Gardens", ZEL: "Zelemenos Village",
  LMNR: "Limnaria Westpark", APHG: "Aphrodite Gardens",
  TALAC: "Tala Village Corner", BEL: "Belvedere", KOILI: "Koili Hills",
  KINGG: "Kings Gardens", PSSR: "Pissouri Villas", CBP: "Coral Bay Plaza",
  AKR: "Akropolis", NEAP: "Neapolis Corporate Center", ATLCEN: "Atlas Centre",
  KHV: "Kissonerga Hills Villas", WSTPRK: "West Park Court III",
  PRDSGIII: "Paradise Gardens", STGH: "St. George's Hills",
  LTCH: "Latchi Beach Villas", BAS: "Basilica Harbour Court",
  APO: "Apollo Beach Villas", SIV: "Leptos Sivitanidium Megaro",
};

export function leptosProjectKey(r: { ref: string; h2: string }): string {
  const code = leptosCode(r.ref);
  // The Ruby is a separately branded tower inside Limassol Del Mar, the same
  // shape as Cavalli inside Blu Marine — but Del Mar's refs give it no segment
  // of its own, so it is split on the heading instead.
  if (code === "DEL" && /\bThe Ruby\b/i.test(r.h2 || "")) return "RUBY";
  return LEPTOS_MERGE[code] ?? code;
}

// Unit designations to strip when falling back to the heading. "Floor" is one
// of them: a heading of "Floor 5" is entirely a unit designation, and without
// it here the length guard below never fires — 7 characters of pure unit
// designation would become a project's display name.
const LEPTOS_UNIT_WORDS =
  "Grand Mansion|Townhouse|Maisonette|Penthhouse|Penthouse|Apartment|Restaurant|Mansion|Villas|Villa|Studio|Houses|House|Shops|Shop|Flat|Floor";

export function leptosProjectName(key: string, h2: string): string {
  const listed = LEPTOS_NAMES[key];
  if (listed) return listed;
  let s = String(h2 || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*[,–-]\s*(Block|Blk)\b.*$/i, "");
  s = s.replace(new RegExp(`\\s*\\b(${LEPTOS_UNIT_WORDS})\\b.*$`, "i"), "");
  s = s.replace(/[,\s–\-/&]+$/, "").trim();
  // A heading like "Floor 5" carries no project name at all; the code is the
  // only honest answer left, and it is at least stable and greppable.
  return s.length >= 3 ? s : key;
}

// ---------- dispatcher ----------
const DEVELOPERS: Record<string, { label: string; default: string }> = {
  "island-blue": { label: "Island Blue", default: "76" },
  inex: { label: "INEX", default: "1" },
  bbf: { label: "BBF", default: "36" },
  aristo: { label: "Aristo", default: "Pelagos Beachfront Villas" },
  pafilia: { label: "Pafilia", default: "Elysia Blu" },
  domenica: { label: "Domenica", default: "cirvis" },
  medousa: { label: "Medousa", default: "PRJ-10034" },
  squareone: { label: "Square One", default: "neon" },
};
export const DEV_LIST = Object.entries(DEVELOPERS).map(([id, d]) => ({ id, ...d }));

// All project ids/keys for a developer (for the sync to iterate). Uses the feed
// cache, so getPreviewProject(dev, id) per id then reuses the parsed feed.
export async function listProjectIds(dev: string): Promise<string[]> {
  const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));
  if (dev === "island-blue") return uniq(arr((await cachedParse(IB_PROJECTS))?.Projects?.Project).map((p: any) => txt(p.Id)));
  if (dev === "inex" || dev === "bbf") {
    const key = process.env[`DEV_FEED_KEY_${dev.toUpperCase()}`] ?? "";
    if (!key || !QUBE_URL[dev]) return [];
    return uniq(arr((await cachedParse(QUBE_URL[dev], { "x-api-key": key }))?.["realty-feed"]?.projects).map((p: any) => txt(p.id)));
  }
  if (dev === "aristo") return uniq(arr((await cachedParse(ARISTO_URL))?.xml?.property).map((u: any) => txt(u.Project)));
  if (dev === "pafilia" || dev === "domenica") {
    const cfg = XML2U[dev];
    return uniq(arr((await cachedParse(cfg.url))?.document?.Clients?.Client?.properties?.Property).map((p: any) => cfg.groupKey(p)));
  }
  if (dev === "medousa") {
    try { return uniq(arr((await cachedParse(MEDOUSA_URL))?.feed?.projects?.project).map((p: any) => txt(p?.$?.ref))); }
    catch { return []; }
  }
  if (dev === "squareone") return uniq(arr((await cachedParse(SQUAREONE_URL))?.kyero?.property).map((p: any) => projectSlugFrom(p.url)));
  return [];
}

export async function getPreviewProject(dev = "island-blue", id?: string): Promise<ProjectVM | null> {
  const target = id ?? DEVELOPERS[dev]?.default;
  if (dev === "inex" || dev === "bbf") return qubehub(dev, target);
  if (dev === "aristo") return aristo(target);
  if (dev === "pafilia" || dev === "domenica") return xml2u(dev, target);
  if (dev === "medousa") return medousa(target);
  if (dev === "squareone") return squareOne(target);
  // Island Blue is the default for its OWN key only. Returning it for anything
  // unrecognised meant a developer added without an adapter silently received
  // another developer's projects — found 2026-08-28 while adding Mito, whose
  // sync path deliberately never reaches this function. Every caller either
  // catches (feedSync's four call sites) or normalises its input first
  // ([lang]/preview-project/page.tsx).
  if (dev === "island-blue") return islandBlue(target);
  throw new Error(`No feed adapter for developer "${dev}"`);
}
