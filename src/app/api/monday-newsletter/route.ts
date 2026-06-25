// Newsletter sign-up → Monday.com board.
// Hardened: API key from env (never committed), full anti-spam parity with /api/leads,
// email-format validation, and a PARAMETERIZED GraphQL mutation (no string interpolation
// of user input → no GraphQL injection).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAttribution } from "@/lib/attribution";
import { recordInboundLead } from "@/lib/leadNotify";
import { ALLOWED_HOSTS, safeUrl, blocked, guardRequest, spamSignal, makeRateLimiter } from "@/lib/antispam";

const MONDAY_API_URL = "https://api.monday.com/v2";
const NEWSLETTER_BOARD_ID = process.env.MONDAY_NEWSLETTER_BOARD_ID || "1761993654";
const LEAD_LOCALES = new Set(["en", "de", "pl", "ru"]);

const ipLimiter = makeRateLimiter();
const emailLimiter = makeRateLimiter();

export async function POST(request: Request) {
  const guard = guardRequest(request, ipLimiter);
  if (guard) return guard;
  const referer = request.headers.get("referer") || "";

  try {
    const body = await request.json();
    const { email, currentDate, currentPage } = body;

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

    // Persist to the CRM (system of record). Light dedupe: one NEWSLETTER lead per email.
    try {
      const existing = await prisma.lead.findFirst({
        where: { email: emailNorm, source: "NEWSLETTER" },
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

    // Best-effort sync to the Monday newsletter board (non-fatal; CRM already has it).
    const apiKey = process.env.MONDAY_API_KEY;
    if (apiKey) {
      try {
        const dateNorm = /^\d{4}-\d{2}-\d{2}$/.test(String(currentDate ?? ""))
          ? String(currentDate)
          : new Date().toISOString().split("T")[0];
        // Parameterized mutation — user input travels only via GraphQL variables.
        const query = `
          mutation ($boardId: ID!, $itemName: String!, $cols: JSON!) {
            create_item (board_id: $boardId, item_name: $itemName, column_values: $cols) { id }
          }`;
        const variables = {
          boardId: NEWSLETTER_BOARD_ID,
          itemName: emailNorm,
          cols: JSON.stringify({ date4: dateNorm, text_mkkwhb80: page }),
        };
        const response = await fetch(MONDAY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: apiKey },
          body: JSON.stringify({ query, variables }),
        });
        const data = await response.json();
        if (data.errors) console.error("Monday newsletter API error:", data.errors);
      } catch (e) {
        console.error("Monday newsletter sync error:", e);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Newsletter error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
