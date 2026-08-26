/* Minimal SharePoint / OneDrive-for-Business client for the Korantina Homes
   availability sync (2026-08-26) — the same role googleDrive.ts and dropbox.ts
   play for their developers, and deliberately the same SHAPE (a `SharePointFile`
   with id/name/mimeType/modifiedTime so the pure matching logic downstream reads
   identically), but a different access model from either.

   ACCESS MODEL — no credentials at all, on purpose.
   Korantina shares one anonymous "anyone with the link" folder link:

     https://<tenant>-my.sharepoint.com/:f:/g/personal/<user>/<token>?e=<x>

   Registering a Graph app against Korantina's own tenant would need THEIR admin
   consent (they are not our tenant), and asking a developer for tenant-level API
   access has failed for every developer we have tried it with. So this reads the
   link exactly the way a browser does:

     1. GET the share URL, following redirects BY HAND (see openShare) so every
        hop's Set-Cookie is captured — Node's fetch with redirect:"follow" hides
        intermediate responses, and the guest cookie is set on one of them, not
        on the final 200.
     2. SharePoint answers with an anonymous guest `FedAuth` cookie scoped to the
        shared item.
     3. With that cookie, SharePoint's own OneDrive REST surface
        (/_api/v2.0/shares/u!<base64url>/driveItem and
        /_api/v2.0/drives/<driveId>/items/<id>/children|content) answers normally.

   Verified live against Korantina's real link before this file was written: the
   full 2,103-item tree lists, and file downloads come back BYTE-IDENTICAL to the
   size SharePoint reports for the item (checked against four Gardens View
   renders) — i.e. /content serves the ORIGINAL upload, not a server-side
   transform. That is the §2 "highest available resolution" check from
   docs/FEED-ADAPTER-GUIDE.md, done by measurement rather than assumption: there
   are no size variants to hunt for here, and no thumbnail suffix to strip.

   WHAT CAN BREAK, and how it surfaces. The cookie is short-lived and re-acquired
   on every sync run, so expiry is a non-issue; but the LINK itself is a bearer
   credential owned by Korantina. If they revoke it, add a per-person sign-in
   requirement, or move the folder, every call here 401/403s and the sync fails
   loudly with the message below rather than silently syncing an empty folder —
   which matters, because "no folders found" must never be mistaken for "the
   developer removed all their projects". */

const GRAPH_ROOT = "/_api/v2.0";
const UA = "Mozilla/5.0 (compatible; CyprusVipEstates-Sync/1.0)";

export type SharePointFile = {
  /** Opaque driveItem id — the addressing unit for every follow-up call. */
  id: string;
  name: string;
  /** "application/x-folder" for folders (mirrors googleDrive.ts's folder mime convention). */
  mimeType: string;
  modifiedTime: string;
  size: number;
};

export const FOLDER_MIME = "application/x-folder";
export const isFolder = (f: SharePointFile) => f.mimeType === FOLDER_MIME;

export type ShareContext = {
  origin: string;
  cookie: string;
  driveId: string;
  rootId: string;
  /** Server-relative path of the shared root, for human-readable logging only. */
  rootPath: string;
};

export function isSharePointShareUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith(".sharepoint.com") || h === "onedrive.live.com";
  } catch {
    return false;
  }
}

/* SharePoint's shares API addresses a sharing link by "u!" + base64url of the
   FULL original URL, query string included. The `?e=` parameter is part of the
   link's identity — dropping it yields a 404, so the URL is encoded verbatim. */
function shareToken(shareUrl: string): string {
  return "u!" + Buffer.from(shareUrl, "utf8").toString("base64url").replace(/=+$/, "");
}

function mergeCookies(jar: Map<string, string>, res: Response): void {
  // getSetCookie() (Node 19.7+) is the only API that returns EVERY Set-Cookie
  // header separately; headers.get("set-cookie") folds them into one comma-joined
  // string that cannot be split safely (cookie Expires values contain commas).
  const raw = typeof (res.headers as any).getSetCookie === "function" ? (res.headers as any).getSetCookie() : [];
  for (const line of raw as string[]) {
    const pair = line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

const jarToHeader = (jar: Map<string, string>) => Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

// A sync run makes hundreds of calls in a few minutes; SharePoint throttles with
// 429 (and occasionally 503) plus a Retry-After. Same 3-attempt, honor-the-header
// policy dropbox.ts uses, and for the same reason: this is a background job, so a
// slower success beats a fast failure.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if ((res.status !== 429 && res.status !== 503) || attempt >= 2) return res;
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

/** Follows the share link by hand, collecting the guest cookie from every hop. */
export async function openShare(shareUrl: string): Promise<ShareContext> {
  if (!isSharePointShareUrl(shareUrl)) throw new Error(`Not a SharePoint/OneDrive share link: ${shareUrl}`);
  const origin = new URL(shareUrl).origin;
  const jar = new Map<string, string>();

  let url = shareUrl;
  let final: Response | null = null;
  for (let hop = 0; hop < 8; hop++) {
    const res = await fetchWithRetry(url, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", ...(jar.size ? { cookie: jarToHeader(jar) } : {}) },
      cache: "no-store",
    });
    mergeCookies(jar, res);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    final = res;
    break;
  }
  // The body is never parsed — only the cookies matter — but it must be drained
  // so the connection is released rather than left half-read in the agent pool.
  await final?.arrayBuffer().catch(() => undefined);

  if (!final || !final.ok) {
    throw new Error(`SharePoint share link did not open (status ${final?.status ?? "no response"}). The link may have been revoked, expired, or changed to require a sign-in.`);
  }
  if (!jar.has("FedAuth")) {
    // Reached when the link is set to "specific people" or the tenant demands a
    // verification code: the page loads (200) but hands back a sign-in shell, not
    // a guest session. Failing here is deliberate — every later call would 401
    // with a much less obvious message.
    throw new Error("SharePoint share link opened but issued no anonymous guest session (no FedAuth cookie). The link now requires a sign-in or a verification code.");
  }
  const cookie = jarToHeader(jar);

  const res = await fetchWithRetry(`${origin}${GRAPH_ROOT}/shares/${shareToken(shareUrl)}/driveItem`, {
    headers: { cookie, accept: "application/json", "user-agent": UA },
    cache: "no-store",
  });
  const item = await safeJson(res, "shares/driveItem");
  const driveId = item?.parentReference?.driveId;
  if (!res.ok || !driveId || !item?.id) {
    throw new Error(`SharePoint could not resolve the shared folder (status ${res.status}): ${JSON.stringify(item).slice(0, 300)}`);
  }
  return { origin, cookie, driveId, rootId: item.id as string, rootPath: String(item?.parentReference?.path || "") + "/" + String(item?.name || "") };
}

async function safeJson(res: Response, context: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // A throttled or edge-blocked request comes back as HTML, not JSON — report
    // both status and body prefix, the lesson dropbox.ts's own safeJson records.
    throw new Error(`SharePoint ${context}: non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

function toFile(c: any): SharePointFile {
  return {
    id: String(c.id),
    name: String(c.name ?? ""),
    mimeType: c.folder ? FOLDER_MIME : String(c.file?.mimeType || "application/octet-stream"),
    modifiedTime: String(c.lastModifiedDateTime || ""),
    size: Number(c.size ?? 0),
  };
}

/** Direct children of one folder (paged; SharePoint caps $top at 200 in practice). */
export async function listFolder(ctx: ShareContext, itemId: string): Promise<SharePointFile[]> {
  const out: SharePointFile[] = [];
  let url: string | null = `${ctx.origin}${GRAPH_ROOT}/drives/${ctx.driveId}/items/${itemId}/children?$top=200`;
  while (url) {
    const res: Response = await fetchWithRetry(url, { headers: { cookie: ctx.cookie, accept: "application/json", "user-agent": UA }, cache: "no-store" });
    const json = await safeJson(res, `items/${itemId}/children`);
    if (!res.ok) throw new Error(`SharePoint listing failed for item ${itemId} (status ${res.status}): ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
    for (const c of json.value ?? []) out.push(toFile(c));
    url = json["@odata.nextLink"] ?? null;
  }
  return out;
}

/** Whole subtree under one folder, as `{ file, path }` with paths relative to it. */
export async function listTree(
  ctx: ShareContext,
  itemId: string,
  opts: { maxDepth?: number; basePath?: string } = {},
): Promise<{ file: SharePointFile; path: string }[]> {
  const maxDepth = opts.maxDepth ?? 4;
  const out: { file: SharePointFile; path: string }[] = [];
  async function walk(id: string, path: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    const children = await listFolder(ctx, id);
    // Sequential, not parallel: a whole-tree walk of a real developer folder is
    // ~280 listing calls, and firing them concurrently is exactly what trips
    // SharePoint's per-session throttle (the retry above then serialises them
    // anyway, slower). Depth-first keeps `out` in a human-readable order.
    for (const c of children) {
      const p = `${path}/${c.name}`;
      out.push({ file: c, path: p });
      if (isFolder(c)) await walk(c.id, p, depth + 1);
    }
  }
  await walk(itemId, opts.basePath ?? "", 0);
  return out;
}

export async function downloadFile(ctx: ShareContext, itemId: string): Promise<Buffer> {
  const res = await fetchWithRetry(`${ctx.origin}${GRAPH_ROOT}/drives/${ctx.driveId}/items/${itemId}/content`, {
    headers: { cookie: ctx.cookie, "user-agent": UA },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SharePoint download failed for item ${itemId} (status ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/* ── Pure folder-shape helpers (no I/O — testable, and the only place the
   developer's own naming conventions are encoded) ───────────────────────── */

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Case/spelling-tolerant subfolder lookup ("Availability" | "Availability list" | "Availability List"). */
export function findSubfolder(files: SharePointFile[], re: RegExp): SharePointFile | null {
  return files.find((f) => isFolder(f) && re.test(f.name)) ?? null;
}

export function findSubfolders(files: SharePointFile[], re: RegExp): SharePointFile[] {
  return files.filter((f) => isFolder(f) && re.test(f.name));
}

export const AVAILABILITY_FOLDER_RE = /^availability(\s+list)?$/i;
export const PICTURES_FOLDER_RE = /^pictures?(\s*(and|&)\s*videos?)?\b/i;
export const PLANS_FOLDER_RE = /^(plans?|master\s*plan)\b/i;
export const BROCHURE_FOLDER_RE = /^brochures?$/i;

// Windows/macOS filesystem litter that rides along in every shared folder —
// 33 Thumbs.db and 6 .DS_Store files in Korantina's tree today. Excluded by name,
// not by mime type: SharePoint reports Thumbs.db as application/octet-stream,
// which is also what a legitimate unknown-type file would report.
export const isJunkFile = (name: string) => /^(thumbs\.db|\.ds_store|\._.*|desktop\.ini)$/i.test(name.trim());

export const IMAGE_MIME_RE = /^image\/(jpe?g|png|webp)$/i;
export const isPdf = (f: SharePointFile) => f.mimeType === "application/pdf" || /\.pdf$/i.test(f.name);

/** Word-overlap score in [0,1], normalised by the LARGER word count. */
export function nameOverlap(a: string, b: string): number {
  const wa = norm(a).split(" ").filter(Boolean);
  const wb = norm(b).split(" ").filter(Boolean);
  if (!wa.length || !wb.length) return 0;
  const setB = new Set(wb);
  const hits = wa.filter((w) => setB.has(w)).length;
  // Normalising by the larger count (not the smaller) is the same correction
  // pricelistExtract.ts had to make after "VENARA" scored a false 1.0 against
  // "VENARA VIEW": a strict word-subset must never tie with an exact match.
  return hits / Math.max(wa.length, wb.length);
}
