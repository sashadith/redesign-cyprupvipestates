import { workbookToText } from "@/lib/sheetToText";

/* Minimal Google Drive REST client for the availability sync. Uses a stored OAuth
   refresh token (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN),
   read-only scope — no googleapis SDK. */

export function driveConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

export function folderIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const t = await res.json();
  if (!t.access_token) throw new Error("Google token refresh failed: " + JSON.stringify(t).slice(0, 200));
  return t.access_token as string;
}

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime: string };

// Every fetch() in this file passes `cache: "no-store"` (2026-08-12) — without it,
// Next.js's Data Cache stores GET responses for a year by default, and since
// deploy-prod.sh copies .next/cache forward across releases, a stale response (a
// folder listing, a spreadsheet, even an error) never expires on its own. This is
// how a single expired-token 401 on Motive Point's PDF download kept getting
// replayed for days across multiple deploys with fixed tokens and fixed code —
// the fetch never actually reached Google again. Drive content must always be
// read fresh regardless: a cached listing/file is stale by definition here.
export async function listFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken }, cache: "no-store" });
  const j = await r.json();
  return (j.files ?? []) as DriveFile[];
}

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Uploaded-workbook formats, all read by SheetJS (workbookToText) through the same
// download path — only the native Google Sheet needs its own CSV export branch.
// .xlsm is not hypothetical (2026-08-24): Olias Homes' Caldera Estate keeps its
// price list as "Sales Catalogue (Caldera Estate).xlsm", and with only the plain
// .xlsx type recognised, that folder read as "no price list at all".
// Compared lower-cased, deliberately: Drive returns the .xlsm type as
// "application/vnd.ms-excel.sheet.macroenabled.12", NOT the IANA-registered
// camelCase "…macroEnabled.12". Matching the spec's spelling literally is how
// Caldera Estate's folder still read as "no price list" after .xlsm support was
// added (measured against the live folder, 2026-08-24).
const WORKBOOK_MIMES = new Set([
  XLSX_MIME,
  "application/vnd.ms-excel.sheet.macroenabled.12", // .xlsm
  "application/vnd.ms-excel", // .xls
]);
const isSpreadsheet = (f: DriveFile) => {
  const m = (f.mimeType || "").toLowerCase();
  return m === SHEET_MIME || WORKBOOK_MIMES.has(m);
};
const PDF_MIME_FOR_PRICELIST = "application/pdf";

// The price list = a spreadsheet whose name looks like one, else the most recently
// modified spreadsheet in the folder. Spreadsheets are strictly preferred — a
// developer who provides both keeps using the more reliable source.
//
// PDF (2026-08-12, Motive Point) — some developers only ever export a combined PDF,
// no spreadsheet at all. A PDF candidate is ONLY ever considered when its name also
// matches the same price-list pattern (never "any PDF in the folder" — a folder can
// easily hold an unrelated brochure/spec PDF at root level, see e.g. Olias Homes'
// "Payment Schedule…docx" sitting right next to its real price list). Downstream,
// syncDeveloperDrive branches on the returned file's mimeType and routes a PDF match
// through pdfPricelistExtract.ts instead of getSpreadsheetText — see that module's
// doc comment for why status is never read from the PDF text itself.
//
// Both fallbacks (unnamed spreadsheet, PDF) are switchable off via FindPriceOpts —
// see listProjectFolders, which needs the strict form.
//
// "Sales Catalogue - Birch Park.xlsx", "Arbeo Park_Sales.xlsx", "Price List.xlsx",
// "MP Price List.pdf" — one regex, every developer's naming habit so far. "catalogue"
// added 2026-08-24: Olias Homes names every per-project sheet "Sales Catalogue - <Project>",
// which the "sales" alternative already covered, but a developer using the word alone
// ("Catalogue 2026.xlsx") would not have matched.
export const PRICE_NAME_RE = /price\s*list|pricelist|availab|sales|catalogue|catalog/i;

export type FindPriceOpts = {
  /** Never fall back to "the most recently modified spreadsheet in the folder".
   *  Mandatory when searching a PROJECT's own subfolder (see listProjectFolders):
   *  a project folder routinely holds unrelated spreadsheets (payment schedules,
   *  reservation forms), and the loose fallback would happily promote one of them
   *  to "this project's price list" and then prune every real unit against it. */
  requireNamed?: boolean;
  /** Ignore PDF candidates entirely. Also for the per-project scan: a PDF price
   *  list needs the text-colour status pipeline (pdfPricelistExtract.ts), which
   *  only runs on the developer-wide path — a PDF picked up here would be read as
   *  a plain spreadsheet and lose every sold/reserved marker. Reported as "no
   *  price list" instead, which is visible, rather than silently mis-parsed. */
  spreadsheetsOnly?: boolean;
};

export function findPriceFile(files: DriveFile[], opts: FindPriceOpts = {}): DriveFile | null {
  const sheets = files.filter(isSpreadsheet);
  const namedSheets = sheets.filter((f) => PRICE_NAME_RE.test(f.name));
  const sheetPool = opts.requireNamed ? namedSheets : namedSheets.length ? namedSheets : sheets;
  if (sheetPool.length) return sheetPool.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];
  if (opts.spreadsheetsOnly) return null;

  const namedPdfs = files.filter((f) => f.mimeType === PDF_MIME_FOR_PRICELIST && PRICE_NAME_RE.test(f.name));
  if (namedPdfs.length) return namedPdfs.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];

  return null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const IMG_RE = /^image\/(jpe?g|png|webp)$/i;
const normKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Match a project name to a subfolder in the root listing (handles "Name - Location"
// suffixes). One-level nested descent (2026-08-12, accessToken optional for callers
// that can't/don't need it — falls back to top-level-only matching without it):
// confirmed on real data (Motive Point) that a developer can nest a more specific
// project folder ("2. Venara View") INSIDE a broader one ("Venara") rather than
// keeping every project as its own top-level sibling — a flat, one-level-only search
// then has no way to find "Venara View"'s own folder and silently falls back to its
// parent "Venara", pulling in the WRONG project's images/plans. An exact top-level
// match is always returned immediately without ever descending (so the base "Venara"
// project itself is untouched by this); only when no top-level match is exact do we
// list the contents of top-level FUZZY candidates and prefer a nested folder that
// matches better than its parent did.
export async function findSubfolder(files: DriveFile[], projectName: string, accessToken?: string): Promise<DriveFile | null> {
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
        const children = (await listFolder(parent.id, accessToken)).filter((c) => c.mimeType === FOLDER_MIME);
        const nested = children.find((c) => normKey(c.name) === pk) || children.find((c) => normKey(c.name).includes(pk));
        if (nested) return nested;
      } catch {
        /* best-effort — fall through to the parent-level match below */
      }
    }
  }

  return fuzzyParents[0] ?? null;
}

// Media/aux subfolders that appear INSIDE a project folder and must never be
// mistaken for a project of their own. Only used to filter the root listing —
// a real project would have to be named exactly one of these words to be lost,
// and the scan reports every folder it looked at either way.
const AUX_FOLDER_RE = /^(photos?|renders?|images?|pictures?|drawings?|plans?|floor\s*plans?|masterplans?|brochures?|videos?|documents?|docs|location|archive|old|misc)$/i;

export type DriveProjectFolder = {
  folder: DriveFile;
  /** The folder's own listing — already fetched here, so callers never re-list it. */
  files: DriveFile[];
  /** Its own price list, or null when the folder has none. */
  price: DriveFile | null;
};

/* Every top-level project folder under the developer's shared root, each with its
   OWN price list resolved (2026-08-24, Olias Homes).

   Why this exists: until now a Drive developer's projects came exclusively from the
   ONE developer-wide master sheet at the root, and the project subfolders were only
   ever read afterwards, for images/plans of a project that sheet had already created.
   Olias Homes doesn't work that way — every project folder carries its own
   authoritative "Sales Catalogue - <Project>.xlsx", and the root master sheet is a
   stale partial copy (four projects — Amalfi Homes, Birch Park, Caldera Estate,
   Osmia Bee Home — have a folder and their own catalogue but no row in it at all,
   and so never existed for us). Folder = project identity, exactly the model
   dropboxAvailabilitySync.ts already uses for Kuutio, and for the same reason: an
   identity read off the source's own structure is a fact, an identity guessed by AI
   from a shared document is not.

   Top level only, deliberately. A nested-project developer (Motive Point keeps
   "2. Venara View" inside "Venara") keeps working exactly as before — no per-project
   sheet is found for it, and the master-sheet path stays in charge. Descending would
   put project creation one wrong regex away from turning "Birch Park/Drawings" into
   a project. */
export async function listProjectFolders(rootFiles: DriveFile[], accessToken: string): Promise<DriveProjectFolder[]> {
  const folders = rootFiles.filter((f) => f.mimeType === FOLDER_MIME && !AUX_FOLDER_RE.test(f.name.trim()));
  const out: DriveProjectFolder[] = [];
  for (const folder of folders) {
    let files: DriveFile[] = [];
    try {
      files = await listFolder(folder.id, accessToken);
    } catch {
      // One unreadable folder must not fail the whole developer's sync — it is
      // reported as "no price list" and simply contributes nothing this run.
      out.push({ folder, files: [], price: null });
      continue;
    }
    out.push({ folder, files, price: findPriceFile(files, { requireNamed: true, spreadsheetsOnly: true }) });
  }
  return out;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

// Top-level (non-recursive) docx/pdf files sitting directly in the project's own
// subfolder — "Project Information.docx", a Presentation/Specifications PDF —
// that often carry good marketing copy the price list never has. Excludes the
// master price list itself and caps the count (each one costs an AI/parse call).
export function findInfoDocuments(files: DriveFile[], maxCount = 2): DriveFile[] {
  return files
    .filter((f) => f.mimeType === DOCX_MIME || f.mimeType === PDF_MIME)
    .filter((f) => !/price\s*list|pricelist|availab/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, maxCount);
}

// Recurse a project subfolder collecting image files. Renders → images; anything in
// a "drawing/plan/floor" folder → plans. Returns a change-signature (id:modifiedTime).
export async function collectMedia(
  folderId: string,
  accessToken: string,
  opts: { maxImages?: number; maxPlans?: number; maxDepth?: number } = {},
): Promise<{ images: DriveFile[]; plans: DriveFile[]; sig: string }> {
  const maxDepth = opts.maxDepth ?? 3;
  const images: DriveFile[] = [];
  const plans: DriveFile[] = [];
  const walk = async (id: string, depth: number, inPlans: boolean) => {
    if (depth > maxDepth) return;
    const files = await listFolder(id, accessToken);
    for (const f of files) {
      if (f.mimeType === FOLDER_MIME) {
        await walk(f.id, depth + 1, inPlans || /draw|plan|floor/i.test(f.name));
      } else if (IMG_RE.test(f.mimeType)) {
        (inPlans ? plans : images).push(f);
      } else if (inPlans && f.mimeType === "application/pdf") {
        plans.push(f);
      }
    }
  };
  await walk(folderId, 0, false);
  images.sort((a, b) => a.name.localeCompare(b.name));
  plans.sort((a, b) => a.name.localeCompare(b.name));
  const sig = [...images, ...plans].map((f) => f.id + ":" + f.modifiedTime).sort().join("|").slice(0, 6000);
  return {
    images: opts.maxImages ? images.slice(0, opts.maxImages) : images,
    plans: opts.maxPlans ? plans.slice(0, opts.maxPlans) : plans,
    sig,
  };
}

export async function downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: "Bearer " + accessToken }, cache: "no-store" });
  if (!r.ok) {
    // Body included (2026-08-12) — a bare status code gave zero signal for a
    // real intermittent failure (Motive Point's PDF download 401'd 3/3 times
    // through the live app, 0/4 times via an isolated script running the exact
    // same request sequence) with no way to tell an expired/invalid-grant token
    // apart from a per-file access issue apart from something else entirely.
    const body = await r.text().catch(() => "");
    throw new Error(`download ${fileId}: ${r.status} ${body.slice(0, 300)}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

// Flatten a spreadsheet to CSV text (all sheets). Native Google Sheets export
// directly; uploaded .xlsx are downloaded and parsed with SheetJS.
export async function getSpreadsheetText(file: DriveFile, accessToken: string): Promise<string> {
  const H = { Authorization: "Bearer " + accessToken };
  if (file.mimeType === SHEET_MIME) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv&supportsAllDrives=true`, { headers: H, cache: "no-store" });
    return await r.text();
  }
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers: H, cache: "no-store" });
  const ab = await r.arrayBuffer();
  return workbookToText(Buffer.from(ab));
}
