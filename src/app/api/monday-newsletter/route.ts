// Newsletter sign-up → Monday.com board.
// Hardened: API key from env (never committed), full anti-spam parity with /api/leads,
// email-format validation, and a PARAMETERIZED GraphQL mutation (no string interpolation
// of user input → no GraphQL injection).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAttribution } from "@/lib/attribution";
import { recordInboundLead } from "@/lib/leadNotify";
import { ALLOWED_HOSTS, safeUrl, blocked, guardRequest, spamSignal, makeRateLimiter } from "@/lib/antispam";
import { bucketOf } from "@/lib/crm/leadBucket";

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

    // Persist to the CRM (system of record). Light dedupe: one lead per email address, whatever bucket it is in.
    try {
      // Match on the address alone, NOT on source as well. A subscriber can be
      // moved out of the newsletter bucket (see moveLeadToBucket in
      // src/app/admin/actions.ts) — matching on source too would stop
      // recognising them and create a second lead with the same address the next
      // time they subscribed.
      //
      // deletedAt: null excludes trashed leads — same as every other "is this
      // person already represented" lookup in the codebase. A trashed lead is
      // deliberately out of circulation, so someone whose lead was trashed and
      // who then subscribes gets a FRESH lead, not a silent write onto a record
      // no admin view will ever show them. That is what already happened before
      // this branch for every source except NEWSLETTER; this restores it.
      //
      // orderBy pins which duplicate wins when more than one lead shares this
      // address (the very duplication this task exists to stop creating more
      // of) — the oldest surviving lead is the canonical one, so the timeline
      // entry below always lands on the same record instead of scattering
      // across whichever duplicate findFirst happens to return.
      const existing = await prisma.lead.findFirst({
        where: { email: emailNorm, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, source: true },
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
      } else if (bucketOf(existing.source) !== "newsletter") {
        // A lead who already existed through another channel has now ALSO
        // subscribed. That is a real event, and widening the dedupe above is
        // what would otherwise swallow it: before, this person got a second,
        // duplicate NEWSLETTER lead that at least recorded the fact. Their
        // source is deliberately NOT changed — they are a real enquiry first,
        // and a subscriber second; only the timeline gains an entry.
        //
        // Guarded on source so a genuine RE-subscription by an existing
        // subscriber stays the silent no-op it has always been.
        //
        // Written inline rather than through recordInboundLead: that helper sets
        // direction "INBOUND", and the Cockpit reads the newest interaction with
        // a non-null direction as "last contact". Routing a newsletter sign-up
        // through it would reset a months-cold prospect's last-contact to now —
        // from a public, unauthenticated form — while the colour dot and the
        // Action Center, which key off interaction TYPE, still called them
        // overdue. The event is worth recording; it is not a contact.
        const subscribed = "Subscribed to the newsletter";
        await prisma.leadActivity.create({
          data: { leadId: existing.id, type: "NEWSLETTER_SIGNUP", content: subscribed, createdBy: "website" },
        });
        await prisma.leadInteraction.create({
          data: { leadId: existing.id, type: "SYSTEM", channel: "SYSTEM", direction: null, body: subscribed, metadata: { page }, createdByName: "website" },
        });
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
