// Developer Feed Analysis — internal field catalog, synonym dictionary, type
// inference and internal-field suggestion. Pure functions, no I/O, no DB.
//
// This is the reference the discovery tool compares developer feeds against:
// "does this incoming field already exist in our model, and where?". The catalog
// is intentionally a small, explicit config (not schema introspection) because
// several real-estate fields live inside JSON columns (distances, keyFeatures)
// or don't exist yet — so a naive "is it a Project column?" check would mislead.
// Editing this list is how we evolve what the website supports.

export type InternalLocation =
  | { kind: "column"; model: "Project" | "Property"; column: string }
  | { kind: "json"; model: "Project" | "Property"; path: string } // stored inside a JSON column
  | { kind: "none" }; // not stored anywhere yet → candidate new unified field

export type CatalogEntry = {
  key: string; // canonical internal field key
  label: string;
  location: InternalLocation;
  filterable: boolean; // used by public search/filters today?
};

// key → catalog entry. Keep labels human-readable (shown in admin).
export const INTERNAL_CATALOG: CatalogEntry[] = [
  { key: "projectName", label: "Project name", location: { kind: "column", model: "Project", column: "title" }, filterable: false },
  { key: "city", label: "City / location", location: { kind: "column", model: "Project", column: "city" }, filterable: true },
  { key: "propertyType", label: "Property type", location: { kind: "column", model: "Project", column: "propertyType" }, filterable: true },
  { key: "price", label: "Price", location: { kind: "column", model: "Project", column: "price" }, filterable: true },
  { key: "bedrooms", label: "Bedrooms", location: { kind: "column", model: "Project", column: "bedrooms" }, filterable: true },
  { key: "isNew", label: "New build", location: { kind: "column", model: "Project", column: "isNew" }, filterable: true },
  { key: "completionDate", label: "Completion date", location: { kind: "column", model: "Project", column: "completionDate" }, filterable: false },
  { key: "latitude", label: "Latitude", location: { kind: "column", model: "Project", column: "latitude" }, filterable: false },
  { key: "longitude", label: "Longitude", location: { kind: "column", model: "Project", column: "longitude" }, filterable: false },
  { key: "images", label: "Images / media", location: { kind: "json", model: "Project", path: "images" }, filterable: false },
  { key: "description", label: "Description", location: { kind: "json", model: "Project", path: "description" }, filterable: false },
  { key: "distanceToBeach", label: "Distance to beach", location: { kind: "json", model: "Project", path: "distances" }, filterable: false },
  { key: "distanceToSchool", label: "Distance to school", location: { kind: "json", model: "Project", path: "distances" }, filterable: false },
  { key: "availabilityStatus", label: "Availability / status", location: { kind: "json", model: "Project", path: "keyFeatures" }, filterable: false },
  // Meaningful fields developers commonly send that we do NOT store yet — the
  // core output of this discovery tool (candidate new unified website fields).
  { key: "unitNumber", label: "Unit number", location: { kind: "none" }, filterable: false },
  { key: "bathrooms", label: "Bathrooms", location: { kind: "none" }, filterable: false },
  { key: "coveredArea", label: "Covered area", location: { kind: "none" }, filterable: false },
  { key: "totalArea", label: "Total area", location: { kind: "none" }, filterable: false },
  { key: "plotSize", label: "Plot size", location: { kind: "none" }, filterable: false },
  { key: "floor", label: "Floor", location: { kind: "none" }, filterable: false },
];

export const CATALOG_BY_KEY: Record<string, CatalogEntry> = Object.fromEntries(
  INTERNAL_CATALOG.map((e) => [e.key, e]),
);

// Normalised external field name → canonical internal key. Keys here are the
// external name reduced to lowercase alphanumerics (see `normalizeName`).
const SYNONYMS: Record<string, string> = {
  // name / title
  name: "projectName", projectname: "projectName", project: "projectName", title: "projectName",
  development: "projectName", complex: "projectName", building: "projectName",
  // bedrooms
  bedrooms: "bedrooms", bedroom: "bedrooms", beds: "bedrooms", bed: "bedrooms",
  rooms: "bedrooms", room: "bedrooms", noofbedrooms: "bedrooms", numbedrooms: "bedrooms",
  // bathrooms (canonical field; not stored yet)
  bathrooms: "bathrooms", bathroom: "bathrooms", baths: "bathrooms", bath: "bathrooms",
  // new-build flag → existing Project.isNew
  newbuild: "isNew", isnew: "isNew",
  // covered / internal area
  coveredarea: "coveredArea", internalarea: "coveredArea", livingarea: "coveredArea",
  builtarea: "coveredArea", built: "coveredArea", area: "coveredArea", sqm: "coveredArea", size: "coveredArea", floorsize: "coveredArea",
  // total / gross area
  totalarea: "totalArea", grossarea: "totalArea", totalsize: "totalArea",
  // plot / land
  plot: "plotSize", plotsize: "plotSize", landarea: "plotSize", plotarea: "plotSize", landsize: "plotSize",
  // price
  price: "price", amount: "price", saleprice: "price", totalprice: "price", cost: "price", value: "price", askingprice: "price",
  // status / availability
  status: "availabilityStatus", availability: "availabilityStatus", available: "availabilityStatus", state: "availabilityStatus",
  // completion
  completion: "completionDate", completiondate: "completionDate", delivery: "completionDate",
  deliverydate: "completionDate", handover: "completionDate", readydate: "completionDate", completionquarter: "completionDate",
  // coordinates
  lat: "latitude", latitude: "latitude",
  lng: "longitude", lon: "longitude", long: "longitude", longitude: "longitude",
  // floor / unit
  floor: "floor", level: "floor", storey: "floor",
  unit: "unitNumber", unitnumber: "unitNumber", unitno: "unitNumber", apartmentnumber: "unitNumber", flatnumber: "unitNumber",
  // city / location
  city: "city", town: "city", region: "city", district: "city",
  // type
  type: "propertyType", propertytype: "propertyType", category: "propertyType", offertype: "propertyType",
  // distances
  distancetobeach: "distanceToBeach", beachdistance: "distanceToBeach", tobeach: "distanceToBeach", seadistance: "distanceToBeach",
  distancetoschool: "distanceToSchool", schooldistance: "distanceToSchool", toschool: "distanceToSchool",
  // media / description
  image: "images", images: "images", photo: "images", photos: "images", picture: "images", pictures: "images", media: "images", thumbnail: "images",
  description: "description", desc: "description", details: "description", text: "description",
};

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Suggest a canonical internal field for an external field name (or null). */
// Internal fields that only make sense with numeric values — used by the
// analyzer to drop a name-based suggestion when the sampled values are clearly
// non-numeric labels (e.g. a field named "Area" whose values are place names).
export const NUMERIC_KEYS = new Set([
  "price", "coveredArea", "totalArea", "plotSize", "bedrooms", "bathrooms", "latitude", "longitude",
]);

export function suggestInternalField(externalName: string): string | null {
  const n = normalizeName(externalName);
  if (!n) return null;
  // Contact / company / agent metadata is NOT a property field — never map it to
  // projectName / city (e.g. companyName, agent1FirstName, companyRegion, companyTownCity).
  if (/(agent|contact|company)/.test(n)) return null;
  // Units-of-measure fields (floorSizeUnits, plotSizeUnits) are metadata, not areas.
  if (/units$/.test(n)) return null;
  if (SYNONYMS[n]) return SYNONYMS[n];
  // keyword containment fallback (handles prefixed/suffixed names like "prop_price_eur").
  // Match the LONGEST synonym first, so a specific term wins over a generic
  // substring (e.g. "bathroom" beats "room" for "fullBathrooms").
  const syns = Object.entries(SYNONYMS)
    .filter(([s]) => s.length >= 4)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [syn, key] of syns) {
    if (!n.includes(syn)) continue;
    if (key === "price" && n.includes("freq")) continue; // price_freq is sale/rent, not a price
    return key;
  }
  return null;
}

export type InferredType =
  | "string" | "number" | "price" | "area" | "date" | "boolean"
  | "coordinates" | "status" | "image" | "url";

const isNumeric = (v: string) => v !== "" && !isNaN(Number(v.replace(/[\s,]/g, "")));
const looksDate = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(v) || !isNaN(Date.parse(v)) && /\d{4}/.test(v);
const looksUrl = (v: string) => /^https?:\/\//i.test(v);
const looksImage = (v: string) => looksUrl(v) && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v);
const BOOLS = new Set(["true", "false", "yes", "no", "1", "0", "y", "n"]);

/** Infer a semantic type from the field name + sampled values. */
export function inferType(externalName: string, values: string[]): InferredType {
  const n = normalizeName(externalName);
  const sample = values.filter((v) => v != null && String(v).trim() !== "").map(String);
  const nameHas = (...ks: string[]) => ks.some((k) => n.includes(k));
  const hasNum = sample.length === 0 || sample.some(isNumeric);

  // units-of-measure fields (floorSizeUnits, plotSizeUnits) are plain strings, not areas
  if (/units$/.test(n)) return "string";
  // name-driven semantic types first — numeric-expecting types require numeric values
  if (((nameHas("price", "amount", "cost", "eur", "usd") && !n.includes("freq")) && hasNum) || (nameHas("value") && sample.every(isNumeric))) return "price";
  if (nameHas("lat", "lng", "lon", "coordinate", "coord") && hasNum) return "coordinates";
  if (nameHas("area", "sqm", "size", "plot", "m2", "built") && hasNum) return "area";
  if (nameHas("date", "completion", "delivery", "handover", "ready")) return "date";
  if (nameHas("status", "availability", "available")) return "status";
  if (nameHas("image", "photo", "picture", "media", "thumbnail")) return "image";
  if (nameHas("url", "link", "href")) return "url";

  if (sample.length === 0) return "string";
  // value-driven
  if (sample.every(looksImage)) return "image";
  if (sample.every(looksUrl)) return "url";
  if (sample.every((v) => BOOLS.has(v.toLowerCase())) && new Set(sample.map((v) => v.toLowerCase())).size <= 2) return "boolean";
  if (sample.every(looksDate)) return "date";
  if (sample.every(isNumeric)) return "number";
  return "string";
}

export type Recommendation = "existing" | "new" | "optional" | "ignore";

// Default recommendation from the suggestion + type. Admin can override per row.
export function recommend(suggestedKey: string | null, type: InferredType, externalName: string): Recommendation {
  if (suggestedKey) {
    const entry = CATALOG_BY_KEY[suggestedKey];
    return entry && entry.location.kind !== "none" ? "existing" : "new";
  }
  const n = normalizeName(externalName);
  // obvious feed plumbing / ids → ignore
  if (/(^| )?(id|ref|code|guid|uuid|createdat|updatedat|modified|timestamp|hash)$/.test(n) || n.endsWith("id")) return "ignore";
  if (type === "image" || type === "url") return "optional";
  return "optional";
}

// Human-readable one-liner for where an internal field lives (admin display).
export function locationLabel(loc: InternalLocation): string {
  if (loc.kind === "column") return `${loc.model}.${loc.column} (column)`;
  if (loc.kind === "json") return `${loc.model}.${loc.path} (JSON)`;
  return "not stored yet";
}
