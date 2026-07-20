// Self-hosted, cookieless page-view tracking. The public layout's <AnalyticsTracker>
// beacons here on each navigation. We store no IP and no PII — only a daily-rotating
// visitor hash (sha256 of salt+date+ip+UA) so unique visitors can be counted without
// identifying anyone. Errors are swallowed: analytics must never break the page.
//
// Non-human/non-confirmed-view traffic is RECORDED (not silently dropped) with an
// isBot/isPrefetch/isTest flag set — every analytics query excludes flagged rows, but
// keeping the rows lets the admin Analytics page show an honest "X excluded today"
// count instead of the classification being invisible. See PageView in schema.prisma.
import { NextRequest, NextResponse } from "next/server";
import { isbot } from "isbot";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { detectDeviceType } from "@/lib/deviceType";
import { lookupCountry } from "@/lib/geoCountry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Defense-in-depth on top of the maintained `isbot` pattern list: named crawlers we
// specifically care about catching (some already covered by isbot, kept explicit so a
// isbot version bump can't silently drop coverage we depend on) plus older headless-
// browser/Lighthouse self-identifications. Modern PageSpeed Insights' Lighthouse run
// does NOT reliably include any of these strings in its UA (confirmed empirically,
// 2026-07-20 — see the isPrefetch/backfill note below for how that traffic is actually
// caught) — this list is for crawlers that DO self-identify honestly.
const EXTRA_BOT_RE =
  /googlebot|bingbot|ahrefsbot|semrushbot|gptbot|claudebot|perplexitybot|bytespider|facebookexternalhit|chrome-lighthouse|headlesschrome/i;

function isBotUA(ua: string): boolean {
  if (!ua) return false;
  return isbot(ua) || EXTRA_BOT_RE.test(ua);
}

// Chrome/Google Search's privacy-preserving prerender fetches a page speculatively,
// server-side, executing real JS (so this beacon fires) — but the visit may never
// actually happen for a real user. The client-side fix (AnalyticsTracker deferring the
// beacon past the Prerendering API's 'prerenderingchange' event) is the primary defense
// and means a real activated view is counted normally with no header needed. This is
// defense-in-depth for browsers/proxies without that API that still fire the beacon
// during a prefetch: the standard signal is the Sec-Purpose (or legacy Purpose) header.
function isPrefetchRequest(req: NextRequest): boolean {
  const secPurpose = req.headers.get("sec-purpose") ?? "";
  const purpose = req.headers.get("purpose") ?? "";
  return /prefetch/i.test(secPurpose) || /prefetch/i.test(purpose);
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";

    const body = await req.json().catch(() => ({}) as any);

    let path = String(body.path ?? "").trim();
    if (!path.startsWith("/")) return new NextResponse(null, { status: 204 });
    if (/^\/(admin|api|_next|uploads)\b/.test(path)) return new NextResponse(null, { status: 204 });
    path = path.split("?")[0].split("#")[0].slice(0, 512);

    const locale = String(body.locale ?? "").trim().slice(0, 8) || null;

    // Reduce referrer to its hostname (privacy-friendly) and drop self-referrals.
    let referrer: string | null = String(body.referrer ?? "").trim() || null;
    if (referrer) {
      try { referrer = new URL(referrer).hostname; } catch { /* keep raw */ }
      referrer = (referrer ?? "").slice(0, 255) || null;
      const host = (req.headers.get("host") ?? "").split(":")[0];
      if (referrer && host && referrer.includes(host)) referrer = null;
    }

    const ip = clientIp(req);
    const salt = process.env.ANALYTICS_SALT ?? "cvp";
    const day = new Date().toISOString().slice(0, 10); // UTC day → hash rotates daily
    const visitorHash = crypto
      .createHash("sha256")
      .update(`${salt}|${day}|${ip}|${ua}`)
      .digest("hex")
      .slice(0, 32);

    // Our own verification/smoke-test beacons — recorded (so a bad deploy is still
    // visible in raw counts if someone goes looking) but excluded from every analytics
    // query, same as bot/prefetch rows. Either the query-string flag (easy from curl,
    // e.g. scripts/qa/smoke.sh) or a header (easy from a fetch()-based check) works.
    const isTest = req.nextUrl.searchParams.get("test") === "1" || req.headers.get("x-analytics-test") === "1";

    await prisma.pageView.create({
      data: {
        path, locale, referrer, userAgent: ua.slice(0, 512), visitorHash,
        deviceType: detectDeviceType(ua),
        country: lookupCountry(ip),
        isBot: isBotUA(ua),
        isPrefetch: isPrefetchRequest(req),
        isTest,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
