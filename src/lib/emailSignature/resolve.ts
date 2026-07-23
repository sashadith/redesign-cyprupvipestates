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

// Single resolution path for "what HTML signature does this user send with,
// in this locale" — used by the test email now, and by the Phase 2 compose
// engine later. EN is the fallback when a locale has nothing saved.
export async function getSignatureHtml(userId: string, locale: string): Promise<string> {
  const row = await prisma.userEmailSettings.findUnique({ where: { userId }, select: { signature: true } });
  const sig = (row?.signature as any) ?? {};
  const raw = (sig[locale] || sig.en || "").trim();
  return toHtml(raw);
}
