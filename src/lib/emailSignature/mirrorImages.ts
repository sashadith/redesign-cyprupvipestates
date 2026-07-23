import { createHash } from "crypto";
import { mkdir, writeFile, access } from "fs/promises";
import { join } from "path";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { SITE_URL } from "@/lib/seo";

// Deliberately NOT src/lib/imageMirror.ts's mirrorImage() — that pipeline
// converts everything to WebP, which many email clients (Outlook desktop in
// particular) don't render. Signature images must keep their original
// format, so this is its own small, un-transformed download-and-store.

const OWN_HOSTS = new Set(["cyprusvipestates.com", "design.cyprusvipestates.com"]);

// SVG deliberately excluded — an <img src> pointing at our own mirrored SVG
// is safe (browsers sandbox script execution in an <img> context), but
// anyone who later links directly to the raw file gets it served as a
// navigable image/svg+xml document, and inline <script>/event handlers in
// an SVG DO execute in that top-level-navigation context. Signature images
// are logos/dividers/icons — raster formats cover every real case.
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

// SSRF guard: this fetch is triggered by a server action reachable by any
// authenticated admin pasting arbitrary signature HTML — without this, it's
// an open fetch-and-serve-back proxy into whatever the VPS can reach
// (loopback services, cloud metadata endpoints, internal-only hosts).
// Resolves the hostname and rejects if ANY answer lands in a
// private/loopback/link-local/reserved range — a string-only hostname check
// wouldn't catch DNS rebinding to the same effect.
function isReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 0) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (isIP(mapped) === 4) return isReservedIp(mapped);
    }
    return false;
  }
  return true; // couldn't classify — fail closed
}

async function assertSafeExternalUrl(src: string): Promise<void> {
  const url = new URL(src); // throws on malformed input — caught by caller
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length) throw new Error("hostname did not resolve");
  for (const { address } of addresses) {
    if (isReservedIp(address)) throw new Error("resolves to a private/reserved address");
  }
}

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
    await assertSafeExternalUrl(src);
    // No auto-follow: a redirect could point at an internal address even
    // when the original URL looked external. A legitimate signature-image
    // CDN that redirects just doesn't get mirrored — falls back to the
    // original (external) src, same as any other failure here.
    const res = await fetch(src, { signal: AbortSignal.timeout(20000), redirect: "manual" });
    if (!res.ok || (res.status >= 300 && res.status < 400)) return null;
    const contentType = res.headers.get("content-type");
    if (!contentType || !/^image\//i.test(contentType) || /svg/i.test(contentType)) return null;
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
