import {
  getAllProjectsByLang,
  getAllDevelopersByLang,
  getAllPathsForLang,
  getBlogPostsByLang,
  getCaseStudiesByLang,
} from "@/sanity/sanity.utils";

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

type SitemapPage = {
  route: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  lastmod?: string;
};

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

async function generateProjectsSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";
    const prefix = isDefault ? "" : `/${lang}`;

    pages.push({
      route: `${prefix}/projects`,
      changefreq: "weekly",
      priority: 0.8,
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
      });
    });
  }

  return pages;
}

async function generateDevelopersSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";
    const prefix = isDefault ? "" : `/${lang}`;

    pages.push({
      route: `${prefix}/developers`,
      changefreq: "weekly",
      priority: 0.7,
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
      });
    });
  }

  return pages;
}

async function generateBlogSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";
    const prefix = isDefault ? "" : `/${lang}`;

    pages.push({
      route: `${prefix}/blog`,
      changefreq: "weekly",
      priority: 0.8,
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
      });
    });
  }

  return pages;
}

async function generatePagesSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";

    pages.push({
      route: isDefault ? "/" : `/${lang}`,
      changefreq: "weekly",
      priority: 1.0,
    });

    const allPaths = await getAllPathsForLang(lang);

    allPaths
      .filter((segments) => Array.isArray(segments) && segments.length > 0)
      .forEach((segments) => {
        const route = isDefault
          ? `/${segments.join("/")}`
          : `/${lang}/${segments.join("/")}`;

        pages.push({
          route,
          changefreq: "weekly",
          priority: segments.length === 1 ? 0.8 : 0.7,
        });
      });
  }

  return pages;
}

async function generateCaseStudiesSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";
    const prefix = isDefault ? "" : `/${lang}`;

    pages.push({
      route: `${prefix}/case-studies`,
      changefreq: "weekly",
      priority: 0.8,
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniquePages
  .map((page) => {
    const url = buildUrl(page.route);

    return `
  <url>
    <loc>${escapeXml(url)}</loc>
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
