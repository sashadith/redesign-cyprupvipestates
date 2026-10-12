// Property Gallery (P.L. Property Gallery Developers & Constructors Ltd,
// Limassol) — 2026-10-12.
//
// Source: an OpenCart product export of cypruspropertygallery.com, uploaded by
// the developer as one XML file ("PG XML File <Month> <Year>.xml") into an
// anonymous SharePoint folder. One <item> = one unit. The sync
// (feedSync.syncPropertyGalleryCore) opens the share, takes the newest .xml
// and hands its text to this module; everything here is pure, so node:test
// covers it without the network.
//
// What the export means — decoded against the live product pages, not guessed:
//  - <status> 1 = the unit's page is online on their site, 0 = offline (404).
//    Offline units are left out: the developer has withdrawn them.
//  - <label_status> is the badge on the page: 1 "Доступный" (available),
//    3 "Резерв" (reserved), 6 "Продано" (sold). 0 = no badge, 5 = unseen on any
//    online page. Anything but 1 is treated as not available — an unknown
//    value never puts a unit on sale.
//  - <product_category> "Продажа…" = for sale, "Аренда…" = for rent. Rentals
//    (offices, shops, long-let flats) are left out.
//  - <price> 0 = price on request.
//  - <project_id> is their project. Two of their projects are split in two in
//    their own system (YOO Limassol villas/apartments, Venera apartments/villas,
//    MIR); the operator decided to show each as one development (PG_MERGE).
//
// The export carries no coordinates, construction stage or completion date;
// those come from the operator (pin) and the project texts.

import { parseStringPromise } from "xml2js";
import type { ProjectVM } from "@/app/preview-project/feeds";
import type { UnitVM } from "@/app/preview-project/UnitsView";

const SITE = "https://cypruspropertygallery.com";

/** Their project ids that belong together, mapped to one feedProjectId. */
export const PG_MERGE: Record<string, string> = {
  "70": "yoo-limassol", "90": "yoo-limassol",
  "76": "venera-residences", "81": "venera-residences",
  "102": "mir-residences", "103": "mir-residences",
};

/** Project names where the unit titles do not yield a clean one. */
const PG_NAME: Record<string, string> = {
  "yoo-limassol": "YOO Limassol",
  "venera-residences": "Venera Residences",
  "mir-residences": "MIR Residences",
  "71": "Evergreen",
  "86": "Majestic Villas",
  "97": "Greenwood",
  "107": "Seven Residences",
  "108": "Evergreen 2",
};

/** "Limassol - Germasogeia" → our area names. */
const AREA_FIX: Record<string, string> = {
  "agios tichonas": "Agios Tychonas",
  "makarios avenue": "City centre",
  "city centre": "City centre",
};

/* Plans filed as photos (2026-10-12). The export puts floor plans and site
   plans into the same image lists as renders: 88 of 241 distinct gallery
   images across the 12 projects. Measured on all 241, no single signal
   separates them — coloured site plans and 3D plans on black fail a
   lightness test, and interior renders with white walls defeat a whiteness
   test — so three, in order:
     1. the FILE name (not the folder: "3-rd floor/cgi03.jpg" is a render):
        plan/floor/master/basement/layout, "AP105.png", Greenwood's "A1F.jpg";
        unless the image is plainly a dark, saturated photo (YOO's aerial
        "masterplan" render);
     2. a light, colourless drawing (≥70 % light pixels, saturation ≤0.05);
     3. four files checked by eye that neither rule catches (PG_PLAN_FILES). */
const PLAN_NAME_RE = /plan|floor|master|basement|layout|^ap\s?\d|^\d+(st|nd|rd|th)\s|^[a-z]?(gf|\dF)\.(jpe?g|png)$/i;
const PG_PLAN_FILES = ["Skype_Picture_2025_02_10T09_44_57_577Z", "Pissouri Forest Park/Picture1.png", "GreenwoodHouseC/GreenwoodHouseC1.", "GreenwoodHouseC/GreenwoodHouseC2."];
export type Tone = { lightFraction: number; meanSaturation: number };

/** Decided from the URL alone, or null when the image's tone is needed. */
export function pgPlanByName(url: string): boolean | null {
  const path = decodeURI(url);
  if (PG_PLAN_FILES.some((f) => path.includes(f))) return true;
  return PLAN_NAME_RE.test(path.split("/").pop() ?? "") ? true : null;
}

export function pgIsPlanImage(url: string, tone: Tone | null): boolean {
  const byName = pgPlanByName(url);
  const darkPhoto = !!tone && tone.lightFraction < 0.05 && tone.meanSaturation > 0.2;
  if (byName) return !darkPhoto || PG_PLAN_FILES.some((f) => decodeURI(url).includes(f));
  return !!tone && tone.lightFraction >= 0.7 && tone.meanSaturation <= 0.05;
}

export type PgRow = {
  productId: string;
  projectKey: string;
  name: string;
  status: "available" | "reserved" | "sold";
  price: number | null;
  type: string;
  beds: string;
  baths: string;
  area: string;
  plot: string;
  floor: string;
  attrs: { name: string; value: string }[];
  features: string[];
  photos: string[];
  plan: string | null;
  location: string;
  description: string;
  projectDescription: string;
};

export type PgProject = { key: string; name: string; rows: PgRow[] };

const t = (v: any): string => (v == null ? "" : typeof v === "object" ? String(v._ ?? "") : String(v)).trim();
const arr = <T,>(x: T | T[] | undefined | null): T[] => (x == null ? [] : ([] as T[]).concat(x as any));

export function pgStatus(label: string): PgRow["status"] {
  if (label === "1") return "available";
  if (label === "6") return "sold";
  return "reserved";
}

/** Absolute, URL-encoded image URL; relative "catalog/…" paths live under /image/. */
export function pgImageUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const abs = /^https?:\/\//i.test(s) ? s : `${SITE}/image/${s.replace(/^\/+/, "")}`;
  // Event photos, partner icons and logos are not pictures of the property.
  if (/\/catalog\/partner\/|event photos|logo/i.test(abs)) return null;
  if (!/\.(jpe?g|png|webp)$/i.test(abs)) return null;
  return encodeURI(decodeURI(abs));
}

const stripHtml = (s: string) =>
  s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

const m2 = (v: string) => {
  const n = Number((v.match(/[\d.]+/) ?? [""])[0]);
  return Number.isFinite(n) && n > 0 ? `${Number.isInteger(n) ? n : n} m²` : "";
};

function normType(raw: string, name: string, category: string): string {
  const s = `${raw} ${name}`.toLowerCase();
  if (/penthouse/.test(s)) return "Penthouse";
  if (/maisonette/.test(s)) return "Maisonette";
  if (/townhouse/.test(s)) return "Townhouse";
  if (/villa|house/.test(s) || /Дома и Виллы/.test(category)) return "Villa";
  if (/studio/.test(s)) return "Studio";
  return "Apartment";
}

export async function parsePgXml(xml: string): Promise<PgRow[]> {
  const doc = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const items = arr(doc?.itemlist?.item);
  const rows: PgRow[] = [];
  for (const it of items) {
    const name = t(it.name_en);
    const categories = arr(it.product_category?.category).map(t).join(" | ");
    if (t(it.status) !== "1") continue; // offline on their own site
    if (!/Продажа/.test(categories) || /Аренда/.test(categories)) continue; // rentals out
    if (/\btest\b/i.test(name)) continue; // "TEST - Apartments G101"
    const pid = t(it.project_id);
    const attrs = arr(it.product_attribute?.attribute).map((a: any) => ({ name: t(a.attribute_en), value: t(a.value_en) })).filter((a) => a.name && a.value);
    const attr = (re: RegExp) => attrs.find((a) => re.test(a.name))?.value ?? "";
    const price = Number(t(it.price));
    const view = attr(/^view$/i);
    const pool = attr(/^swimming pool$/i);
    const sea = attr(/^to the sea$/i);
    const photos = [t(it.image), ...arr(it.additional_images?.image).map(t)].map(pgImageUrl).filter((u): u is string => !!u);
    rows.push({
      productId: t(it.product_id),
      projectKey: PG_MERGE[pid] ?? pid,
      name,
      status: pgStatus(t(it.label_status)),
      price: Number.isFinite(price) && price > 0 ? price : null,
      type: normType(attr(/^type$/i), name, categories),
      beds: attr(/^bedrooms$/i),
      baths: attr(/^(baths|bathrooms)$/i),
      area: m2(attr(/^area$/i)),
      plot: m2(attr(/^plot size$/i)),
      floor: attr(/^floor$/i),
      attrs: [
        ["Swimming pool", pool],
        ["View", view],
        ["Distance to the sea", sea.replace(/\s*m\.?$/i, " m").replace(/(\d)M$/i, "$1 m")],
      ].filter(([, v]) => v).map(([n, v]) => ({ name: String(n), value: String(v) })),
      features: [/sea view/i.test(view) && "Sea view", /private/i.test(pool) && "Private pool"].filter(Boolean) as string[],
      photos: Array.from(new Set(photos)),
      plan: pgImageUrl(t(it.imageplan)),
      location: attr(/^location$/i) || t(it.model),
      description: stripHtml(t(it.description_en)),
      projectDescription: stripHtml(t(it.project_description_en)),
    });
  }
  return rows;
}

/** "Alfa Residences: Apartment 101" → project "Alfa Residences", unit "Apartment 101". */
function splitName(name: string): { project: string; unit: string } {
  const m = name.match(/^(.*?)(?::|\s[-–]\s)\s*(.+)$/);
  return m ? { project: m[1].trim(), unit: m[2].trim() } : { project: name.trim(), unit: "" };
}

export function pgProjectName(key: string, rows: PgRow[]): string {
  if (PG_NAME[key]) return PG_NAME[key];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const p = splitName(r.name).project.replace(/\s+\d+[A-Z]?$/, "").trim();
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? key;
}

/** "Majestic Villa - №3" → "Villa 3", "Seven Residential 101" → "Apartment 101", "Maisonettes No. 1" → "Maisonette 1". */
export function pgUnitLabel(name: string, projectName: string, type: string): string {
  let rest = splitName(name).unit;
  if (!rest) rest = name.replace(new RegExp(`^${projectName.split(" ")[0]}\\s+\\w+\\s*`, "i"), "").trim() || name;
  rest = rest.replace(/№\s*/g, "").replace(/\bNo\.\s*/gi, "").replace(/\bMaisonettes\b/i, "Maisonette").replace(/\s+/g, " ").trim();
  return /^[\dA-Z][\dA-Z-]*$/i.test(rest) ? `${type} ${rest}` : rest;
}

export function pgArea(location: string): string {
  const segs = location.split(/\s[-–]\s/).map((x) => x.trim()).filter(Boolean);
  // "Limassol - Germasogeia" → the area is the second part; "Platres - Cyprus" → the first.
  const part = segs.length > 1 && !/^cyprus$/i.test(segs[segs.length - 1]) ? segs.slice(1).join(" - ") : segs[0] ?? "";
  const key = part.normalize("NFKD").replace(/[Ѐ-ӿ]/g, (c) => (c === "М" ? "M" : c === "м" ? "m" : c)).toLowerCase().trim();
  if (key in AREA_FIX) return AREA_FIX[key];
  return part.replace(/[Ѐ-ӿ]/g, (c) => (c === "М" ? "M" : c));
}

export function groupPgProjects(rows: PgRow[]): PgProject[] {
  const by = new Map<string, PgRow[]>();
  for (const r of rows) (by.get(r.projectKey) ?? by.set(r.projectKey, []).get(r.projectKey)!).push(r);
  return Array.from(by.entries()).map(([key, rs]) => ({ key, name: pgProjectName(key, rs), rows: rs }));
}

/** planUrls: images that are plan drawings (see pgIsPlanImage) — they leave the
    gallery and the unit photos and become the project's plans. */
export function pgVm(p: PgProject, planUrls: Set<string> = new Set()): ProjectVM {
  const units: UnitVM[] = p.rows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((r) => ({
      ref: r.productId,
      name: pgUnitLabel(r.name, p.name, r.type),
      label: pgUnitLabel(r.name, p.name, r.type),
      type: r.type,
      status: r.status,
      statusLabel: r.status === "sold" ? "Sold" : r.status === "reserved" ? "Reserved" : "Available",
      price: r.price, currency: "EUR",
      beds: r.type === "Studio" ? "0" : r.beds, baths: r.baths,
      // Their "Area" is the unit's total; no separate veranda figure exists, so Covered = this.
      areaBuilt: r.area, areaPlot: r.plot, areaVeranda: "",
      floor: r.floor === "0" ? "Ground" : r.floor,
      attrs: r.attrs, features: r.features,
      photos: r.photos.filter((u) => !planUrls.has(u)), plans: r.plan ? [r.plan] : [],
      coords: null, description: "",
    }));
  const available = units.filter((u) => u.status === "available").map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b);
  const loc = p.rows.map((r) => r.location).find(Boolean) ?? "";
  const area = pgArea(loc);
  const images = Array.from(new Set(p.rows.flatMap((r) => r.photos)));
  const gallery = images.filter((u) => !planUrls.has(u));
  const plans = images.filter((u) => planUrls.has(u));
  const desc = p.rows.map((r) => r.projectDescription).sort((a, b) => b.length - a.length)[0]
    || p.rows.map((r) => r.description).sort((a, b) => b.length - a.length)[0] || "";
  const allPrivatePool = p.rows.length > 0 && p.rows.every((r) => r.features.includes("Private pool"));
  const anyCommonPool = p.rows.some((r) => r.attrs.some((a) => a.name === "Swimming pool" && /common|outdoor|communal/i.test(a.value)));
  return {
    id: p.key, dev: "propertygallery", publicName: p.name, developerName: p.name, developer: "Property Gallery",
    area, district: "Limassol", town: "", location: area ? `Limassol · ${area}` : "Limassol",
    status: "Available", category: "Residential", stage: "", completion: "", energy: "",
    description: desc,
    gallery, plans, renders: [],
    amenities: [allPrivatePool && "Private swimming pool", anyCommonPool && "Communal swimming pool"].filter(Boolean) as string[],
    center: null, units,
    priceFrom: available[0] ?? null, priceTo: available[available.length - 1] ?? null, currency: "EUR",
  };
}

/** The newest export in the folder: "PG XML File Aug 2026.xml" style, by modified time. */
export function pickNewestXml<T extends { name: string; modifiedTime: string }>(files: T[]): T | null {
  const xml = files.filter((f) => /\.xml$/i.test(f.name));
  return xml.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0] ?? null;
}
