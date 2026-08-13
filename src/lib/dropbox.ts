import * as XLSX from "xlsx";

/* Minimal Dropbox REST client for the Kuutio availability sync (2026-08-13) —
   same shape and purpose as googleDrive.ts, but reads via a PUBLIC SHARED
   LINK (files/list_folder + sharing/get_shared_link_file with a `shared_link`
   parameter) rather than a folder the app owns. Confirmed live against
   Kuutio's actual link before writing this: this mechanism works with ANY
   authenticated Dropbox app token, regardless of who owns the link — Kuutio
   never needs to know or grant anything beyond the link already being public.

   Path-addressed, not ID-addressed (Google Drive's model): every entry is
   identified by its path relative to the shared folder's own root ("" for
   the root itself, "/Noble" for a subfolder), not an opaque file id. */

export function dropboxConfigured(): boolean {
  return !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET && process.env.DROPBOX_REFRESH_TOKEN);
}

// A rate-limited/edge-blocked request can come back as plain text or an HTML
// error page instead of JSON (confirmed 2026-08-13: a burst of calls during
// a force re-sync hit this, and the previous bare `res.json()` surfaced only
// "Unexpected token 'u', "unexpected"... is not valid JSON" — no status
// code, no indication it was even Dropbox's response body that broke).
// Reads the body as text first so a parse failure can report both.
async function safeJson(res: Response, context: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Dropbox ${context}: non-JSON response (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

// A force re-sync's higher photo/plan caps (2026-08-13) mean far more calls
// in a short window than the original units-only pass ever made — retry on
// 429 (honoring Retry-After when Dropbox sends one) so a burst that trips
// their rate limit self-heals instead of aborting the whole sync partway
// through. 3 attempts, capped backoff — this is a background sync job, not
// a user-facing request, so a slower success beats a fast failure here.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, init);
    if (r.status !== 429 || attempt >= 2) return r;
    const retryAfter = Number(r.headers.get("Retry-After"));
    const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export async function getDropboxAccessToken(): Promise<string> {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN!,
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
    }),
    cache: "no-store",
  });
  const t = await safeJson(res, "oauth2/token");
  if (!t.access_token) throw new Error("Dropbox token refresh failed: " + JSON.stringify(t).slice(0, 200));
  return t.access_token as string;
}

// Same shape as googleDrive.ts's DriveFile (id/name/mimeType/modifiedTime) so
// the pure matching logic below (findPriceFile/findInfoDocuments/
// findSubfolder) reads identically to its Drive counterpart — `id` here is
// the entry's path relative to the shared folder's root (Dropbox has no
// stable opaque id usable across a path-based shared-link listing the way
// Drive's file id is), which is also exactly what a subsequent list/download
// call needs, so callers never have to re-derive a path from anything else.
export type DropboxFile = { id: string; name: string; mimeType: string; modifiedTime: string };

const FOLDER_MIME = "application/vnd.dropbox.folder"; // self-defined sentinel — Dropbox's own API has no MIME concept, only a folder/file tag
const SHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; // .xlsx — Dropbox has no native "Sheets" format, everything is a real file
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMG_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function guessMimeType(name: string): string {
  const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) ?? "";
  if (ext === "xlsx" || ext === "xls") return SHEET_MIME;
  if (ext === "pdf") return PDF_MIME;
  if (ext === "docx") return DOCX_MIME;
  if (IMG_EXT[ext]) return IMG_EXT[ext];
  return "application/octet-stream";
}

// Lists one level of a shared folder. `path` is relative to the share root
// ("" for the root itself). cache:"no-store" throughout this file for the
// same reason as googleDrive.ts (see that file's header comment) — Next's
// Data Cache would otherwise store a folder listing/file download for a
// year across deploys.
export async function listSharedFolder(shareUrl: string, path = "", accessToken: string): Promise<DropboxFile[]> {
  const out: DropboxFile[] = [];
  let cursor: string | null = null;
  let first = true;
  while (first || cursor) {
    first = false;
    const body: { cursor: string } | { path: string; shared_link: { url: string } } = cursor
      ? { cursor }
      : { path, shared_link: { url: shareUrl } };
    const endpoint: string = cursor ? "files/list_folder/continue" : "files/list_folder";
    const r: Response = await fetchWithRetry(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const j: any = await safeJson(r, `list_folder(${path || "/"})`);
    if (!r.ok) throw new Error(`Dropbox list_folder(${path || "/"}): ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    for (const e of j.entries ?? []) {
      const isFolder = e[".tag"] === "folder";
      out.push({
        id: `${path}/${e.name}`.replace(/^\/+/, "/"),
        name: e.name,
        mimeType: isFolder ? FOLDER_MIME : guessMimeType(e.name),
        modifiedTime: e.server_modified ?? e.client_modified ?? "",
      });
    }
    cursor = j.has_more ? j.cursor : null;
  }
  return out;
}

// The price list = a spreadsheet whose name looks like one, else the most
// recently modified spreadsheet in the folder — identical rule to
// googleDrive.ts's findPriceFile (see that file for the PDF-fallback
// reasoning); Kuutio's own file is already a plain .xlsx, so the PDF branch
// is untested here but kept for parity with any future Dropbox developer
// who, like Motive Point, only ever exports a combined PDF.
export function findPriceFile(files: DropboxFile[]): DropboxFile | null {
  const NAME_RE = /price\s*list|pricelist|availab|sales/i;
  const sheets = files.filter((f) => f.mimeType === SHEET_MIME);
  const namedSheets = sheets.filter((f) => NAME_RE.test(f.name));
  const sheetPool = namedSheets.length ? namedSheets : sheets;
  if (sheetPool.length) return sheetPool.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];

  const namedPdfs = files.filter((f) => f.mimeType === PDF_MIME && NAME_RE.test(f.name));
  if (namedPdfs.length) return namedPdfs.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];

  return null;
}

const IMG_MIME_RE = /^image\/(jpe?g|png|webp)$/i;
const normKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// One-level nested descent, same reasoning as googleDrive.ts's findSubfolder
// (Motive Point's "Venara"/"Venara View" incident — a more specific project
// folder can be nested inside a broader sibling rather than sitting at the
// same level). Path-based rather than id-based: descending just means
// listing `${parent.id}` (already the parent's own relative path) instead of
// looking up a Drive folder id.
export async function findSubfolder(files: DropboxFile[], projectName: string, shareUrl: string, accessToken?: string): Promise<DropboxFile | null> {
  const pk = normKey(projectName);
  if (!pk) return null;
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const exact = folders.find((f) => normKey(f.name) === pk);
  if (exact) return exact;

  const fuzzyParents = folders.filter(
    (f) => normKey(f.name).startsWith(pk) || pk.startsWith(normKey(f.name)) || normKey(f.name).includes(pk) || pk.includes(normKey(f.name)),
  );
  if (accessToken) {
    for (const parent of fuzzyParents) {
      try {
        const children = (await listSharedFolder(shareUrl, parent.id, accessToken)).filter((c) => c.mimeType === FOLDER_MIME);
        const nested = children.find((c) => normKey(c.name) === pk) || children.find((c) => normKey(c.name).includes(pk));
        if (nested) return nested;
      } catch {
        /* best-effort — fall through to the parent-level match below */
      }
    }
  }

  return fuzzyParents[0] ?? null;
}

// Top-level (non-recursive) docx/pdf files sitting directly in the project's
// own subfolder — same rule as googleDrive.ts's findInfoDocuments.
export function findInfoDocuments(files: DropboxFile[], maxCount = 2): DropboxFile[] {
  return files
    .filter((f) => f.mimeType === DOCX_MIME || f.mimeType === PDF_MIME)
    .filter((f) => !/price\s*list|pricelist|availab/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, maxCount);
}

// Recurse a project subfolder collecting image files — same shape/behavior
// as googleDrive.ts's collectMedia (renders → images; a "drawing/plan/floor"
// folder → plans).
export async function collectMedia(
  path: string,
  shareUrl: string,
  accessToken: string,
  opts: { maxImages?: number; maxPlans?: number; maxDepth?: number } = {},
): Promise<{ images: DropboxFile[]; plans: DropboxFile[]; sig: string }> {
  const maxDepth = opts.maxDepth ?? 3;
  const images: DropboxFile[] = [];
  const plans: DropboxFile[] = [];
  const walk = async (p: string, depth: number, inPlans: boolean) => {
    if (depth > maxDepth) return;
    const files = await listSharedFolder(shareUrl, p, accessToken);
    for (const f of files) {
      if (f.mimeType === FOLDER_MIME) {
        await walk(f.id, depth + 1, inPlans || /draw|plan|floor/i.test(f.name));
      } else if (IMG_MIME_RE.test(f.mimeType)) {
        (inPlans ? plans : images).push(f);
      } else if (inPlans && f.mimeType === PDF_MIME) {
        plans.push(f);
      }
    }
  };
  await walk(path, 0, false);
  images.sort((a, b) => a.name.localeCompare(b.name));
  plans.sort((a, b) => a.name.localeCompare(b.name));
  const sig = [...images, ...plans].map((f) => f.id + ":" + f.modifiedTime).sort().join("|").slice(0, 6000);
  return {
    images: opts.maxImages ? images.slice(0, opts.maxImages) : images,
    plans: opts.maxPlans ? plans.slice(0, opts.maxPlans) : plans,
    sig,
  };
}

// files/download only works for paths the app itself owns; a shared-link
// file (which Kuutio's are, by construction — the app never owns any of
// this) goes through sharing/get_shared_link_file instead, which lives on
// the content.dropboxapi.com host and passes its args via the
// Dropbox-API-Arg HEADER (JSON-encoded), not a JSON request body — confirmed
// against Kuutio's real price-list file before writing this.
export async function downloadSharedFile(shareUrl: string, path: string, accessToken: string): Promise<Buffer> {
  const arg = JSON.stringify({ url: shareUrl, path });
  const r = await fetchWithRetry("https://content.dropboxapi.com/2/sharing/get_shared_link_file", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Dropbox-API-Arg": arg },
    cache: "no-store",
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Dropbox download ${path}: ${r.status} ${body.slice(0, 300)}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

// Flatten a spreadsheet to CSV text (all sheets) — same shape as
// googleDrive.ts's getSpreadsheetText, but there's no native-Sheets export
// branch (Dropbox has no equivalent), every spreadsheet is a real .xlsx file.
export async function getSpreadsheetText(file: DropboxFile, shareUrl: string, accessToken: string): Promise<string> {
  const buf = await downloadSharedFile(shareUrl, file.id, accessToken);
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.SheetNames.map((n) => `### ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
}
