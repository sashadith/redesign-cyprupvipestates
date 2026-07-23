import { createHash } from "crypto";
import { mkdir, writeFile, access } from "fs/promises";
import { join } from "path";
import { SITE_URL } from "@/lib/seo";

// Deliberately NOT src/lib/imageMirror.ts's mirrorImage() — that pipeline
// converts everything to WebP, which many email clients (Outlook desktop in
// particular) don't render. Signature images must keep their original
// format, so this is its own small, un-transformed download-and-store.

const OWN_HOSTS = new Set(["cyprusvipestates.com", "design.cyprusvipestates.com"]);

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

function isAlreadyLocal(src: string): boolean {
  if (src.startsWith("/")) return true;
  if (src.startsWith("data:")) return true; // inline — nothing to mirror
  try {
    return OWN_HOSTS.has(new URL(src).hostname);
  } catch {
    return true; // unparseable — leave it alone rather than guess
  }
}

function extensionFor(src: string, contentType: string | null): string {
  if (contentType) {
    const base = contentType.split(";")[0].trim().toLowerCase();
    if (EXT_BY_CONTENT_TYPE[base]) return EXT_BY_CONTENT_TYPE[base];
  }
  const fromUrl = src.split("?")[0].split(".").pop();
  if (fromUrl && /^[a-z0-9]{2,5}$/i.test(fromUrl)) return fromUrl.toLowerCase();
  return "jpg";
}

const dirFor = (userId: string) => join(process.cwd(), "public", "uploads", "signatures", userId);
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const exists = (p: string) => access(p).then(() => true).catch(() => false);

async function mirrorOne(src: string, userId: string): Promise<string | null> {
  const h = hash(src);
  const dir = dirFor(userId);
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    if (contentType && !/^image\//i.test(contentType)) return null;
    const ext = extensionFor(src, contentType);
    const file = join(dir, `${h}.${ext}`);
    const publicPath = `/uploads/signatures/${userId}/${h}.${ext}`;
    if (await exists(file)) return `${SITE_URL}${publicPath}`; // idempotent
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(file, buf);
    return `${SITE_URL}${publicPath}`;
  } catch {
    return null;
  }
}

// Async-safe regex replace: sanitize-html's output uses double-quoted attrs,
// but tolerate single quotes too (input passed through unaltered by the
// sanitizer for attribute quoting style in some edge cases).
async function replaceAsync(str: string, re: RegExp, fn: (...args: string[]) => Promise<string>): Promise<string> {
  const matches: { match: string; args: string[]; index: number }[] = [];
  str.replace(re, (match: string, ...rest: any[]) => {
    const args = rest.slice(0, -2); // drop offset + full string
    matches.push({ match, args, index: rest[rest.length - 2] });
    return match;
  });
  if (!matches.length) return str;
  const replacements = await Promise.all(matches.map((m) => fn(m.match, ...m.args)));
  let out = "";
  let cursor = 0;
  matches.forEach((m, i) => {
    out += str.slice(cursor, m.index) + replacements[i];
    cursor = m.index + m.match.length;
  });
  out += str.slice(cursor);
  return out;
}

const IMG_SRC_RE = /(<img\b[^>]*\bsrc\s*=\s*")([^"]+)("[^>]*>)/gi;

// Rewrites every external <img src> in `html` to a locally-mirrored,
// absolute URL. Already-local/relative/data: srcs pass through untouched.
// Idempotent: a src already pointing at our own mirrored path is left as-is,
// and re-mirroring the same remote URL skips the download on the 2nd+ save.
export async function mirrorSignatureImages(html: string, userId: string): Promise<string> {
  return replaceAsync(html, IMG_SRC_RE, async (_full: string, pre: string, src: string, post: string) => {
    if (isAlreadyLocal(src)) return `${pre}${src}${post}`;
    const mirrored = await mirrorOne(src, userId);
    return `${pre}${mirrored ?? src}${post}`;
  });
}
