import { toTitleCaseName } from "@/lib/textCase";

/* Cybarco has no feed of any kind — no Drive, no XML, no API, and its
   WordPress REST API exposes only the default post types, so the `project`
   post type is invisible there. Everything below is parsed out of
   server-rendered HTML plus the Yoast sitemap. Measured 2026-09-10: the
   production VPS gets HTTP 200 with no cf-mitigated header, so unlike AGG this
   can run from the server. */

export type CybarcoStatus = "under_construction" | "ready" | "sold_out";

export type CybarcoCard = {
  slug: string;
  name: string;
  status: CybarcoStatus;
  priceFrom: number | null;
  district: string | null;
  featuredImage: string | null;
  description: string;
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
   .replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "'");

const strip = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Top-level EN project slugs, in sitemap order. No `/ru/`, no subpages. */
export function slugsFromSitemap(xml: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g))) {
    const u = m[1];
    const hit = u.match(/^https:\/\/www\.cybarco\.com\/project\/([a-z0-9-]+)\/$/);
    if (hit) out.push(hit[1]);
  }
  return Array.from(new Set(out));
}

/* The site spells the same state four ways. Anything unrecognised is a hard
   error rather than a silent default: a new mark would otherwise import as
   "under construction" and quietly put a sold-out project back on sale. */
function normaliseStatus(mark: string): CybarcoStatus {
  const m = mark.toLowerCase().replace(/\s+/g, " ").trim();
  if (m.startsWith("sold")) return "sold_out";
  if (m.startsWith("ready")) return "ready";
  if (m.startsWith("under construction")) return "under_construction";
  throw new Error(`Cybarco: unrecognised status mark ${JSON.stringify(mark)}`);
}

/* "From €320,000 – Nicosia, Cyprus" / "Sold Out – Limassol, Cyprus" /
   "From €1,260,000 – Latchi, Pafos, Cyprus". The district is the segment
   before "Cyprus"; Latchi is a village in Pafos, so the LAST segment before
   the country is the one our `district` field means. */
function parseSubTitle(sub: string): { priceFrom: number | null; district: string | null } {
  const price = sub.match(/€\s*([\d,.]+)/);
  const priceFrom = price ? Number(price[1].replace(/[^\d]/g, "")) || null : null;
  const parts = sub.split(/\s+[–—-]\s+/);
  const tail = parts.length > 1 ? parts[parts.length - 1] : "";
  const segs = tail.split(",").map((s) => s.trim()).filter(Boolean);
  const withoutCountry = segs.filter((s) => !/^cyprus$/i.test(s));
  const district = withoutCountry.length ? withoutCountry[withoutCountry.length - 1] : null;
  return { priceFrom, district };
}

/* Four of the six sold-out cards no longer link anywhere — Cybarco redirects
   their pages (sea-gallery-villas and the-oval to a listing, aktea-residences-2
   and -3 to aktea-residences-4). Their slug is recovered by matching the card's
   own name against the sitemap, never by slugifying the display name: a derived
   slug that drifts re-keys the project and creates a duplicate Development. */
function resolveSlug(name: string, linked: string | null, sitemap: string[]): string {
  if (linked) return linked;
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const hit = sitemap.find((s) => s.replace(/-/g, "") === key);
  if (hit) return hit;
  throw new Error(`Cybarco: no sitemap slug for unlinked card ${JSON.stringify(name)}`);
}

export function parseListing(html: string, sitemapXml: string): CybarcoCard[] {
  const sitemap = slugsFromSitemap(sitemapXml);
  const cards: CybarcoCard[] = [];
  for (const chunk of html.split('<div class="project">').slice(1)) {
    const one = (re: RegExp) => chunk.match(re)?.[1] ?? "";
    const name = toTitleCaseName(strip(one(/<h3[^>]*>([\s\S]*?)<\/h3>/)));
    if (!name) continue;
    const linked = chunk.match(/href="https:\/\/www\.cybarco\.com\/project\/([a-z0-9-]+)\/"/)?.[1] ?? null;
    const mark = strip(one(/<span class="mark">([\s\S]*?)<\/span>/));
    const sub = strip(one(/<span class="sub-title">([\s\S]*?)<\/span>/));
    const { priceFrom, district } = parseSubTitle(sub);
    cards.push({
      slug: resolveSlug(name, linked, sitemap),
      name,
      status: normaliseStatus(mark),
      priceFrom,
      district,
      featuredImage: one(/data-bg="([^"]+)"/) || null,
      description: strip(one(/<div class="desktop-hover">\s*<p>([\s\S]*?)<\/p>/)),
    });
  }
  return cards;
}

export type CybarcoDetail = {
  images: string[];
  priceListUrl: string | null;
  brochureUrl: string | null;
  description: string;
};

const UPLOAD_IMG_RE = /https:\/\/www\.cybarco\.com\/wp-content\/uploads\/[^"')\s]+?\.(?:jpe?g|png|webp)/gi;

/* WordPress serves the same picture at several sizes, "…-768x511.jpg" next to
   the original. Stripping the suffix collapses them to one URL and asks for the
   largest file the site holds. Measured 2026-09-10, Cybarco's originals run
   774x514 to 1550x719 — all below imageMirror's 1920 px ceiling, so nothing is
   downscaled on our side and nothing is gained by asking for more. */
const originalUrl = (u: string) => u.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)$)/i, "");

function imagesFrom(html: string): string[] {
  return Array.from(new Set((html.match(UPLOAD_IMG_RE) ?? []).map(originalUrl)));
}

const pdfLinks = (html: string) =>
  Array.from(new Set(Array.from(html.matchAll(/href="(https:\/\/www\.cybarco\.com\/wp-content\/uploads\/[^"]+?\.pdf)"/gi)).map((m) => m[1])));

/* Project pages don't carry the listing card's "desktop-hover" markup — that
   class belongs to the listing page only (see parseListing above) and is
   absent here, so reusing it would silently yield "" on every project page.
   The SEO meta description is present on every project page captured so far
   and is a reliable one-line summary; og:description duplicates it. */
export function parseProjectPage(html: string): CybarcoDetail {
  const pdfs = pdfLinks(html);
  const priceListUrl = pdfs.find((u) => /pricelist/i.test(u)) ?? null;
  return {
    images: imagesFrom(html),
    priceListUrl,
    brochureUrl: pdfs.find((u) => u !== priceListUrl) ?? null,
    description: strip(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ""),
  };
}

export function parseGallery(html: string): string[] {
  return imagesFrom(html);
}

/* "…-Pricelist-ENG-280826.pdf" — DDMMYY, and the only change signal the site
   offers: the sitemap carries no usable lastmod. A new list is a new filename. */
export function priceListDate(url: string): string | null {
  const m = url.match(/-(\d{2})(\d{2})(\d{2})\.pdf$/i);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const month = Number(mm), day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `20${yy}-${mm}-${dd}`;
}
