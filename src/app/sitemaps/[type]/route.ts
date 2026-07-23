import {
  getAllProjectsByLang,
  getAllDevelopersByLang,
  getAllPathsForLang,
  getBlogPostsByLang,
  getCaseStudiesByLang,
} from "@/sanity/sanity.utils";
import { localePrefix, localizedHref } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { urlFor } from "@/sanity/sanity.client";
import { NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";

const websiteUrl = "https://cyprusvipestates.com";
const langs = ["de", "pl", "en", "ru"] as const;
const sitemapTypes = [
  "projects",
  "blog",
  "pages",
  "developers",
  "case-studies",
  "developments",
] as const;

type Lang = (typeof langs)[number];
type SitemapType = (typeof sitemapTypes)[number];

type Alt = { hreflang: string; href: string };
type SitemapPage = {
  route: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  lastmod?: string;
  alternates?: Alt[];
  image?: string; // absolute or site-relative URL of the page's primary image
};

// Resolve a content image object to a site-relative /uploads path (urlFor), for image sitemaps.
function imageUrlOf(img: any): string | undefined {
  if (!img) return undefined;
  const u = urlFor(img).url();
  return u || undefined;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeRoute(route: string) {
  return route.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function buildUrl(route: string) {
  const normalized = normalizeRoute(route);
  return `${websiteUrl}${normalized === "/" ? "/" : normalized}`;
}

function toIsoDate(value?: string) {
  if (!value) return new Date().toISOString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function isSitemapType(value: string): value is SitemapType {
  return sitemapTypes.includes(value as SitemapType);
}

// hreflang alternates for the 4 language versions of a fixed listing path (e.g. "blog").
function listingAlts(segment: string): Alt[] {
  const alts: Alt[] = langs.map((l) => ({ hreflang: l, href: buildUrl(localizedHref(l, segment)) }));
  alts.push({ hreflang: "x-default", href: buildUrl(localizedHref("en", segment)) });
  return alts;
}

// Build a "lang|slug" -> hreflang-alternates index for a detail type, grouped by
// translationGroupId. Only PUBLISHED rows (matching what the sitemap includes); groups with a
// single language get no alternates (a self-only hreflang is pointless).
const ALT_CFG: Record<string, { model: any; seg: string; status: boolean; nested?: boolean }> = {
  projects: { model: prisma.project, seg: "projects", status: true },
  blog: { model: prisma.blog, seg: "blog", status: true },
  "case-studies": { model: prisma.caseStudy, seg: "case-studies", status: true },
  developers: { model: prisma.developer, seg: "developers", status: false },
  // singlepages can nest via parentSanityId, so their canonical URL is a parent/child path,
  // not a flat "/slug" — alternates must use the resolved nested path (see segsFor below).
  pages: { model: prisma.singlepage, seg: "", status: true, nested: true },
};
// x-default precedence: prefer English, otherwise fall back deterministically so groups with no
// English version still advertise an x-default (Google recommends one even for non-EN defaults).
const XDEFAULT_ORDER = ["en", "de", "pl", "ru"] as const;

async function buildAltIndex(typeKey: string): Promise<Map<string, Alt[]>> {
  const cfg = ALT_CFG[typeKey];
  const rows: any[] = await cfg.model.findMany({
    where: { slug: { not: "" }, ...(cfg.status ? { status: "PUBLISHED" } : {}) },
    select: { language: true, slug: true, translationGroupId: true, ...(cfg.nested ? { sanityId: true, parentSanityId: true } : {}) },
  });

  // Resolve a row to its full path segments. Detail types are always single-segment
  // ("/{seg}/{slug}"); nested singlepages walk their parentSanityId chain (within a language) so
  // the hreflang alternate points at the real nested canonical URL, not a flat "/slug" duplicate.
  let segsFor: (r: any) => string[];
  if (cfg.nested) {
    const nodeByLang = new Map<string, Map<string, any>>();
    for (const r of rows) {
      if (!nodeByLang.has(r.language)) nodeByLang.set(r.language, new Map());
      nodeByLang.get(r.language)!.set(r.sanityId, r);
    }
    segsFor = (r) => {
      const nodes = nodeByLang.get(r.language)!;
      const out: string[] = [];
      const seen = new Set<string>();
      let cur: any = r;
      while (cur && cur.slug && !seen.has(cur.sanityId)) {
        seen.add(cur.sanityId);
        out.unshift(cur.slug);
        cur = cur.parentSanityId ? nodes.get(cur.parentSanityId) : undefined;
      }
      return out;
    };
  } else {
    segsFor = (r) => [cfg.seg, r.slug];
  }

  const groups = new Map<string, any[]>();
  for (const r of rows) {
    if (!r.translationGroupId) continue;
    (groups.get(r.translationGroupId) ?? groups.set(r.translationGroupId, []).get(r.translationGroupId)!).push(r);
  }
  const index = new Map<string, Alt[]>();
  for (const members of Array.from(groups.values())) {
    if (members.length < 2) continue;
    const langMember: Record<string, any> = {};
    for (const m of members) if (!langMember[m.language]) langMember[m.language] = m;
    const alts: Alt[] = Object.values(langMember).map((m) => ({ hreflang: m.language, href: buildUrl(localizedHref(m.language, segsFor(m))) }));
    const xdLang = XDEFAULT_ORDER.find((l) => langMember[l]);
    if (xdLang) alts.push({ hreflang: "x-default", href: buildUrl(localizedHref(xdLang, segsFor(langMember[xdLang]))) });
    for (const m of members) index.set(`${m.language}|${m.slug}`, alts);
  }
  return index;
}

async function generateProjectsSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  const altIdx = await buildAltIndex("projects");

  for (const lang of langs) {
    // English (default) is prefix-less; de/pl/ru are prefixed.
    const prefix = localePrefix(lang);

    pages.push({
      route: `${prefix}/projects`,
      changefreq: "weekly",
      priority: 0.8,
      alternates: listingAlts("projects"),
    });

    const projects = await getAllProjectsByLang(lang);

    projects.forEach((proj) => {
      const slug = proj.slug?.[lang]?.current;
      if (!slug) return;

      pages.push({
        route: `${prefix}/projects/${slug}`,
        changefreq: "weekly",
        priority: 0.6,
        lastmod: proj._updatedAt,
        alternates: altIdx.get(`${lang}|${slug}`),
        image: imageUrlOf((proj as any).previewImage),
      });
    });
  }

  return pages;
}

async function generateDevelopersSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  const altIdx = await buildAltIndex("developers");

  for (const lang of langs) {
    // English (default) is prefix-less; de/pl/ru are prefixed.
    const prefix = localePrefix(lang);

    pages.push({
      route: `${prefix}/developers`,
      changefreq: "weekly",
      priority: 0.7,
      alternates: listingAlts("developers"),
    });

    const developers = await getAllDevelopersByLang(lang);

    developers.forEach((dev) => {
      const slug = dev.slug?.[lang]?.current;
      if (!slug) return;

      pages.push({
        route: `${prefix}/developers/${slug}`,
        changefreq: "weekly",
        priority: 0.6,
        lastmod: dev._updatedAt,
        alternates: altIdx.get(`${lang}|${slug}`),
      });
    });
  }

  return pages;
}

async function generateBlogSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  const altIdx = await buildAltIndex("blog");

  for (const lang of langs) {
    // English (default) is prefix-less; de/pl/ru are prefixed.
    const prefix = localePrefix(lang);

    pages.push({
      route: `${prefix}/blog`,
      changefreq: "weekly",
      priority: 0.8,
      alternates: listingAlts("blog"),
    });

    const posts = await getBlogPostsByLang(lang);

    posts.forEach((post) => {
      const slug = post.slug?.[lang]?.current;
      if (!slug) return;

      pages.push({
        route: `${prefix}/blog/${slug}`,
        changefreq: "weekly",
        priority: 0.7,
        lastmod: post._updatedAt,
        alternates: altIdx.get(`${lang}|${slug}`),
        image: imageUrlOf((post as any).previewImage),
      });
    });
  }

  return pages;
}

async function generatePagesSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  const altIdx = await buildAltIndex("pages");

  for (const lang of langs) {
    // English (default) home is "/"; de/pl/ru are "/de" etc. Homepage exists in all 4 languages.
    pages.push({
      route: localizedHref(lang),
      changefreq: "weekly",
      priority: 1.0,
      alternates: listingAlts(""),
    });

    // /partners: a single fixed page (preview-partners/[lang]/page.tsx), not
    // Singlepage-backed, so it never comes from getAllPathsForLang below —
    // added here explicitly now that it's indexable (see that route's
    // layout.tsx for the noindex removal this pairs with).
    pages.push({
      route: localizedHref(lang, "partners"),
      changefreq: "monthly",
      priority: 0.6,
      alternates: listingAlts("partners"),
    });

    const allPaths = await getAllPathsForLang(lang);

    allPaths
      .filter((segments) => Array.isArray(segments) && segments.length > 0)
      .forEach((segments) => {
        const route = localizedHref(lang, segments);

        pages.push({
          route,
          changefreq: "weekly",
          priority: segments.length === 1 ? 0.8 : 0.7,
          // Index is keyed by leaf slug; nested pages (parent/child) get hreflang too, matching
          // the alternates their HTML already emits.
          alternates: altIdx.get(`${lang}|${segments[segments.length - 1]}`),
        });
      });
  }

  return pages;
}

async function generateCaseStudiesSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  const altIdx = await buildAltIndex("case-studies");

  for (const lang of langs) {
    // English (default) is prefix-less; de/pl/ru are prefixed.
    const prefix = localePrefix(lang);

    pages.push({
      route: `${prefix}/case-studies`,
      changefreq: "weekly",
      priority: 0.8,
      alternates: listingAlts("case-studies"),
    });

    const caseStudies = await getCaseStudiesByLang(lang);

    caseStudies.forEach((caseStudy) => {
      const slug = caseStudy.slug?.[lang]?.current;
      if (!slug) return;

      pages.push({
        route: `${prefix}/case-studies/${slug}`,
        changefreq: "weekly",
        priority: 0.7,
        lastmod: caseStudy._updatedAt,
        alternates: altIdx.get(`${lang}|${slug}`),
        image: imageUrlOf((caseStudy as any).previewImage),
      });
    });
  }

  return pages;
}

// New Development pipeline (Prisma-only, no Sanity row — a single Development
// serves all 4 languages via the [lang] route param, unlike the per-language
// Sanity content types above). Gated behind NEW_PROJECTS_INDEXABLE, same flag
// src/app/[lang]/projects/[slug]/page.tsx uses for its own robots meta — while
// the flag is off, this returns zero pages, so the sitemap route exists and
// is wired up but advertises nothing yet. Lives at /projects/[slug], the same
// path legacy Project pages use (cutover 2026-07-17) — see that page's
// dispatch-order comment for the collision rule.
async function generateDevelopmentsSitemap(): Promise<SitemapPage[]> {
  if (!NEW_PROJECTS_INDEXABLE) return [];

  const developments = await prisma.development.findMany({
    where: { publishStatus: "published", slug: { not: null } },
    select: { slug: true, updatedAt: true, gallery: true },
  });

  const pages: SitemapPage[] = [];
  for (const dev of developments) {
    if (!dev.slug) continue;
    const alternates: Alt[] = langs.map((l) => ({
      hreflang: l,
      href: buildUrl(localizedHref(l, ["projects", dev.slug!])),
    }));
    alternates.push({ hreflang: "x-default", href: buildUrl(localizedHref("en", ["projects", dev.slug!])) });

    const gallery = Array.isArray(dev.gallery) ? (dev.gallery as unknown as string[]) : [];

    for (const lang of langs) {
      const prefix = localePrefix(lang);
      pages.push({
        route: `${prefix}/projects/${dev.slug}`,
        changefreq: "weekly",
        priority: 0.6,
        lastmod: dev.updatedAt?.toISOString(),
        alternates,
        image: gallery[0],
      });
    }
  }
  return pages;
}

async function generateSitemap(type: SitemapType) {
  if (type === "projects") return generateProjectsSitemap();
  if (type === "developers") return generateDevelopersSitemap();
  if (type === "blog") return generateBlogSitemap();
  if (type === "case-studies") return generateCaseStudiesSitemap();
  if (type === "pages") return generatePagesSitemap();
  if (type === "developments") return generateDevelopmentsSitemap();

  return [];
}

// Per-process, in-module cache (PM2 runs this app in 2-instance cluster mode,
// so each instance holds its own copy — accepted trade-off, still a large win
// over zero caching, no shared-cache infra introduced). Plain `export const
// revalidate` does NOT cache this route (empirically verified: dynamic [type]
// segment + Prisma, not fetch — 4 sequential requests each independently
// regenerated). Time-based only, no revalidateTag / admin wiring.
type CacheEntry = { pages: SitemapPage[]; generatedAt: number };
const sitemapCache = new Map<SitemapType, CacheEntry>();
const REVALIDATE_MS = 3600 * 1000;

// Never serve an empty sitemap: a 200 with zero URLs is worse than a 500
// (Google retries 5xx but takes an empty sitemap at face value). On a fresh
// cache hit, serve it. On miss/expiry, regenerate and cache on success; if
// regeneration fails, fall back to the last-known-good cached copy if one
// exists. Only a first-ever request (no cache at all) with a failing
// generation has no fallback — the caller returns 503.
async function getSitemapPages(type: SitemapType): Promise<SitemapPage[]> {
  const cached = sitemapCache.get(type);
  const isFresh = cached && Date.now() - cached.generatedAt < REVALIDATE_MS;
  if (cached && isFresh) {
    console.log(`[sitemap] type=${type} cache HIT (age ${Date.now() - cached.generatedAt}ms)`);
    return cached.pages;
  }

  const genStart = Date.now();
  try {
    const pages = await generateSitemap(type);
    const genMs = Date.now() - genStart;
    console.log(`[sitemap] type=${type} cache MISS, generated ${pages.length} pages in ${genMs}ms`);
    sitemapCache.set(type, { pages, generatedAt: Date.now() });
    return pages;
  } catch (err) {
    const ms = Date.now() - genStart;
    if (cached) {
      console.error(
        `[sitemap] type=${type} regeneration FAILED after ${ms}ms, serving stale cache from ${new Date(cached.generatedAt).toISOString()}:`,
        err,
      );
      return cached.pages;
    }
    console.error(`[sitemap] type=${type} FAILED after ${ms}ms, no cache available:`, err);
    throw err;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { type: string } },
) {
  const type = params.type.replace(".xml", "");

  if (!isSitemapType(type)) {
    return new Response("Sitemap not found", { status: 404 });
  }

  let pages: SitemapPage[];
  try {
    pages = await getSitemapPages(type);
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "60" },
    });
  }

  const uniquePages = Array.from(
    new Map(pages.map((page) => [buildUrl(page.route), page])).values(),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${uniquePages
  .map((page) => {
    const url = buildUrl(page.route);
    const alts = (page.alternates ?? [])
      .map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeXml(a.href)}"/>`)
      .join("");
    const img = page.image
      ? `\n    <image:image><image:loc>${escapeXml(buildUrl(page.image))}</image:loc></image:image>`
      : "";

    return `
  <url>
    <loc>${escapeXml(url)}</loc>${alts}${img}
    <lastmod>${toIsoDate(page.lastmod)}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`;
  })
  .join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
