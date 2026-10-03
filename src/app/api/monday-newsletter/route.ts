// Newsletter sign-up → the CRM (Postgres). Nothing leaves the system.
//
// 2026-09-26: the best-effort push to a Monday.com board was removed. The company
// no longer works with Monday, so every sign-up was handing a name and an email
// address to a third party for no purpose — a transfer with no recipient behind
// it, not merely a dead call. It ran whenever MONDAY_API_KEY was present, and
// that variable is still set in the local env, so "the key is dead" was an
// assumption about the far end rather than something this code enforced.
//
// Removing the call is the enforcement. MONDAY_API_KEY and
// MONDAY_NEWSLETTER_BOARD_ID can now go from every environment; nothing reads
// them any more.
//
// Kept from the hardened version: anti-spam parity with /api/leads, email-format
// validation and normalisation, and the per-email rate limit.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAttribution } from "@/lib/attribution";
import { recordInboundLead } from "@/lib/leadNotify";
import { ALLOWED_HOSTS, safeUrl, blocked, guardRequest, spamSignal, makeRateLimiter } from "@/lib/antispam";
import { LOCALES } from "@/lib/locale";

const LEAD_LOCALES = new Set<string>(LOCALES);

const ipLimiter = makeRateLimiter();
const emailLimiter = makeRateLimiter();

export async function POST(request: Request) {
  const guard = guardRequest(request, ipLimiter);
  if (guard) return guard;
  const referer = request.headers.get("referer") || "";

  try {
    const body = await request.json();
    const { email, currentPage } = body; // currentDate was only read by the removed Monday push

    // Page must be on an allowed host and match the referer host.
    const page = String(currentPage ?? "").trim();
    const pageUrl = safeUrl(page);
    if (!pageUrl || !ALLOWED_HOSTS.has(pageUrl.hostname)) return blocked("bad_page");
    const refUrl = safeUrl(referer);
    if (!refUrl || refUrl.hostname !== pageUrl.hostname) return blocked("page_mismatch");

    // Honeypot + timing anti-spam (parity with /api/leads).
    const spam = spamSignal(body);
    if (spam) return blocked(spam);

    // Email validation + normalization.
    const emailNorm = String(email ?? "").trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return blocked("email");
    if (emailNorm.length > 254) return blocked("email_length");
    if (emailLimiter(emailNorm, 3, 60_000)) return blocked("rate_limit_email");

    const langNorm = String(body.lang ?? "").toLowerCase();

    // Persist to the CRM (system of record). Light dedupe: one NEWSLETTER lead
    // per email — scoped to this bucket on purpose. This table IS the mailing
    // list now that the Monday push is gone; a person who is
    // already a lead through another channel and then subscribes gets a second,
    // newsletter-scoped row, deliberately, because a subscriber missing from
    // this list cannot be mailed. Matching across buckets was tried and reverted
    // — it silently dropped every dual-role person off the list, which is worse
    // than the duplicate row it avoided.
    //
    // deletedAt/orderBy below are unrelated hardening from a later pass, not
    // part of that reverted idea: deletedAt excludes trashed leads (a trashed
    // NEWSLETTER lead must not swallow a fresh sign-up), and orderBy is required
    // because Lead.email has no unique constraint — without it, which duplicate
    // matches is undefined.
    try {
      const existing = await prisma.lead.findFirst({
        where: { email: emailNorm, source: "NEWSLETTER", deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!existing) {
        const lead = await prisma.lead.create({
          data: {
            firstName: emailNorm.split("@")[0]?.slice(0, 60) || "Subscriber",
            lastName: "",
            email: emailNorm,
            source: "NEWSLETTER",
            status: "NEW",
            notes: "Newsletter subscription",
            languagePreference: LEAD_LOCALES.has(langNorm) ? (langNorm as any) : null,
            pageSource: page,
            ...parseAttribution(body),
          },
        });
        // Activity only — no Telegram ping (newsletter is high-volume/low-value).
        await recordInboundLead({ leadId: lead.id, source: "NEWSLETTER", email: emailNorm, page, notifyTelegram: false });
      }
    } catch (e) {
      console.error("Newsletter lead persist error:", e);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Newsletter error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
