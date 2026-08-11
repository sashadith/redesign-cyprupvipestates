import { NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";

const websiteUrl = "https://cyprusvipestates.com";

// "developments" (the new Prisma-backed Development pipeline) only gets
// listed once NEW_PROJECTS_INDEXABLE is flipped on — until then its own
// sub-sitemap generator returns zero pages anyway (see
// src/app/sitemaps/[type]/route.ts), so there's no reason to advertise an
// always-empty sitemap to crawlers in the meantime.
//
// "case-studies" added back 2026-08-11 — its noindex (the reason this was
// excluded, see git history) is gone: preview-case-studies/[lang]/layout.tsx
// no longer sets robots:{index:false}, part of the same GSC-audit fix that
// unblocked /faq. generateCaseStudiesSitemap() (sitemaps/[type]/route.ts) was
// already written and wired into the dispatcher the whole time — it just
// never had a reason to be linked from this index before now.
const sitemaps = [
  "projects",
  "blog",
  "case-studies",
  "pages",
  "developers",
  ...(NEW_PROJECTS_INDEXABLE ? ["developments"] : []),
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const lastmod = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (name) => `
  <sitemap>
    <loc>${escapeXml(`${websiteUrl}/sitemaps/${name}.xml`)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join("")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
