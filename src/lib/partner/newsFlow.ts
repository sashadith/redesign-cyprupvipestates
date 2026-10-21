// Glue for the partner news (phase 4b, Decision 7). Pure: the shared catalogue part is cached as JSON by
// unstable_cache, so dates travel as ISO strings and are revived here; rates are merged per partner.
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import type { NewsAvailability } from "./news";

/** Only what newsItems reads from a change event, JSON-safe. No developer, no unit data. */
export type SlimEvent = {
  type: string;
  developmentId: string;
  name: string;
  town: string | null;
  en: string | null;
  at: string | null;
  since: string | null;
  from?: number | null;
  to?: number | null;
};
export type NewsCatalogue = { events: SlimEvent[]; availability: [string, { available: number; total: number; name: string; town: string | null; en: string | null }][] };

const NEWS_EVENT_TYPES = ["published", "back_on_market", "price_from_changed"];
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const enOf = (u: unknown): string | null => {
  const en = u && typeof u === "object" ? (u as { en?: unknown }).en : null;
  return typeof en === "string" ? en : null;
};

export function slimEvents(events: ChangeEvent[]): SlimEvent[] {
  return events
    .filter((e) => NEWS_EVENT_TYPES.includes(e.type))
    .map((e) => ({
      type: e.type, developmentId: e.developmentId, name: e.name, town: e.location?.town ?? null, en: enOf(e.publicUrl),
      at: iso(e.at), since: iso(e.since), from: num(e.from), to: num(e.to),
    }));
}

export function reviveEvents(events: SlimEvent[]): ChangeEvent[] {
  return events.map((e) => ({
    developmentId: e.developmentId, name: e.name, developer: null,
    location: { area: null, district: null, town: e.town },
    publicUrl: e.en ? { en: e.en } : null,
    type: e.type as ChangeEvent["type"],
    at: e.at ? new Date(e.at) : null,
    since: e.since ? new Date(e.since) : null,
    from: e.from ?? null, to: e.to ?? null,
  })) as ChangeEvent[];
}

export function reviveAvailability(rows: NewsCatalogue["availability"]): Map<string, NewsAvailability> {
  return new Map(rows.map(([id, a]) => [id, { available: a.available, total: a.total, name: a.name, town: a.town, publicUrl: a.en ? { en: a.en } : null }]));
}

/** developmentId → the partner's handover rate (null = on request). */
export function ratesById(projects: { id: string; handoverRate: number | null }[]): Map<string, number | null> {
  return new Map(projects.map((p) => [p.id, p.handoverRate]));
}
