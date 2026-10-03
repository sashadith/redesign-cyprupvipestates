// Social referral traffic per article for blog_social_traffic (2026-10-03).
// Counts page_views the way the admin Analytics page does — the same
// NOT_EXCLUDED clause (isBot/isPrefetch/isTest false; isBot covers both the
// ingestion UA check and the nightly hyperactive-session backfill) — never raw
// rows. Referrers are stored as bare hostnames at ingestion, so classification
// is a dot-suffix match on the network's domains. UTM is NOT stored per page
// view (the query string is stripped at ingestion), so the only UTM signal is
// the lead's first-touch attribution: reported separately and named for what
// it is — leads, not visits.
import { prisma } from "@/lib/prisma";
import { BLOG_LOCALES, groupArticles, anchorRow, isBlogLocale, type ArticleRow, type BlogLocale } from "./articleUrls";

export type Network = "linkedin" | "x";
const NETWORK_DOMAINS: Record<Network, string[]> = {
  linkedin: ["linkedin.com", "lnkd.in"],
  x: ["x.com", "twitter.com", "t.co"],
};
const UTM_SOURCES: Record<Network, string[]> = { linkedin: ["linkedin"], x: ["x", "twitter"] };

const NOT_EXCLUDED = { isBot: false, isPrefetch: false, isTest: false } as const; // same as admin/(panel)/analytics/page.tsx
export const MAX_RANGE_DAYS = 365;

const underDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Which network a stored referrer hostname belongs to, if any. Exact host or a subdomain — never a bare string suffix (box.com ≠ x.com). */
export function classifyReferrer(referrer: string | null | undefined): Network | null {
  const host = (referrer ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  for (const [network, domains] of Object.entries(NETWORK_DOMAINS) as [Network, string[]][]) {
    if (domains.some((d) => underDomain(host, d))) return network;
  }
  return null;
}

export function classifyUtmSource(utmSource: string | null | undefined): Network | null {
  const s = (utmSource ?? "").trim().toLowerCase();
  if (!s) return null;
  for (const [network, names] of Object.entries(UTM_SOURCES) as [Network, string[]][]) if (names.includes(s)) return network;
  return null;
}

/** "/blog/<slug>" → en; "/<locale>/blog/<slug>" → that locale. Anything else → null. */
export function blogPathInfo(path: string): { locale: BlogLocale; slug: string } | null {
  const m = path.match(/^\/(?:([a-z]{2})\/)?blog\/([^/?#]+)\/?$/);
  if (!m) return null;
  const locale = m[1] ?? "en";
  if (!isBlogLocale(locale)) return null;
  if (m[1] === "en") return null; // the site never serves /en/blog/…
  return { locale, slug: m[2] };
}

export type NetworkCount = { visits: number; uniqueVisitors: number };
export type ArticleTraffic = {
  slug: string;
  title: string | null;
  linkedin: NetworkCount;
  x: NetworkCount;
  byLocale: Partial<Record<BlogLocale, { linkedin: NetworkCount; x: NetworkCount }>>;
  leadsWithFirstTouchUtm: { linkedin: number; x: number };
};
export type SocialTrafficResult = {
  range: { from: Date; to: Date };
  articles: ArticleTraffic[];
  totals: { linkedin: NetworkCount; x: NetworkCount; leadsWithFirstTouchUtm: { linkedin: number; x: number } };
  notes: string[];
};

type Acc = { visits: number; hashes: Set<string> };
const acc = (): Acc => ({ visits: 0, hashes: new Set() });
const count = (a: Acc): NetworkCount => ({ visits: a.visits, uniqueVisitors: a.hashes.size });

export async function socialTraffic(params: { from: Date; to: Date; slug?: string }): Promise<SocialTrafficResult> {
  const { from, to } = params;
  const articleRows = (await prisma.blog.findMany({
    where: { status: "PUBLISHED", language: { in: [...BLOG_LOCALES] } },
    select: { id: true, language: true, slug: true, title: true, status: true, seo: true, publishedAt: true, updatedAt: true, translationGroupId: true },
  })) as ArticleRow[];
  const groups = groupArticles(articleRows);
  const groupByLocaleSlug = new Map<string, (typeof groups)[number]>();
  for (const g of groups) for (const r of g.rows) groupByLocaleSlug.set(`${r.language}:${r.slug}`, g);

  const selected = params.slug ? groups.filter((g) => g.rows.some((r) => r.slug === params.slug)) : groups;
  const selectedKeys = new Set(selected.map((g) => g.key));

  const views = await prisma.pageView.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...NOT_EXCLUDED,
      path: { contains: "/blog/" },
      OR: [...NETWORK_DOMAINS.linkedin, ...NETWORK_DOMAINS.x].map((d) => ({ referrer: { endsWith: d } })),
    },
    select: { path: true, referrer: true, visitorHash: true },
  });

  type Per = { all: Record<Network, Acc>; byLocale: Map<BlogLocale, Record<Network, Acc>>; utm: Record<Network, number> };
  const per = new Map<string, Per>();
  const perOf = (key: string): Per => {
    let p = per.get(key);
    if (!p) { p = { all: { linkedin: acc(), x: acc() }, byLocale: new Map(), utm: { linkedin: 0, x: 0 } }; per.set(key, p); }
    return p;
  };
  const totals = { linkedin: acc(), x: acc() };

  for (const v of views) {
    const network = classifyReferrer(v.referrer);
    const info = blogPathInfo(v.path);
    if (!network || !info) continue;
    const g = groupByLocaleSlug.get(`${info.locale}:${info.slug}`);
    if (!g || !selectedKeys.has(g.key)) continue;
    const p = perOf(g.key);
    const hash = v.visitorHash ?? `anon:${Math.random()}`;
    p.all[network].visits++; p.all[network].hashes.add(hash);
    let loc = p.byLocale.get(info.locale);
    if (!loc) { loc = { linkedin: acc(), x: acc() }; p.byLocale.set(info.locale, loc); }
    loc[network].visits++; loc[network].hashes.add(hash);
    totals[network].visits++; totals[network].hashes.add(hash);
  }

  // Lead first-touch UTM — leads created in the range whose landing page was one of the article's locale paths.
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from, lte: to }, deletedAt: null, utmSource: { not: null }, pageSource: { contains: "/blog/" } },
    select: { utmSource: true, pageSource: true },
  });
  const utmTotals = { linkedin: 0, x: 0 };
  for (const l of leads) {
    const network = classifyUtmSource(l.utmSource);
    if (!network || !l.pageSource) continue;
    let path = l.pageSource;
    try { path = new URL(l.pageSource, "https://cyprusvipestates.com").pathname; } catch { /* keep as is */ }
    const info = blogPathInfo(path);
    if (!info) continue;
    const g = groupByLocaleSlug.get(`${info.locale}:${info.slug}`);
    if (!g || !selectedKeys.has(g.key)) continue;
    perOf(g.key).utm[network]++;
    utmTotals[network]++;
  }

  const articles: ArticleTraffic[] = selected
    .filter((g) => params.slug || per.has(g.key))
    .map((g) => {
      const p = perOf(g.key);
      const anchor = anchorRow(g);
      const byLocale: ArticleTraffic["byLocale"] = {};
      for (const [l, c] of Array.from(p.byLocale.entries())) byLocale[l] = { linkedin: count(c.linkedin), x: count(c.x) };
      return { slug: anchor.slug, title: anchor.title.trim() || null, linkedin: count(p.all.linkedin), x: count(p.all.x), byLocale, leadsWithFirstTouchUtm: { ...p.utm } };
    })
    .sort((a, b) => b.linkedin.visits + b.x.visits - (a.linkedin.visits + a.x.visits) || a.slug.localeCompare(b.slug));

  return {
    range: { from, to },
    articles,
    totals: { linkedin: count(totals.linkedin), x: count(totals.x), leadsWithFirstTouchUtm: utmTotals },
    notes: [
      "Visits/uniqueVisitors are page views with a LinkedIn (linkedin.com, lnkd.in) or X (x.com, twitter.com, t.co) referrer, bot/prefetch/test rows excluded exactly as in the admin Analytics page; uniqueVisitors = distinct daily-rotating visitor hashes, so a visitor on two days counts twice.",
      "UTM parameters are not stored per page view (the query string is stripped at ingestion). leadsWithFirstTouchUtm counts LEADS created in the range whose first-touch utm_source was linkedin / x / twitter and whose landing page was this article — lead counts, not traffic.",
    ],
  };
}
