import { parseStringPromise } from "xml2js";
import { readFile } from "fs/promises";
import { join } from "path";
import type { UnitVM } from "./UnitsView";
import { sizeKey, sizeOf } from "./imageSize";

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
const areaM2 = (v: any): string => { const n = toNum(v); return n ? `${n}\u00A0m²` : ""; }; // nbsp keeps "105 m²" on one line
const districtFor = (lng?: number | null) => (lng == null ? "" : lng < 32.6 ? "Paphos" : lng < 33.4 ? "Limassol" : "Larnaca");
// Fallback for projects with no coordinates at all (some Aristo units carry no
// Latitude/Longitude) — match the feed's own area/town text against known towns
// per district, so district isn't silently blank just because geo is missing.
const DISTRICT_TOWNS: Record<string, RegExp> = {
  Paphos: /paphos|pafos|chloraka|peyia|pegeia|coral bay|polis|latchi|latsi|venus rock|geroskipou|yeroskipou|anavargos|emba|empa|konia|tala|mesogi|mesoyi|kissonerga|tombs of the kings/i,
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
  "inex:1": { name: "Marea Residences", mainImage: "https://qubehub.fra1.digitaloceanspaces.com/inex/project_images/1/68c7c3bed23fdc28ea47a753_07_medium.avif" }, // area comes from the feed (Coral Bay)
  "bbf:36": { name: "Flow Residences", area: "Agios Nicolaos", mainImage: "https://qubehub.fra1.digitaloceanspaces.com/bbf/images/projects/MEDIUM_0f5b9660-485b-407f-ae74-500d90fc5cc4.jpg" },
  "aristo:Pelagos Beachfront Villas": { name: "Azure Beachfront Villas", area: "Chloraka" },
  "pafilia:Elysia Blu": { name: "Elysia Blu Residences", area: "Kato Paphos" },
  "domenica:cirvis": { name: "Cirvis Residences" },
  "medousa:Cypress Park Living": { name: "Cypress Park Residences" },
  "agg:vasileon": { name: "Vasileon Signature Residences" },
};

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
      areaBuilt: getAttr(/total built|built area|covered internal|internal area/),
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
  const developerName = txt(project.Name);
  const publicName = ov.name ?? developerName;
  const renders = arr(project?.ArtistImpressions?.ArtistImpression).map(txt).filter(Boolean).map(secure);
  const photos = arr(project?.Photos?.Photo).map(txt).filter(Boolean).map(secure);
  const rawGallery = [...renders, ...photos];
  const main = ov.mainImage ? secure(ov.mainImage) : null;
  const gallery = main ? [main, ...rawGallery.filter((u) => u !== main)] : rawGallery;
  return {
    id, dev: "island-blue", publicName, developerName, developer: "Island Blue",
    area: ov.area ?? txt(project.Location), district: districtFor(center?.lng), town: "",
    location: joinLoc(districtFor(center?.lng), ov.area ?? txt(project.Location)),
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
  // Qubehub: <projects> repeats (each = a project); <units> repeats inside each
  const projects = arr((await cachedParse(url, { "x-api-key": key }))?.["realty-feed"]?.projects);
  const project = projects.find((p: any) => txt(p.id) === id) ?? projects[0];
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
  const developerName = txt(project.name);
  const publicName = ov.name ?? developerName;
  const stage = STAGE_LABEL[txt(project.stage).toLowerCase()] ?? txt(project.stage);
  // location levels: District (from coords) · Town (city, if distinct) · Area
  const district = districtFor(center?.lng) || districtFromText(clean(loc.city)) || districtFromText(clean(loc.area)) || clean(loc.city);
  const areaName = ov.area ?? clean(loc.area);
  const cityTown = clean(loc.city);
  const town = cityTown && cityTown.toLowerCase() !== district.toLowerCase() && cityTown.toLowerCase() !== areaName.toLowerCase() ? cityTown : "";
  const galleryAll = sizedImages(arr(project.images).map(txt).filter(Boolean));
  const main = ov.mainImage ? secure(ov.mainImage) : null; // admin-selected hero image, shown first
  const gallery = main ? [main, ...galleryAll.filter((u) => u !== main)] : galleryAll;
  const amenities = arr(project.benefits).map(txt).filter(Boolean);
  const prices = units.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
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
      areaBuilt: areaM2(u.Total_Covered_Areas), areaPlot: areaM2(u.Plot_Size), areaVeranda: areaM2(u.Covered_Verandas),
      floor: naClean(u.Apartment_Floor), attrs, features: [],
      photos: arr(u?.gallery?.image).map(aristoImg).filter(Boolean), plans: [],
      coords: Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null,
      description: txt(u.Description),
    };
  });

  const center = units.find((u) => u.coords)?.coords ?? null;
  const ov = OVERRIDES[`aristo:${id}`] ?? {};
  const developerName = id, publicName = ov.name ?? developerName;
  const area = ov.area ?? txt(first.Area);
  const district = districtFor(center?.lng) || districtFromText(area) || districtFromText(naClean(first.Location));
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
    const attrs = [
      ["Floor area", areaM2(d.FloorSize)], ["Plot", areaM2(d.PlotSize)],
      ["Bedrooms", beds], ["Bathrooms", baths],
      ["En-suites", clean(d.ensuites) !== "0" ? clean(d.ensuites) : ""],
      ["Floors", clean(d.numberOfFloors) !== "0" ? clean(d.numberOfFloors) : ""],
      ["Year built", clean(d.yearBuilt)], ["Orientation", clean(d.orientation)],
      // Real YouTube/Matterport links exist for a good share of Pafilia's units —
      // previously never read at all. UnitsView renders a URL-shaped attrs value
      // as a clickable link rather than raw text.
      ["Video walkthrough", clean(p?.link?.video)], ["Virtual tour", clean(p?.link?.virtualTour)],
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    return {
      ref: txt(p?.Price?.reference), name: clean(d.title) || txt(d.propertyType),
      label: `${txt(d.propertyType)}${beds ? ` · ${beds} bed` : ""}`,
      type: txt(d.propertyType), status: "available", statusLabel: "Available",
      price: toNum(p?.Price?.price), currency: txt(p?.Price?.currency) || "EUR",
      beds, baths, areaBuilt: areaM2(d.FloorSize), areaPlot: areaM2(d.PlotSize), areaVeranda: "",
      floor: clean(d.floorNumber), attrs, features: [],
      photos: sizedImages(arr(p?.images?.image).map((e: any) => aristoImg(e?.image)).filter(Boolean)),
      plans: arr(p?.Floorplans?.floorplan).map((e: any) => aristoImg(e?.floorplan)).filter(Boolean),
      coords: null, description: clean(d.description) || clean(d.shortDescription),
    };
  });

  const lat = Number(txt(first?.Address?.latitude)), lng = Number(txt(first?.Address?.longitude));
  const center = Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null;
  const ov = OVERRIDES[`${dev}:${id}`] ?? {};
  const developerName = id, publicName = ov.name ?? id;
  const area = ov.area ?? txt(first?.Address?.location);
  const district = districtFor(center?.lng) || districtFromText(area) || districtFromText(clean(first?.Address?.region)) || districtFromText(clean(first?.Address?.subRegion));
  const d0 = first.Description ?? {};
  const descText = tidyDesc(clean(d0.description) || clean(d0.shortDescription));
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
  const gallery = sizedImages(Array.from(new Set(group.flatMap((p: any) => arr(p?.images?.image).map((e: any) => aristoImg(e?.image))))).filter(Boolean));
  const plans = Array.from(new Set(group.flatMap((p: any) => arr(p?.Floorplans?.floorplan).map((e: any) => aristoImg(e?.floorplan))))).filter(Boolean);
  const prices = units.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  return {
    id, dev, publicName, developerName, developer: cfg.developer,
    area, district, town: "", location: joinLoc(district, area),
    status: stage || txt(first?.Price?.status) || "Available", stage, category: "Residential",
    completion: (clean(d0.newBuild).toLowerCase() === "yes" || Number(clean(d0.yearBuilt)) >= 2025) && clean(d0.yearBuilt) ? String(clean(d0.yearBuilt)) : "", energy: "",
    description: anonymize(descText, developerName, publicName),
    gallery, plans, renders: [], amenities, extraFacts, heroVideo: ov.heroVideo, center, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: units[0]?.currency || "EUR",
  };
}

// ==================================================================
// Medousa (uploaded "project report" file, stored in the DB → exported to
// public/medousa-feed.xml). Structure: ProjectsReport > Project > Unit.
// Minimal feed: units + prices + specs only — NO images / coords / description.
// ==================================================================
async function medousa(id: string): Promise<ProjectVM | null> {
  const cacheKey = "medousa:file";
  const hit = feedCache.get(cacheKey);
  let data = hit && Date.now() - hit.at < FEED_TTL ? hit.data : null;
  if (!data) {
    try {
      data = await parseXml(await readFile(join(process.cwd(), "public", "medousa-feed.xml"), "utf8"));
      feedCache.set(cacheKey, { at: Date.now(), data });
    } catch { return null; }
  }
  const projects = arr(data?.ProjectsReport?.Project);
  const project = projects.find((p: any) => txt(p?.$?.Name) === id) ?? projects[0];
  if (!project) return null;
  const at = project.$ ?? {};

  const units: UnitVM[] = arr(project.Unit).map((u: any) => {
    const a = u.Attributes ?? {};
    const beds = clean(a.Bedrooms) !== "0" ? clean(a.Bedrooms) : "";
    const baths = clean(a.Bathrooms) !== "0" ? clean(a.Bathrooms) : "";
    const pool = clean(a.SwimmingPool);
    // Garage/Basement ship either an area figure or a plain "Yes"/"Communal" flag —
    // format as m² only when it's actually numeric, else pass the text through as-is.
    const numOrText = (v: any) => { const t = clean(v); return t ? (/^\d/.test(t) ? areaM2(v) : t) : ""; };
    const attrs = [
      ["Internal area", areaM2(a.InternalArea)], ["Total covered", areaM2(a.TotalCoveredArea)],
      ["Covered veranda", areaM2(a.CoveredVeranda)], ["Uncovered veranda", areaM2(a.UncoveredVeranda)],
      ["Roof terrace", areaM2(a.roofterrace)], ["Plot", areaM2(a.Plot)], ["Total area", areaM2(a.TotalArea)],
      ["Swimming pool", pool && pool !== "0" ? pool.charAt(0) + pool.slice(1).toLowerCase() : ""],
      ["Garage", numOrText(a.Garage)], ["Basement", numOrText(a.Basement)],
      ["Storage", numOrText(a.Storages)], ["Elevator", numOrText(a.Elevator)], ["Conference room", numOrText(a.ConferenceRoom)],
      ["Offices", clean(a.Offices) && clean(a.Offices) !== "0" ? clean(a.Offices) : ""],
    ].filter(([, v]) => v).map(([name, value]) => ({ name: String(name), value: String(value) }));
    const short = txt(u.Title).replace(new RegExp(`^${escapeRe(txt(at.Name))}\\s*`, "i"), "");
    return {
      ref: txt(u.Id), name: txt(u.Title), label: `Nr. ${short || txt(u.Id)}`,
      type: txt(u.ProjectType) || clean(a.Type),
      status: "available", statusLabel: "Available", price: toNum(u.Price), currency: "EUR",
      beds, baths, areaBuilt: areaM2(a.TotalCoveredArea), areaPlot: areaM2(a.Plot), areaVeranda: areaM2(a.CoveredVeranda),
      floor: "", attrs, features: [], photos: [], plans: [], coords: null, description: "",
    };
  });

  const ov = OVERRIDES[`medousa:${id}`] ?? {};
  const developerName = id, publicName = ov.name ?? id;
  const district = txt(at.City) || "Paphos";
  const area = ov.area ?? "";
  const pooled = arr(project.Unit).some((u: any) => /pool|communal/i.test(txt(u?.Attributes?.SwimmingPool)));
  const prices = units.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  return {
    id, dev: "medousa", publicName, developerName, developer: "Medousa",
    area, district, town: "", location: joinLoc(district, area),
    status: "Available", category: "Residential", completion: clean(at.Year), energy: "",
    description: "",
    gallery: ov.mainImage ? [secure(ov.mainImage)] : [], plans: [], renders: [],
    amenities: pooled ? ["Communal pool"] : [], heroVideo: ov.heroVideo, center: null, units,
    priceFrom: prices[0] ?? null, priceTo: prices[prices.length - 1] ?? null, currency: "EUR",
  };
}

// ==================================================================
// AGG Luxury Homes (agcyprus.com) — Cloudflare-protected HTML, NO feed.
// One-time data extracted via the Claude-in-Chrome browser (proof of concept).
// Development listings (no per-unit availability).
// ==================================================================
type AggFixture = { name: string; area: string; center: { lat: number; lng: number }; priceFrom: number | null; type: string; completion: string; status: string; beds: string; baths: string; description: string; amenities: string[]; images: string[]; video?: string };
const AGG_FIXTURES: Record<string, AggFixture> = {
  vasileon: {
    name: "VASILEON SIGNATURE RESIDENCES", area: "Tombs of the Kings", center: { lat: 34.7767662, lng: 32.4082053 },
    priceFrom: 305000, type: "Apartments", completion: "Q2 2030", status: "Upcoming", beds: "up to 3", baths: "3",
    description: "Vasileon Signature Residences is an exclusive lifestyle and investment development in Paphos, just 200 metres from the beach and promenade — a frontline position on Tombs of the Kings Road, opposite a UNESCO World Heritage Site and one of Paphos' most iconic locations. The development offers contemporary studios, one-, two- and three-bedroom apartments and penthouses, most enjoying panoramic sea views.",
    amenities: ["Gated community", "3 outdoor swimming pools", "Adults-only pool zone", "Gym", "Spa & wellness centre", "Restaurant", "Lobby services", "Laundry services", "Sea view", "Concealed A/C", "Private parking", "Optional furniture package"],
    images: [
      "https://www.agcyprus.com/wp-content/uploads/2026/07/03.-Birds_Eye-scaled.jpg",
      "https://www.agcyprus.com/wp-content/uploads/2026/07/Vasileon-23.-In-Pool-5K-scaled.jpg",
      "https://www.agcyprus.com/wp-content/uploads/2026/07/04.-Top-View-6K-scaled.jpg",
      "https://www.agcyprus.com/wp-content/uploads/2026/07/05.-To-the-heart-6K-scaled.jpeg",
    ],
    video: "https://www.youtube.com/embed/GIl1RcJu5dY",
  },
};

async function agg(id: string): Promise<ProjectVM | null> {
  const f = AGG_FIXTURES[id] ?? Object.values(AGG_FIXTURES)[0];
  if (!f) return null;
  const ov = OVERRIDES[`agg:${id}`] ?? {};
  const district = districtFor(f.center?.lng);
  const area = ov.area ?? f.area;
  const extraFacts = [
    f.type ? { label: "Property type", value: f.type } : null,
    f.beds ? { label: "Bedrooms", value: f.beds } : null,
    f.baths ? { label: "Bathrooms", value: f.baths } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  return {
    id, dev: "agg", publicName: ov.name ?? f.name, developerName: f.name, developer: "AGG Luxury Homes",
    area, district, town: "", location: joinLoc(district, area),
    status: f.status || "Available", category: "Residential", completion: f.completion || "", energy: "",
    description: f.description || "",
    gallery: f.images.map(secure), plans: [], renders: [], amenities: f.amenities, extraFacts,
    heroVideo: ov.heroVideo, center: f.center ?? null, units: [],
    priceFrom: f.priceFrom ?? null, priceTo: null, currency: "EUR",
  };
}

// ==================================================================
// Square One (Kyero-standard XML): flat <property> list, one per unit, with
// NO explicit project field — grouped by the project slug embedded in each
// unit's own <url> (".../projects/neon"). The project name/description is
// duplicated verbatim across every unit of the same project as a "[NAME]"
// bracket-prefixed <desc>, same shape Aristo/xml2u use for their own feeds.
// ==================================================================
const SQUAREONE_URL = "https://admin.squareone.com.cy/api/project/projects/xml/";
const projectSlugFrom = (url: any) => txt(url).match(/projects\/([^/?#]+)/i)?.[1] ?? "";
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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
  const developerName = titleCase(bracket);
  const publicName = ov.name ?? developerName;
  const descBody = descRaw.replace(/^\[\s*.+?\s*\]\s*/, "");
  const district = districtFor(center?.lng) || districtFromText(clean(first.province)) || districtFromText(clean(first.town)) || clean(first.province);
  const town = clean(first.town);
  const area = ov.area ?? (town && town.toLowerCase() !== district.toLowerCase() ? town : "");
  const gallery = sizedImages(Array.from(new Set(group.flatMap((p: any) => arr(p?.images?.image).map((im: any) => txt(im?.url))))).filter(Boolean));
  const prices = units.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
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

// ---------- dispatcher ----------
const DEVELOPERS: Record<string, { label: string; default: string }> = {
  "island-blue": { label: "Island Blue", default: "76" },
  inex: { label: "INEX", default: "1" },
  bbf: { label: "BBF", default: "36" },
  aristo: { label: "Aristo", default: "Pelagos Beachfront Villas" },
  pafilia: { label: "Pafilia", default: "Elysia Blu" },
  domenica: { label: "Domenica", default: "cirvis" },
  medousa: { label: "Medousa", default: "Cypress Park Living" },
  agg: { label: "AGG", default: "vasileon" },
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
    try { return uniq(arr((await parseXml(await readFile(join(process.cwd(), "public", "medousa-feed.xml"), "utf8")))?.ProjectsReport?.Project).map((p: any) => txt(p?.$?.Name))); }
    catch { return []; }
  }
  if (dev === "agg") return Object.keys(AGG_FIXTURES);
  if (dev === "squareone") return uniq(arr((await cachedParse(SQUAREONE_URL))?.kyero?.property).map((p: any) => projectSlugFrom(p.url)));
  return [];
}

export async function getPreviewProject(dev = "island-blue", id?: string): Promise<ProjectVM | null> {
  const target = id ?? DEVELOPERS[dev]?.default;
  if (dev === "inex" || dev === "bbf") return qubehub(dev, target);
  if (dev === "aristo") return aristo(target);
  if (dev === "pafilia" || dev === "domenica") return xml2u(dev, target);
  if (dev === "medousa") return medousa(target);
  if (dev === "agg") return agg(target);
  if (dev === "squareone") return squareOne(target);
  return islandBlue(target);
}
