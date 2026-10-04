import { prisma } from "@/lib/prisma";
import { looksLikeHtml } from "./sanitize";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Legacy plain-text signatures (saved before this HTML upgrade) keep working
// with no forced re-entry — wrapped into a minimal paragraph at resolution
// time rather than at save time, so the raw stored value never changes.
function toHtml(raw: string): string {
  if (!raw) return "";
  if (looksLikeHtml(raw)) return raw; // already sanitized at save time
  return `<p style="white-space:pre-wrap;">${escapeHtml(raw).replace(/\n/g, "<br />")}</p>`;
}

// Pure "which signature wins" resolver, split out of getSignatureHtml so it's
// testable without a database — reads `signature[locale]` generically (any
// Locale, incl. `he`); the stored JSON simply may not have a `he` key yet
// (Hebrew Localization Phase 7: the admin signature editor only writes one
// when the operator actually typed something), in which case this falls back
// to `en` exactly like any other unset locale.
export function resolveSignatureHtml(sig: Record<string, string> | null | undefined, locale: string): string {
  const raw = ((sig?.[locale] || sig?.en || "") as string).trim();
  return toHtml(raw);
}

// Single resolution path for "what HTML signature does this user send with,
// in this locale" — used by the test email now, and by the Phase 2 compose
// engine later.
export async function getSignatureHtml(userId: string, locale: string): Promise<string> {
  const row = await prisma.userEmailSettings.findUnique({ where: { userId }, select: { signature: true } });
  return resolveSignatureHtml((row?.signature as any) ?? {}, locale);
}

// Named to match the Phase 7 plan's interface (`resolveSignature(userId,
// locale)`) — same function, kept as an alias so both names work rather than
// forcing every existing call site to rename.
export const resolveSignature = getSignatureHtml;
