// Engagement beacons — what a visitor DID on a page, next to /api/analytics/track's
// "was here". Deliberately the same contract: cookieless, no IP and no PII stored,
// the same daily-rotating visitor hash, and bot/prefetch/test traffic RECORDED with
// a flag rather than dropped, so exclusions stay visible instead of invisible.
//
// It exists because of a question the existing data could not answer. Over 90 days
// 4,085 real visitors reached project pages and 12 enquired — 0.29%. The only
// contact form on such a page sits at line 448 of 484, after the gallery, facts,
// description, unit table, plans and map. Nothing recorded whether the other 4,073
// saw it and declined or never scrolled that far, and those two have opposite fixes.
import { NextRequest, NextResponse } from "next/server";
import { isbot } from "isbot";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { detectDeviceType } from "@/lib/deviceType";
import { lookupCountry } from "@/lib/geoCountry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kept in step with the track route's list on purpose — a bot caught there and
// missed here would quietly inflate engagement rates against honest view counts.
const EXTRA_BOT_RE =
  /googlebot|bingbot|ahrefsbot|semrushbot|gptbot|claudebot|perplexitybot|bytespider|facebookexternalhit|chrome-lighthouse|headlesschrome/i;

/** Closed set. An unknown type is dropped rather than stored: the whole value of
 *  this table is that a count means one specific thing, and a typo'd type that
 *  silently accumulates rows would be worse than no row at all. */
const TYPES = new Set(["scroll_50", "scroll_90", "form_view", "cta_click", "wa_click"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    const body = await req.json().catch(() => ({}) as any);

    const type = String(body.type ?? "").trim();
    if (!TYPES.has(type)) return new NextResponse(null, { status: 204 });

    let path = String(body.path ?? "").trim();
    if (!path.startsWith("/")) return new NextResponse(null, { status: 204 });
    if (/^\/(admin|api|_next|uploads)\b/.test(path)) return new NextResponse(null, { status: 204 });
    path = path.split("?")[0].split("#")[0].slice(0, 512);

    // Only a real Development UUID is kept. A slug or a vendor id here would look
    // joinable and quietly match nothing, which is the failure this project has
    // already paid for once in the Meta pixel.
    const rawId = String(body.contentId ?? "").trim();
    const contentId = UUID_RE.test(rawId) ? rawId : null;

    const ip = clientIp(req);
    const salt = process.env.ANALYTICS_SALT ?? "cvp";
    const day = new Date().toISOString().slice(0, 10); // UTC day → hash rotates daily
    const visitorHash = crypto.createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);

    const secPurpose = req.headers.get("sec-purpose") ?? "";
    const purpose = req.headers.get("purpose") ?? "";

    await prisma.pageEvent.create({
      data: {
        path,
        locale: String(body.locale ?? "").trim().slice(0, 8) || null,
        type,
        contentId,
        visitorHash,
        deviceType: detectDeviceType(ua),
        country: lookupCountry(ip),
        isBot: !!ua && (isbot(ua) || EXTRA_BOT_RE.test(ua)),
        isPrefetch: /prefetch/i.test(secPurpose) || /prefetch/i.test(purpose),
        isTest: req.nextUrl.searchParams.get("test") === "1" || req.headers.get("x-analytics-test") === "1",
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    // Analytics must never break the page.
    return new NextResponse(null, { status: 204 });
  }
}
