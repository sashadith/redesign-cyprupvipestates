import crypto from "crypto";
import type { GuideLang } from "./types";

/** Download links for lead-magnet guides are signed, expire after 30 days, and are bound to one guide + language.
 *  The PDF itself is never served from a public static path. */
export const GUIDE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.GUIDE_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("GUIDE_TOKEN_SECRET (or AUTH_SECRET) is not set");
  return s;
}

function mac(id: string, lang: string, exp: string): string {
  return crypto.createHmac("sha256", secret()).update(`${id}|${lang}|${exp}`).digest("base64url").slice(0, 32);
}

export function signGuideToken(id: string, lang: GuideLang, now = Date.now()): string {
  const exp = (now + GUIDE_TOKEN_TTL_MS).toString(36);
  return `${exp}.${mac(id, lang, exp)}`;
}

export function verifyGuideToken(id: string, lang: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token || token.length > 80) return false;
  const [exp, sig, ...rest] = token.split(".");
  if (!exp || !sig || rest.length) return false;
  const expMs = parseInt(exp, 36);
  if (!Number.isFinite(expMs) || expMs < now) return false;
  const want = Buffer.from(mac(id, lang, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function guideDownloadPath(id: string, lang: GuideLang, now = Date.now()): string {
  return `/api/guides/${id}?lang=${lang}&t=${signGuideToken(id, lang, now)}`;
}
