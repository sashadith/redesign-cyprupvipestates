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

const websiteUrl = "https://cyprusvipestates.com";
const langs = ["de", "pl", "en", "ru"] as const;
const sitemapTypes = [
  "projects",
  "blog",
  "pages",
  "developers",
  "case-studies",
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

async function generateSitemap(type: SitemapType) {
  if (type === "projects") return generateProjectsSitemap();
  if (type === "developers") return generateDevelopersSitemap();
  if (type === "blog") return generateBlogSitemap();
  if (type === "case-studies") return generateCaseStudiesSitemap();
  if (type === "pages") return generatePagesSitemap();

  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: { type: string } },
) {
  const type = params.type.replace(".xml", "");

  if (!isSitemapType(type)) {
    return new Response("Sitemap not found", { status: 404 });
  }

  const pages = await generateSitemap(type);

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
