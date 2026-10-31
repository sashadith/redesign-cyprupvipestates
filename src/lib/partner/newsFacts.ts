// The facts one PROJECT_NEWS entry carries (2026-10-31): prices per bedroom count, the place line, and which of
// the partner's clients the project fits. No I/O; alertsSend.ts loads the rows and calls these.
import { parseBeds } from "@/lib/crm/matching";
import { matchesSavedSearch, type DevFacts, type SavedSearch } from "@/lib/crm/savedSearchMatch";
import type { BedPrice } from "./alerts";

type Unit = DevFacts["units"][number];

/** Cheapest available price per bedroom count (studio = 0), ascending by bedrooms. Units without a count or a price are left out. */
export function bedPrices(units: Unit[]): BedPrice[] {
  const best = new Map<number, number>();
  for (const u of units) {
    if (u.status !== "available" || typeof u.price !== "number" || !(u.price > 0)) continue;
    const b = parseBeds(u.beds);
    if (b == null) continue;
    const cur = best.get(b);
    if (cur == null || u.price < cur) best.set(b, u.price);
  }
  return Array.from(best, ([beds, price]) => ({ beds, price })).sort((a, b) => a.beds - b.beds);
}

/** "Limassol – Erimi": the town (else the district) and the area, each once; null when none is known. */
export function newsPlace(town: string | null | undefined, area: string | null | undefined, district?: string | null): string | null {
  const parts: string[] = [];
  for (const raw of [(town ?? "").trim() ? town : district, area]) {
    const v = (raw ?? "").trim();
    if (v && !parts.some((p) => p.toLowerCase() === v.toLowerCase())) parts.push(v);
  }
  return parts.length ? parts.join(" – ") : null;
}

export type NewsClient = {
  name: string;
  budgetMin: number | null;
  budgetMax: number | null;
  propertyTypeInterest: string[];
  /** Lead.lastMatchFilters: what our advisor last searched for this client. */
  lastMatchFilters: unknown;
  /** Districts of the projects the partner chose when submitting the client. */
  projectDistricts: string[];
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Does the project fit this client? The CRM's saved-search test (matchesSavedSearch: budget ±10 %, district,
 * bedrooms, type — each only when known), with one addition: when our advisor never narrowed the district,
 * the districts of the projects the partner chose for the client stand in for it. A client with no known
 * criterion fits nothing (no "fits" claim without evidence).
 *
 * A project with no unit rows (a developer that publishes only "price from" and a type) is tested as one
 * available unit at its headline price and category — a bedroom criterion then never matches, which is honest.
 */
export function clientFits(dev: DevFacts & { priceFrom: number | null; category: string | null }, client: NewsClient): boolean {
  const search: SavedSearch = { ...obj(client.lastMatchFilters) };
  const districts = Array.isArray(search.districts) ? search.districts.filter((d) => typeof d === "string" && d.trim()) : [];
  if (!districts.length && client.projectDistricts.length) search.districts = client.projectDistricts;
  const units = dev.units.length
    ? dev.units
    : dev.priceFrom != null && dev.priceFrom > 0
      ? [{ status: "available", beds: null, type: dev.category, price: dev.priceFrom }]
      : [];
  return matchesSavedSearch({ ...dev, units }, search, client);
}

/** Sentence ends: ". " / "! " / "? " before a capital (Latin, Polish, Cyrillic) — "1.167 m²" and "ca. 5" do not split. */
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-ZÀ-ÞĄĆĘŁŃÓŚŹŻА-ЯЁ])/;

/**
 * The short line under a new project: the first sentence of its description (a second one joins while the
 * whole stays within `max`); a first sentence longer than `max` is cut at a word and ends in "…". Null when empty.
 */
export function shortBlurb(text: string | null | undefined, max = 220): string | null {
  const first = (text ?? "").trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (!first) return null;
  const sentences = first.split(SENTENCE_END);
  let out = sentences[0];
  if (out.length > max) {
    const cut = out.slice(0, max - 1);
    const sp = cut.lastIndexOf(" ");
    return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, "")}…`;
  }
  for (const s of sentences.slice(1)) {
    if (out.length + 1 + s.length > max) break;
    out = `${out} ${s}`;
  }
  return out;
}
