// Self-hosted, cookieless page-view tracking. The public layout's <AnalyticsTracker>
// beacons here on each navigation. We store no IP and no PII — only a daily-rotating
// visitor hash (sha256 of salt+date+ip+UA) so unique visitors can be counted without
// identifying anyone. Errors are swallowed: analytics must never break the page.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|monitor|curl|wget|python-requests|axios|phantom|lighthouse|pingdom|uptime/i;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });

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

    const salt = process.env.ANALYTICS_SALT ?? "cvp";
    const day = new Date().toISOString().slice(0, 10); // UTC day → hash rotates daily
    const visitorHash = crypto
      .createHash("sha256")
      .update(`${salt}|${day}|${clientIp(req)}|${ua}`)
      .digest("hex")
      .slice(0, 32);

    await prisma.pageView.create({
      data: { path, locale, referrer, userAgent: ua.slice(0, 512), visitorHash },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
