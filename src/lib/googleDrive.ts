import * as XLSX from "xlsx";

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
  });
  const t = await res.json();
  if (!t.access_token) throw new Error("Google token refresh failed: " + JSON.stringify(t).slice(0, 200));
  return t.access_token as string;
}

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime: string };

export async function listFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  const j = await r.json();
  return (j.files ?? []) as DriveFile[];
}

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
export function findPriceFile(files: DriveFile[]): DriveFile | null {
  const NAME_RE = /price\s*list|pricelist|availab|sales/i;
  const sheets = files.filter((f) => f.mimeType === SHEET_MIME || f.mimeType === XLSX_MIME);
  const namedSheets = sheets.filter((f) => NAME_RE.test(f.name));
  const sheetPool = namedSheets.length ? namedSheets : sheets;
  if (sheetPool.length) return sheetPool.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];

  const namedPdfs = files.filter((f) => f.mimeType === PDF_MIME_FOR_PRICELIST && NAME_RE.test(f.name));
  if (namedPdfs.length) return namedPdfs.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1))[0];

  return null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const IMG_RE = /^image\/(jpe?g|png|webp)$/i;
const normKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Match a project name to a subfolder in the root listing (handles "Name - Location" suffixes).
export function findSubfolder(files: DriveFile[], projectName: string): DriveFile | null {
  const pk = normKey(projectName);
  if (!pk) return null;
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  return (
    folders.find((f) => normKey(f.name) === pk) ||
    folders.find((f) => normKey(f.name).startsWith(pk) || pk.startsWith(normKey(f.name))) ||
    folders.find((f) => normKey(f.name).includes(pk) || pk.includes(normKey(f.name))) ||
    null
  );
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
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: "Bearer " + accessToken } });
  if (!r.ok) throw new Error(`download ${fileId}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Flatten a spreadsheet to CSV text (all sheets). Native Google Sheets export
// directly; uploaded .xlsx are downloaded and parsed with SheetJS.
export async function getSpreadsheetText(file: DriveFile, accessToken: string): Promise<string> {
  const H = { Authorization: "Bearer " + accessToken };
  if (file.mimeType === SHEET_MIME) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv&supportsAllDrives=true`, { headers: H });
    return await r.text();
  }
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers: H });
  const ab = await r.arrayBuffer();
  const wb = XLSX.read(Buffer.from(ab), { type: "buffer" });
  return wb.SheetNames.map((n) => `### ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
}
