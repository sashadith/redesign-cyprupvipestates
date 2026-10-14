// Social referral traffic per article for blog_social_traffic (2026-10-03).
// Counts page_views the way the admin Analytics page does — the same
// NOT_EXCLUDED clause (isBot/isPrefetch/isTest false; isBot covers both the
// ingestion UA check and the nightly hyperactive-session backfill) — never raw
// rows. Referrers are stored as bare hostnames at ingestion, so classification
// is a dot-suffix match on the network's domains.
//
// 2026-10-14: page views also carry utm_source / utm_medium / utm_campaign
// (src/lib/analytics/pageViewUtm.ts). A view WITH any of them is attributed by
// UTM only (utm.bySource / utm.byCampaign) and does not count in the referrer
// groups; a view without UTM — every row from before that date included — is
// attributed by referrer exactly as before. Lead first-touch UTM is still
// reported separately and named for what it is — leads, not visits.
import { prisma } from "@/lib/prisma";
import { hasUtm } from "@/lib/analytics/pageViewUtm";
import { BLOG_LOCALES, groupArticles, anchorRow, isBlogLocale, type ArticleRow, type BlogLocale } from "./articleUrls";

export const NETWORKS = ["linkedin", "x", "threads", "bluesky", "substack"] as const;
export type Network = (typeof NETWORKS)[number];
const NETWORK_DOMAINS: Record<Network, string[]> = {
  linkedin: ["linkedin.com", "lnkd.in"],
  x: ["x.com", "twitter.com", "t.co"],
  threads: ["threads.com", "threads.net"], // l.threads.com (link shim) is a subdomain
  bluesky: ["bsky.app"], // go.bsky.app (link shortener) is a subdomain
  substack: ["substack.com"], // every publication lives on <name>.substack.com
};
// Android apps send an android-app://<package>/ referrer; ingestion keeps the
// "host" part, i.e. the package name (seen in production: com.linkedin.android).
const APP_HOSTS: Record<Network, string[]> = {
  linkedin: ["com.linkedin.android"],
  x: ["com.twitter.android", "com.x.android"],
  threads: ["com.instagram.barcelona"],
  bluesky: ["xyz.blueskyweb.app"],
  substack: ["com.substack.app"],
};
const UTM_SOURCES: Record<Network, string[]> = {
  linkedin: ["linkedin"],
  x: ["x", "twitter"],
  threads: ["threads"],
  bluesky: ["bluesky", "bsky"],
  substack: ["substack"],
};

const NOT_EXCLUDED = { isBot: false, isPrefetch: false, isTest: false } as const; // same as admin/(panel)/analytics/page.tsx
export const MAX_RANGE_DAYS = 365;

const underDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Which network a stored referrer hostname belongs to, if any. Exact host or a subdomain — never a bare string suffix (box.com ≠ x.com). */
export function classifyReferrer(referrer: string | null | undefined): Network | null {
  const host = (referrer ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!host) return null;
  for (const [network, domains] of Object.entries(NETWORK_DOMAINS) as [Network, string[]][]) {
    if (domains.some((d) => underDomain(host, d)) || APP_HOSTS[network].includes(host)) return network;
  }
  return null;
}

export function classifyUtmSource(utmSource: string | null | undefined): Network | null {
  const s = (utmSource ?? "").trim().toLowerCase();
  if (!s) return null;
  for (const [network, names] of Object.entries(UTM_SOURCES) as [Network, string[]][]) if (names.includes(s)) return network;
  return null;
}

/** "/blog/<slug>" → en; "/<locale>/blog/<slug>" → that locale. "/en/blog/<slug>" is
 *  accepted as en too: the site redirects it, but a lead's recorded landing
 *  page (Lead.pageSource) can still carry that legacy prefix. Anything else → null. */
export function blogPathInfo(path: string): { locale: BlogLocale; slug: string } | null {
  const m = path.match(/^\/(?:([a-z]{2})\/)?blog\/([^/?#]+)\/?$/);
  if (!m) return null;
  const locale = m[1] ?? "en";
  if (!isBlogLocale(locale)) return null;
  return { locale, slug: m[2] };
}

export type NetworkCount = { visits: number; uniqueVisitors: number };
export type NetworkCounts = Record<Network, NetworkCount>;
export type UtmBreakdown = { bySource: Record<string, NetworkCount>; byCampaign: Record<string, NetworkCount> };
export type ArticleTraffic = {
  slug: string;
  title: string | null;
} & NetworkCounts & {
  byLocale: Partial<Record<BlogLocale, NetworkCounts>>;
  utm: UtmBreakdown;
  leadsWithFirstTouchUtm: Record<Network, number>;
};
export type SocialTrafficResult = {
  range: { from: Date; to: Date };
  articles: ArticleTraffic[];
  totals: NetworkCounts & { utm: UtmBreakdown; leadsWithFirstTouchUtm: Record<Network, number> };
  notes: string[];
};

type Acc = { visits: number; hashes: Set<string> };
const acc = (): Acc => ({ visits: 0, hashes: new Set() });
const count = (a: Acc): NetworkCount => ({ visits: a.visits, uniqueVisitors: a.hashes.size });
const accs = (): Record<Network, Acc> => Object.fromEntries(NETWORKS.map((n) => [n, acc()])) as Record<Network, Acc>;
const counts = (r: Record<Network, Acc>): NetworkCounts => Object.fromEntries(NETWORKS.map((n) => [n, count(r[n])])) as NetworkCounts;
const zeros = (): Record<Network, number> => Object.fromEntries(NETWORKS.map((n) => [n, 0])) as Record<Network, number>;

/** Grouping key for a UTM value: case-insensitive, "(not set)" when absent. */
export const NOT_SET = "(not set)";
export const utmKey = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase() || NOT_SET;

type UtmAcc = { bySource: Map<string, Acc>; byCampaign: Map<string, Acc> };
const utmAcc = (): UtmAcc => ({ bySource: new Map(), byCampaign: new Map() });
const bump = (m: Map<string, Acc>, key: string, hash: string) => {
  let a = m.get(key);
  if (!a) { a = acc(); m.set(key, a); }
  a.visits++; a.hashes.add(hash);
};
const utmOut = (u: UtmAcc): UtmBreakdown => ({
  bySource: Object.fromEntries(Array.from(u.bySource, ([k, a]) => [k, count(a)])),
  byCampaign: Object.fromEntries(Array.from(u.byCampaign, ([k, a]) => [k, count(a)])),
});

export type ViewRow = {
  path: string;
  referrer: string | null;
  visitorHash: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};
export type ViewAggregate = {
  perArticle: Map<string, { all: Record<Network, Acc>; byLocale: Map<BlogLocale, Record<Network, Acc>>; utm: UtmAcc }>;
  totals: { all: Record<Network, Acc>; utm: UtmAcc };
};

/** PURE. Attributes each blog page view once: by UTM when it carries any
 *  utm_* tag, otherwise by its referrer's network (or not at all).
 *  `articleKeyOf` maps (locale, slug) to the article group, null = not counted. */
export function aggregateViews(
  views: ViewRow[],
  articleKeyOf: (locale: BlogLocale, slug: string) => string | null,
): ViewAggregate {
  const perArticle: ViewAggregate["perArticle"] = new Map();
  const totals = { all: accs(), utm: utmAcc() };
  const perOf = (key: string) => {
    let p = perArticle.get(key);
    if (!p) { p = { all: accs(), byLocale: new Map(), utm: utmAcc() }; perArticle.set(key, p); }
    return p;
  };
  for (const v of views) {
    const info = blogPathInfo(v.path);
    if (!info) continue;
    const key = articleKeyOf(info.locale, info.slug);
    if (!key) continue;
    const hash = v.visitorHash ?? `anon:${Math.random()}`;
    if (hasUtm(v)) {
      const p = perOf(key);
      for (const u of [p.utm, totals.utm]) {
        bump(u.bySource, utmKey(v.utmSource), hash);
        bump(u.byCampaign, utmKey(v.utmCampaign), hash);
      }
      continue;
    }
    const network = classifyReferrer(v.referrer);
    if (!network) continue;
    const p = perOf(key);
    p.all[network].visits++; p.all[network].hashes.add(hash);
    let loc = p.byLocale.get(info.locale);
    if (!loc) { loc = accs(); p.byLocale.set(info.locale, loc); }
    loc[network].visits++; loc[network].hashes.add(hash);
    totals.all[network].visits++; totals.all[network].hashes.add(hash);
  }
  return { perArticle, totals };
}

const visitsOf = (a: ArticleTraffic) =>
  NETWORKS.reduce((n, k) => n + a[k].visits, 0) + Object.values(a.utm.bySource).reduce((n, c) => n + c.visits, 0);

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
  const articleKeyOf = (locale: BlogLocale, slug: string) => {
    const g = groupByLocaleSlug.get(`${locale}:${slug}`);
    return g && selectedKeys.has(g.key) ? g.key : null;
  };

  const views = await prisma.pageView.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...NOT_EXCLUDED,
      path: { contains: "/blog/" },
      OR: [
        ...NETWORKS.flatMap((n) => NETWORK_DOMAINS[n]).map((d) => ({ referrer: { endsWith: d } })),
        ...NETWORKS.flatMap((n) => APP_HOSTS[n]).map((h) => ({ referrer: h })),
        { utmSource: { not: null } },
        { utmMedium: { not: null } },
        { utmCampaign: { not: null } },
      ],
    },
    select: { path: true, referrer: true, visitorHash: true, utmSource: true, utmMedium: true, utmCampaign: true },
  });
  const agg = aggregateViews(views, articleKeyOf);

  // Lead first-touch UTM — leads created in the range whose landing page was one of the article's locale paths.
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from, lte: to }, deletedAt: null, utmSource: { not: null }, pageSource: { contains: "/blog/" } },
    select: { utmSource: true, pageSource: true },
  });
  const leadsPer = new Map<string, Record<Network, number>>();
  const utmTotals = zeros();
  for (const l of leads) {
    const network = classifyUtmSource(l.utmSource);
    if (!network || !l.pageSource) continue;
    let path = l.pageSource;
    try { path = new URL(l.pageSource, "https://cyprusvipestates.com").pathname; } catch { /* keep as is */ }
    const info = blogPathInfo(path);
    if (!info) continue;
    const key = articleKeyOf(info.locale, info.slug);
    if (!key) continue;
    const r = leadsPer.get(key) ?? zeros();
    r[network]++;
    leadsPer.set(key, r);
    utmTotals[network]++;
  }

  const articles: ArticleTraffic[] = selected
    .filter((g) => params.slug || agg.perArticle.has(g.key) || leadsPer.has(g.key))
    .map((g) => {
      const p = agg.perArticle.get(g.key);
      const anchor = anchorRow(g);
      const byLocale: ArticleTraffic["byLocale"] = {};
      if (p) for (const [l, c] of Array.from(p.byLocale.entries())) byLocale[l] = counts(c);
      return {
        slug: anchor.slug,
        title: anchor.title.trim() || null,
        ...counts(p?.all ?? accs()),
        byLocale,
        utm: utmOut(p?.utm ?? utmAcc()),
        leadsWithFirstTouchUtm: leadsPer.get(g.key) ?? zeros(),
      };
    })
    .sort((a, b) => visitsOf(b) - visitsOf(a) || a.slug.localeCompare(b.slug));

  return {
    range: { from, to },
    articles,
    totals: { ...counts(agg.totals.all), utm: utmOut(agg.totals.utm), leadsWithFirstTouchUtm: utmTotals },
    notes: [
      "linkedin / x / threads / bluesky / substack are page views WITHOUT any UTM tag whose referrer was that network (linkedin.com, lnkd.in; x.com, twitter.com, t.co; threads.com, threads.net; bsky.app; substack.com and *.substack.com; plus each network's Android app), bot/prefetch/test rows excluded exactly as in the admin Analytics page. uniqueVisitors = distinct daily-rotating visitor hashes, so a visitor on two days counts twice.",
      "utm.bySource / utm.byCampaign are page views that carried utm_source, utm_medium or utm_campaign (stored per page view since 2026-10-14; keys lowercased, \"(not set)\" when that tag was absent). A tagged view counts ONLY there, never also in its referrer group. Views before 2026-10-14 carry no UTM and are attributed by referrer.",
      "leadsWithFirstTouchUtm counts LEADS created in the range whose first-touch utm_source named the network and whose landing page was this article — lead counts, not traffic.",
    ],
  };
}
