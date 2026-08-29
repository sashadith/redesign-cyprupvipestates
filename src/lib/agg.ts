// AGG Luxury Homes (A.G & G Luxury Homes, agcyprus.com) — data sources (2026-08-28).
//
// AGG is unusual among our developers: their two halves live in two different
// places, and neither is a feed we control.
//
//   1. PROJECT IDENTITY, COPY, IMAGES, BROCHURES  ← their public WordPress REST API.
//      agcyprus.com runs an Avada/"Visual Portfolio" theme over a custom post type
//      `home-details`. WordPress mirrors that CPT 1:1 as open JSON (no auth, no
//      token): /wp-json/wp/v2/home-details gives every project; /wp-json/wp/v2/media
//      ?parent=<id> gives its whole gallery AND its brochure PDFs. This is the clean
//      source — no HTML scraping — and it carries ~31 projects (the for-sale ones
//      plus their completed portfolio).
//
//   2. UNITS + PRICES  ← a ShareOneDrive-served PowerPoint PDF price list.
//      "Projects Pricelist DDMMYY AF.pdf", one card per unit, 12 active projects.
//      Parsed by src/lib/ai/aggPricelist.ts. See aggPricelistDownloadUrl below for
//      the one non-obvious trick (the plugin's `-preview` action returns an HTML
//      viewer; `-download` returns the raw PDF).
//
// The two are joined by NAME (aggSync.ts): the price list names a project
// "VASILEON SIGNATURE RESIDENCES", the REST API slugs it `vasileon`. Nothing here
// is AI-derived — identity is the REST slug, which a human never edits.
//
// Account wiring (resolved by the cron route, single-developer like kuutio/korantina):
//   DeveloperAccount.website        → REST base, e.g. "https://www.agcyprus.com"
//   DeveloperAccount.driveFolderUrl → the ShareOneDrive price-list link (any of its
//                                     -preview / -download variants; we normalise it)

export type AggMedia = { url: string; mime: string; width: number | null; height: number | null };

export type AggProject = {
  id: number;
  slug: string;
  title: string;
  link: string;
  modified: string; // ISO8601 — cheap per-project change signal
  listingStatus: string[]; // e.g. ["Under Construction"]
  location: string[]; // e.g. ["Pafos"]
  propertyType: string[]; // e.g. ["Apartments"]
  description: string; // plain text, boilerplate trimmed
  featuredImage: string | null;
  images: AggMedia[];
  pdfs: { url: string; title: string }[];
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`AGG REST ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** "https://www.agcyprus.com" from an account website, defaulting to the live host. */
export function aggApiBase(website: string | null | undefined): string {
  const raw = (website || "https://www.agcyprus.com").trim();
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://www.agcyprus.com";
  }
}

// The two boilerplate blocks below are the same in every project's WordPress body:
// a "Show more" pager and a "Listing updated / Total Views / Open house …" footer.
// Cutting at the first of them (only when it is well past the intro, so a short
// project isn't truncated to nothing) leaves the real marketing prose.
const DESC_CUTOFFS = ["Show more", "Listing updated", "Resort Facilities", "Open house", "Ready, Set, Invest"];

function cleanHtml(html: string): string {
  let t = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#39;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  for (const m of DESC_CUTOFFS) {
    const i = t.indexOf(m);
    if (i > 200) t = t.slice(0, i).trim();
  }
  return t;
}

type WpTerm = { id: number; name: string };
type WpMedia = { source_url: string; mime_type: string; media_details?: { width?: number; height?: number } };
type WpHomeDetail = {
  id: number;
  slug: string;
  status: string;
  link: string;
  modified: string;
  title: { rendered: string };
  content: { rendered: string };
  "listing-status"?: number[];
  location?: number[];
  "property-type"?: number[];
  _embedded?: { "wp:featuredmedia"?: { source_url?: string }[] };
};

/**
 * Fetch every published `home-details` project with its taxonomies resolved to
 * names, its featured image, its full gallery and its brochure PDFs. One list
 * call + three tiny taxonomy calls + one media call per project.
 */
export async function fetchAggProjects(base: string): Promise<AggProject[]> {
  const [status, location, propType] = await Promise.all([
    getJson<WpTerm[]>(`${base}/wp-json/wp/v2/listing-status?per_page=100&_fields=id,name`),
    getJson<WpTerm[]>(`${base}/wp-json/wp/v2/location?per_page=100&_fields=id,name`),
    getJson<WpTerm[]>(`${base}/wp-json/wp/v2/property-type?per_page=100&_fields=id,name`),
  ]);
  const map = (terms: WpTerm[]) => new Map(terms.map((t) => [t.id, t.name]));
  const [sMap, lMap, pMap] = [map(status), map(location), map(propType)];

  const posts = await getJson<WpHomeDetail[]>(`${base}/wp-json/wp/v2/home-details?per_page=100&_embed=1`);

  const projects: AggProject[] = [];
  for (const p of posts) {
    if (p.status !== "publish") continue;
    let images: AggMedia[] = [];
    let pdfs: { url: string; title: string }[] = [];
    try {
      const media = await getJson<(WpMedia & { title?: { rendered?: string } })[]>(
        `${base}/wp-json/wp/v2/media?parent=${p.id}&per_page=100&_fields=id,source_url,mime_type,title,media_details`,
      );
      for (const m of media) {
        if (m.mime_type?.startsWith("image/")) {
          images.push({ url: m.source_url, mime: m.mime_type, width: m.media_details?.width ?? null, height: m.media_details?.height ?? null });
        } else if (m.mime_type === "application/pdf") {
          pdfs.push({ url: m.source_url, title: m.title?.rendered || "" });
        }
      }
    } catch {
      // a project whose media call fails still ships with its description/identity;
      // an empty gallery just means "gather again next run" (aggSync's needsContent).
    }
    projects.push({
      id: p.id,
      slug: p.slug,
      title: p.title.rendered,
      link: p.link,
      modified: p.modified,
      listingStatus: (p["listing-status"] || []).map((id) => sMap.get(id) || String(id)),
      location: (p.location || []).map((id) => lMap.get(id) || String(id)),
      propertyType: (p["property-type"] || []).map((id) => pMap.get(id) || String(id)),
      description: cleanHtml(p.content?.rendered || ""),
      featuredImage: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
      images,
      pdfs,
    });
  }
  return projects;
}

/* ── The ShareOneDrive price-list ─────────────────────────────────────────── */

// A ShareOneDrive "share context" — the stable module coordinates. `id` (a
// specific file/folder) is optional: for AGG we DISCOVER the current file instead
// of hard-coding it, so any share URL from the site (a preview link, a folder link)
// is a valid config as long as it carries account_id/drive_id/listtoken.
export type ShareOneDriveRef = { account_id: string; drive_id: string; listtoken: string; base: string; id?: string };

/**
 * Parse a ShareOneDrive admin-ajax URL into its module coordinates. Requires only
 * account_id/drive_id/listtoken (the module identity); `id` is kept if present but
 * not required, because the price list is discovered by folder, not by a pinned id.
 */
export function parseShareOneDriveUrl(url: string): ShareOneDriveRef {
  const u = new URL(url);
  const q = u.searchParams;
  const need = (k: string) => {
    const v = q.get(k);
    if (!v) throw new Error(`ShareOneDrive URL missing "${k}"`);
    return v;
  };
  return {
    base: `${u.protocol}//${u.host}${u.pathname}`,
    account_id: need("account_id"),
    drive_id: need("drive_id"),
    listtoken: need("listtoken"),
    id: q.get("id") || undefined,
  };
}

/* ── Folder discovery ──────────────────────────────────────────────────────
   The plugin's own file browser lists a folder with action=shareonedrive-get-
   filelist. The module's `listtoken` alone authorises it (no per-page nonce —
   verified live 2026-08-28), which is what lets a headless sync walk the tree.
   The response carries a jstree `tree` (folders, with a stable `text` name) and a
   rendered `html` blob (the current folder's file entries as
   <div class='entry file' data-id=… data-name=…>). We read folders from `tree`
   and files from `html`. */

type FileListResponse = { tree?: { id: string; text: string; parent: string }[]; html?: string; filescount?: number };

async function soGetFilelist(ref: ShareOneDriveRef, folderId: string): Promise<FileListResponse> {
  const body = new URLSearchParams({
    action: "shareonedrive-get-filelist",
    listtoken: ref.listtoken,
    drive_id: ref.drive_id,
    account_id: ref.account_id,
    lastFolder: folderId,
    folderPath: "",
    sort: "modified-desc",
    mobile: "0",
    query: "",
  });
  const res = await fetch(ref.base, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`ShareOneDrive get-filelist ${res.status}`);
  return (await res.json()) as FileListResponse;
}

const soNorm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Parse the file entries out of a folder listing's rendered html. */
function soFilesFromHtml(html: string): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const re = /<div class='entry file '[^>]*\bdata-id='([^']+)'[^>]*\bdata-name='([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ id: m[1], name: m[2] });
  return out;
}

export type DiscoveredPricelist = { id: string; name: string };

/**
 * Find the current price-list PDF by walking to the "1.Pricelist" folder in the
 * developer's ShareOneDrive root and reading the (single) file inside it. AGG keep
 * exactly one PDF there and change only its NAME (the export date), so the file's
 * name is the sync trigger (aggSync compares it to DeveloperAccount.driveFileModified).
 *
 * @param folderName  the price-list folder (default "1.Pricelist"), matched
 *                    case/punctuation-insensitively.
 */
export async function findAggPricelist(ref: ShareOneDriveRef, folderName = "1.Pricelist"): Promise<DiscoveredPricelist> {
  const root = await soGetFilelist(ref, "");
  const wanted = soNorm(folderName);
  const folder = (root.tree || []).find((n) => soNorm(n.text) === wanted) || (root.tree || []).find((n) => soNorm(n.text).includes("pricelist"));
  if (!folder) throw new Error(`ShareOneDrive: "${folderName}" folder not found in the developer root (listtoken may have rotated, or the folder was renamed)`);

  const listing = await soGetFilelist(ref, folder.id);
  const files = soFilesFromHtml(listing.html || "");
  const pdf = files[0]; // sorted modified-desc; AGG keep exactly one file here
  if (!pdf) throw new Error(`ShareOneDrive: no file inside "${folderName}"`);
  // data-name has no extension; normalise to the on-disk filename for the signature.
  const name = /\.pdf$/i.test(pdf.name) ? pdf.name : `${pdf.name}.pdf`;
  return { id: pdf.id, name };
}

export type AggPricelistDownload = { buffer: Buffer; filename: string };

/**
 * Download a ShareOneDrive file by id (action=shareonedrive-download returns the
 * raw PDF; the sibling -preview action returns an HTML viewer instead). Throws with
 * a clear message if the response is not a PDF — what a rotated listtoken looks like.
 */
export async function downloadAggPricelist(ref: ShareOneDriveRef, file: DiscoveredPricelist): Promise<AggPricelistDownload> {
  const p = new URLSearchParams({ action: "shareonedrive-download", id: file.id, account_id: ref.account_id, drive_id: ref.drive_id, listtoken: ref.listtoken });
  const res = await fetch(`${ref.base}?${p.toString()}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`AGG price-list download ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!ct.includes("application/pdf") && buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error(`AGG price-list did not return a PDF (content-type "${ct}") — the ShareOneDrive listtoken has probably rotated; refresh DeveloperAccount.driveFolderUrl`);
  }
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:utf-8''|")?([^";]+)/i.exec(cd);
  const filename = m ? decodeURIComponent(m[1].replace(/"$/, "")) : file.name;
  return { buffer, filename };
}
