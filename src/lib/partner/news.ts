// Automatic partner news (partner portal phase 4b). Pure, no DB access.
// Derived at request time from inventoryChanges() (last 30 days) plus the current availability.
// Only public catalogue information: project name (alias rule), town, prices the public page shows,
// the partner's own handover rate and the public link. Never the developer, our rate or unit data.
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import type { PartnerLocale } from "./i18n";
import { absoluteProjectUrl, localizedProjectUrl } from "./matchGlue";

export const NEWS_KINDS = ["new_project", "price_drop", "back_on_market", "nearly_sold_out"] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];
export const NEWS_MAX_ITEMS = 50;
export const NEARLY_SOLD_OUT_SHARE = 0.1;

export type NewsItem = {
  id: string;
  kind: NewsKind;
  at: Date;
  developmentId: string;
  name: string;
  town: string | null;
  priceFrom?: number;
  priceBefore?: number;
  /** The partner's handover rate in % of the price; null = on request. */
  rate: number | null;
  /** Absolute public project URL in the partner's language. */
  url: string;
};

/**
 * Current availability of a development. name/town/publicUrl (inventoryChanges' DevRef shape) are needed
 * only for developments without a change event in the window; otherwise the event's are used.
 */
export type NewsAvailability = {
  available: number;
  total: number;
  name?: string;
  town?: string | null;
  publicUrl?: unknown;
};

type Ref = { name: string; town: string | null; publicUrl: unknown };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function newsItems(input: {
  changes: ChangeEvent[];
  availability: Map<string, NewsAvailability>;
  rates: Map<string, number | null>;
  now: Date;
  locale?: PartnerLocale;
}): NewsItem[] {
  const locale = input.locale ?? "en";
  const refs = new Map<string, Ref>();
  const candidates: { kind: NewsKind; at: Date; developmentId: string; ref: Ref; priceFrom?: number; priceBefore?: number }[] = [];

  for (const ev of input.changes) {
    const ref: Ref = { name: ev.name, town: ev.location?.town ?? null, publicUrl: ev.publicUrl };
    if (!refs.has(ev.developmentId)) refs.set(ev.developmentId, ref);
    // Snapshot-based events only know "changed since the snapshot": date them by the snapshot.
    const at = ev.at ?? ev.since ?? input.now;
    if (ev.type === "published") candidates.push({ kind: "new_project", at, developmentId: ev.developmentId, ref });
    else if (ev.type === "back_on_market") candidates.push({ kind: "back_on_market", at, developmentId: ev.developmentId, ref });
    else if (ev.type === "price_from_changed") {
      const from = num(ev.from);
      const to = num(ev.to);
      if (from != null && to != null && to < from) candidates.push({ kind: "price_drop", at, developmentId: ev.developmentId, ref, priceFrom: to, priceBefore: from });
    }
  }

  input.availability.forEach((a, developmentId) => {
    if (!(a.total > 0 && a.available >= 1 && a.available / a.total <= NEARLY_SOLD_OUT_SHARE)) return;
    const ref = refs.get(developmentId) ?? (a.name ? { name: a.name, town: a.town ?? null, publicUrl: a.publicUrl } : null);
    if (ref) candidates.push({ kind: "nearly_sold_out", at: input.now, developmentId, ref });
  });

  // One item per development and kind: the newest.
  const best = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    const key = `${c.kind}:${c.developmentId}`;
    const prev = best.get(key);
    if (!prev || c.at.getTime() > prev.at.getTime()) best.set(key, c);
  }

  const items: NewsItem[] = [];
  best.forEach((c, id) => {
    const en = absoluteProjectUrl(c.ref.publicUrl);
    if (!en) return; // not a public page
    items.push({
      id,
      kind: c.kind,
      at: c.at,
      developmentId: c.developmentId,
      name: c.ref.name,
      town: c.ref.town,
      ...(c.priceFrom != null ? { priceFrom: c.priceFrom } : {}),
      ...(c.priceBefore != null ? { priceBefore: c.priceBefore } : {}),
      rate: input.rates.get(c.developmentId) ?? null,
      url: localizedProjectUrl(en, locale),
    });
  });
  return items
    .sort((a, b) => b.at.getTime() - a.at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, NEWS_MAX_ITEMS);
}

/** Items strictly newer than seenAt; all of them when the partner never opened the news. */
export function unreadCount(items: { at: Date }[], seenAt: Date | null): number {
  if (!seenAt) return items.length;
  return items.filter((i) => i.at.getTime() > seenAt.getTime()).length;
}
