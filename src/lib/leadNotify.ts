// Shared "new inbound lead" handling for the public capture routes (audit M1 + L1):
// records an INBOUND activity on the lead's timeline and optionally pings Telegram +
// sets the telegramNotified flag. Used by /api/email, /api/roi-calculator and
// /api/monday-newsletter so notification behaviour is consistent across sources.
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { isLocale, LOCALE_LABELS, type Locale } from "@/lib/locale";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Normalizes a raw submitted `lang` value (any casing, or junk) to a known
// Locale for both `Lead.languagePreference` and `recordInboundLead`'s
// `language` option, or null when unrecognized. Shared by every capture
// route (fix-round item: the ROI-calculator and partner-form routes each
// duplicated this check locally but never passed the result on to
// `recordInboundLead`, so a Hebrew submission's Telegram alert never showed
// "HE" even though `telegramLanguageTag` already supported it).
export function normalizeLeadLocale(lang: unknown): Locale | null {
  const v = String(lang ?? "").trim().toLowerCase();
  return isLocale(v) ? v : null;
}

// Upper-cased locale code for a Telegram alert line (e.g. "HE", "DE"), or
// null when there's nothing to show. Reads LOCALE_LABELS (the single source
// of locale metadata) rather than special-casing a fixed set of codes, so a
// future sixth locale needs no change here — a known locale renders its
// LOCALE_LABELS code, anything else (legacy junk, a locale added to LOCALES
// after this shipped) still degrades to its own upper-cased value instead of
// silently vanishing.
export function telegramLanguageTag(locale: string | null | undefined): string | null {
  if (!locale) return null;
  return isLocale(locale) ? LOCALE_LABELS[locale].code : locale.toUpperCase();
}

// Pure message builder (no DB, no Telegram call) — split out of
// recordInboundLead so it's directly testable with fakes. Admin-facing copy
// stays English per project convention.
export function buildInboundLeadTelegramMessage(opts: {
  source: string;
  email: string;
  name?: string;
  phone?: string | null;
  page?: string;
  language?: string | null;
  link: string;
}): string {
  const langTag = telegramLanguageTag(opts.language);
  return (
    `<b>New ${esc(opts.source.replace(/_/g, " "))} lead</b>\n` +
    `<b>${esc(opts.name || "-")}</b>\n` +
    `Email: ${esc(opts.email)}\nPhone: ${esc(opts.phone || "-")}\n` +
    (langTag ? `Language: ${esc(langTag)}\n` : "") +
    (opts.page ? `Page: ${esc(opts.page)}\n` : "") +
    `\n<a href="${opts.link}">Open in CRM</a>`
  );
}

export async function recordInboundLead(opts: {
  leadId: string;
  source: string;
  email: string;
  name?: string;
  phone?: string | null;
  page?: string;
  language?: string | null; // lead's languagePreference, when known — renders as an upper-cased locale code
  notifyTelegram?: boolean; // default true; pass false for low-value/high-volume sources
}) {
  // Timeline entry so every lead (not just manual ones) has a creation activity.
  const inboundContent = `Lead received via ${opts.source.replace(/_/g, " ")}`;
  try {
    await prisma.leadActivity.create({
      data: { leadId: opts.leadId, type: "INBOUND", content: inboundContent, createdBy: "website" },
    });
  } catch (e) {
    console.error("inbound activity error:", e);
  }
  try {
    await prisma.leadInteraction.create({
      data: { leadId: opts.leadId, type: "SYSTEM", direction: "INBOUND", channel: "SYSTEM", body: inboundContent, createdByName: "website" },
    });
  } catch (e) {
    console.error("inbound interaction error:", e);
  }

  if (opts.notifyTelegram === false) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const link = `${siteUrl}/admin/crm/${opts.leadId}`;
  const msg = buildInboundLeadTelegramMessage({ ...opts, link });
  try {
    const tgResult = await sendTelegramMessage(msg);
    if (tgResult) {
      await prisma.lead.update({ where: { id: opts.leadId }, data: { telegramNotified: true } });
    }
  } catch (e) {
    console.error("lead telegram error:", e);
  }
}
