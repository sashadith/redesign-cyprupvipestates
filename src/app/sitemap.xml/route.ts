import { NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";

const websiteUrl = "https://cyprusvipestates.com";

// "developments" (the new Prisma-backed Development pipeline) only gets
// listed once NEW_PROJECTS_INDEXABLE is flipped on — until then its own
// sub-sitemap generator returns zero pages anyway (see
// src/app/sitemaps/[type]/route.ts), so there's no reason to advertise an
// always-empty sitemap to crawlers in the meantime.
//
// "case-studies" is deliberately NOT listed: every live case-studies page
// (src/app/preview-case-studies/[lang]/layout.tsx) is hardcoded
// `robots: {index:false, follow:false}` — submitting noindexed URLs in a
// sitemap produces "Submitted URL marked 'noindex'" errors in GSC and sends
// a contradictory signal. Add it back once/if that noindex decision changes.
const sitemaps = [
  "projects",
  "blog",
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
