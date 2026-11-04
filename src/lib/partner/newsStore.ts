// Partner news data access (phase 4b, Decision 7): partner-independent catalogue part cached for an hour
// (tag "partner-news"), the partner's own rates and newsSeenAt merged per request. Server only.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { inventoryChanges } from "@/lib/crm/inventoryChanges";
import { publicUrlFor } from "@/lib/crm/inventorySearch";
import { computeAvailability } from "@/lib/developmentAvailability";
import type { PartnerLocale } from "./i18n";
import { newsItems, unreadCount, type NewsItem } from "./news";
import { ratesById, reviveAvailability, reviveEvents, slimEvents, type NewsCatalogue } from "./newsFlow";
import { myProjects } from "./scope";

export const NEWS_TAG = "partner-news";

async function loadCatalogue(): Promise<NewsCatalogue> {
  const now = new Date();
  const [changes, devs] = await Promise.all([
    inventoryChanges({ days: 30, now, types: ["published", "back_on_market", "price_from_changed"], limit: 500 }),
    prisma.development.findMany({
      where: { publishStatus: "published" },
      select: { id: true, publicName: true, town: true, slug: true, publishStatus: true, override: { select: { alias: true, town: true } }, units: { select: { status: true } } },
    }),
  ]);
  const availability: NewsCatalogue["availability"] = devs.map((d) => {
    const a = computeAvailability(d.units);
    const url = publicUrlFor(d.slug, d.publishStatus);
    return [d.id, { available: a.available, total: a.total, name: d.override?.alias || d.publicName, town: d.override?.town || d.town || null, en: url?.en ?? null }];
  });
  return { events: slimEvents(changes.events), availability };
}

const cachedCatalogue = unstable_cache(loadCatalogue, ["partner-news-catalogue-v1"], { revalidate: 3600, tags: [NEWS_TAG] });

/** News for one partner: newest first, rates merged in. */
export async function partnerNews(partnerId: string, locale: PartnerLocale): Promise<NewsItem[]> {
  const [cat, mine] = await Promise.all([cachedCatalogue(), myProjects(partnerId)]);
  return newsItems({
    changes: reviveEvents(cat.events), availability: reviveAvailability(cat.availability),
    rates: ratesById(mine.projects), now: new Date(), locale,
  });
}

/** Unread badge count; 0 on any failure (the nav must never break because of news). */
export async function partnerNewsUnread(partnerId: string): Promise<number> {
  try {
    const [cat, partner] = await Promise.all([
      cachedCatalogue(),
      prisma.partner.findUnique({ where: { id: partnerId }, select: { newsSeenAt: true } }),
    ]);
    const items = newsItems({ changes: reviveEvents(cat.events), availability: reviveAvailability(cat.availability), rates: new Map(), now: new Date() });
    return unreadCount(items, partner?.newsSeenAt ?? null);
  } catch (e) {
    console.error("[partner] news unread unavailable", e instanceof Error ? e.message : "unknown");
    return 0;
  }
}
