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

// Generous for a signature logo/icon/divider; guards against an oversized
// or malicious response being buffered fully in memory.
const MAX_BYTES = 5 * 1024 * 1024;

// Candidate extensions we ever write — used to probe for an already-mirrored
// file before downloading (see mirrorOne), since the real extension is only
// known after inspecting the downloaded bytes.
const KNOWN_EXTENSIONS = ["png", "jpg", "gif", "webp"] as const;

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

// Real-format detection via magic bytes on the downloaded buffer — never the
// server's Content-Type header (gimm.io serves its social icons as
// application/octet-stream, which silently rejected 6 of 7 images before
// this fix) and never the URL's own extension. Deliberately allowlist-only:
// anything that isn't recognized as PNG/JPEG/GIF/WEBP is rejected outright,
// which is also what keeps SVG (script-capable when linked to directly,
// see the comment history on this file) out — SVG's bytes never match any
// of these four signatures, so it can't slip through regardless of what
// content-type a server claims.
function detectImageType(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (buf.length >= 3 && buf.toString("latin1", 0, 3) === "GIF") {
    return { ext: "gif", contentType: "image/gif" };
  }
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

const dirFor = (userId: string) => join(process.cwd(), "public", "uploads", "signatures", userId);
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const exists = (p: string) => access(p).then(() => true).catch(() => false);

function warn(src: string, reason: string) {
  console.warn(`[emailSignature] rejected image (${reason}): ${src}`);
}

async function mirrorOne(src: string, userId: string): Promise<string | null> {
  const h = hash(src);
  const dir = dirFor(userId);

  // Idempotent without knowing the extension up front: the real format is
  // only known after inspecting the downloaded bytes, so probe every
  // extension we ever write for an existing file before re-fetching.
  for (const ext of KNOWN_EXTENSIONS) {
    const candidate = join(dir, `${h}.${ext}`);
    if (await exists(candidate)) return `${SITE_URL}/uploads/signatures/${userId}/${h}.${ext}`;
  }

  try {
    await assertSafeExternalUrl(src);
    // No auto-follow: a redirect could point at an internal address even
    // when the original URL looked external. A legitimate signature-image
    // CDN that redirects just doesn't get mirrored — falls back to the
    // original (external) src, same as any other failure here.
    const res = await fetch(src, { signal: AbortSignal.timeout(20000), redirect: "manual" });
    if (!res.ok || (res.status >= 300 && res.status < 400)) {
      warn(src, `HTTP ${res.status}`);
      return null;
    }
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BYTES) {
      warn(src, `declared size ${declaredLength} bytes exceeds ${MAX_BYTES}`);
      return null;
    }
    // Content-Type is intentionally never consulted as an acceptance
    // criterion — only used to decide download vs. reject, and it isn't
    // even that anymore; real type comes from the bytes below.
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      warn(src, `actual size ${buf.length} bytes exceeds ${MAX_BYTES}`);
      return null;
    }
    const detected = detectImageType(buf);
    if (!detected) {
      warn(src, "unrecognized format — not PNG/JPEG/GIF/WEBP by magic bytes");
      return null;
    }
    const file = join(dir, `${h}.${detected.ext}`);
    const publicPath = `/uploads/signatures/${userId}/${h}.${detected.ext}`;
    await mkdir(dir, { recursive: true });
    await writeFile(file, buf);
    return `${SITE_URL}${publicPath}`;
  } catch (e: any) {
    warn(src, e?.message || "fetch error");
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

export type MirrorResult = { html: string; failedCount: number };

// Rewrites every external <img src> in `html` to a locally-mirrored,
// absolute URL. Already-local/relative/data: srcs pass through untouched.
// Idempotent: a src already mirrored on a previous save is detected and
// reused without re-downloading. Every rejection is logged (see warn())
// with the source URL and reason, and the total failure count is returned
// so the caller can surface it to the admin instead of failing silently.
export async function mirrorSignatureImages(html: string, userId: string): Promise<MirrorResult> {
  let failedCount = 0;
  const out = await replaceAsync(html, IMG_SRC_RE, async (_full: string, pre: string, src: string, post: string) => {
    if (isAlreadyLocal(src)) return `${pre}${src}${post}`;
    const mirrored = await mirrorOne(src, userId);
    if (!mirrored) failedCount += 1;
    return `${pre}${mirrored ?? src}${post}`;
  });
  return { html: out, failedCount };
}
