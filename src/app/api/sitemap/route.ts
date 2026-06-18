import {
  getAllProjectsByLang,
  getAllDevelopersByLang,
  getAllPathsForLang,
  getBlogPostsByLang,
} from "@/sanity/sanity.utils";

const websiteUrl = "https://cyprusvipestates.com";
const langs = ["de", "pl", "en", "ru"];

type SitemapPage = {
  route: string;
  url: string;
  changefreq: string;
  priority: number;
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

function addPage(pages: SitemapPage[], page: Omit<SitemapPage, "url">) {
  const route = normalizeRoute(page.route);

  pages.push({
    ...page,
    route,
    url: `${websiteUrl}${route === "/" ? "/" : route}`,
  });
}

async function generateSitemap(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];

  for (const lang of langs) {
    const isDefault = lang === "de";
    const prefix = isDefault ? "" : `/${lang}`;

    addPage(pages, {
      route: isDefault ? "/" : `/${lang}`,
      changefreq: "weekly",
      priority: 1.0,
    });

    addPage(pages, {
      route: `${prefix}/projects`,
      changefreq: "weekly",
      priority: 0.9,
    });

    const projects = await getAllProjectsByLang(lang);

    projects.forEach((proj) => {
      const slug = proj.slug?.[lang]?.current;
      if (!slug) return;

      addPage(pages, {
        route: `${prefix}/projects/${slug}`,
        changefreq: "weekly",
        priority: 0.8,
      });
    });

    addPage(pages, {
      route: `${prefix}/developers`,
      changefreq: "weekly",
      priority: 0.9,
    });

    const developers = await getAllDevelopersByLang(lang);

    developers.forEach((dev) => {
      const slug = dev.slug?.[lang]?.current;
      if (!slug) return;

      addPage(pages, {
        route: `${prefix}/developers/${slug}`,
        changefreq: "weekly",
        priority: 0.8,
      });
    });

    const allPaths = await getAllPathsForLang(lang);

    allPaths
      .filter((segments) => Array.isArray(segments) && segments.length > 0)
      .forEach((segments) => {
        const route = isDefault
          ? `/${segments.join("/")}`
          : `/${lang}/${segments.join("/")}`;

        addPage(pages, {
          route,
          changefreq: "weekly",
          priority: segments.length === 1 ? 0.9 : 0.8,
        });
      });

    addPage(pages, {
      route: `${prefix}/blog`,
      changefreq: "weekly",
      priority: 0.9,
    });

    const blogPosts = await getBlogPostsByLang(lang);

    blogPosts.forEach((post) => {
      const slug = post.slug?.[lang]?.current;
      if (!slug) return;

      addPage(pages, {
        route: `${prefix}/blog/${slug}`,
        changefreq: "weekly",
        priority: 0.8,
      });
    });
  }

  return Array.from(new Map(pages.map((page) => [page.url, page])).values());
}

export async function GET() {
  const pages = await generateSitemap();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    ({ url, changefreq, priority }) => `
  <url>
    <loc>${escapeXml(url)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`,
  )
  .join("")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
