import { leadTemperature, NO_TEMPERATURE_STATUSES, type Temperature, type TemperatureInput, type TemperatureResult } from "./temperature";

// Pure helpers around the temperature scorer (CRM v2 phase 4a, Task 2): no DB, unit-tested.

export const TEMPERATURE_ID_CHUNK = 1000;

export type TemperatureLead = {
  id: string; status: string; timeline: string | null; budgetMin: number | null; budgetMax: number | null; createdAt: Date;
};

/** What client components get: never the score or the raw signals. */
export type PublicTemperature = { level: Temperature; reasons: string[] };

export type TemperatureSignals = {
  lastInboundAt?: Date | null; lastRealContactAt?: Date | null; lastPresentationViewAt?: Date | null; lastFavoriteAt?: Date | null;
};

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function hasTemperature(status: string): boolean {
  return !(NO_TEMPERATURE_STATUSES as readonly string[]).includes(status);
}

/** Leads that can carry a temperature, deduplicated by id. */
export function leadsNeedingTemperature(leads: TemperatureLead[]): TemperatureLead[] {
  const seen = new Set<string>();
  return leads.filter((l) => {
    if (!hasTemperature(l.status) || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
}

export function toTemperatureInput(lead: TemperatureLead, s: TemperatureSignals): TemperatureInput {
  return {
    status: lead.status, timeline: lead.timeline, budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, createdAt: lead.createdAt,
    lastInboundAt: s.lastInboundAt ?? null, lastRealContactAt: s.lastRealContactAt ?? null,
    lastPresentationViewAt: s.lastPresentationViewAt ?? null, lastFavoriteAt: s.lastFavoriteAt ?? null,
  };
}

export function scoreLead(lead: TemperatureLead, s: TemperatureSignals, now: Date): TemperatureResult | null {
  return leadTemperature(toTemperatureInput(lead, s), now);
}

export function toPublicTemperature(t: TemperatureResult | null | undefined): PublicTemperature | null {
  return t ? { level: t.level, reasons: [...t.reasons] } : null;
}

const LEVEL_NAME: Record<Temperature, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };
export const temperatureLabel = (level: Temperature): string => LEVEL_NAME[level];

/** "Hot lead — Replied 2 days ago, Viewing scheduled" (accessible name and tooltip). */
export function temperatureText(t: PublicTemperature): string {
  return t.reasons.length ? `${LEVEL_NAME[t.level]} lead — ${t.reasons.join(", ")}` : `${LEVEL_NAME[t.level]} lead`;
}

const RANK: Record<Temperature, number> = { hot: 0, warm: 1, cold: 2 };
const rank = (t: { level: Temperature } | null | undefined) => (t ? RANK[t.level] : 3);

/** hot → warm → cold → none; stable within each group (input order kept). New array. */
export function sortByTemperature<T>(items: T[], temp: (item: T) => { level: Temperature } | null | undefined): T[] {
  return items.map((item, i) => ({ item, i, r: rank(temp(item)) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.item);
}
