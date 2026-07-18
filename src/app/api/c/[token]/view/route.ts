import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, dailyVisitorHash } from "@/lib/visitorHash";
import { makeRateLimiter, clientIp, escapeHtml } from "@/lib/antispam";
import { sendTelegramMessage } from "@/lib/telegram";

const ipLimiter = makeRateLimiter();

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }

// Build from the actual request, not a hardcoded production URL — this admin
// panel currently lives on staging, and a Telegram link pointing at the wrong
// domain's CRM is confusing at best (see api/admin/presentations/route.ts for
// the same fix on the presentation link itself).
function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (ipLimiter(clientIp(req), 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => ({}) as any);

  const presentation = await prisma.clientPresentation.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, expiresAt: true, greetingName: true },
  });
  if (!presentation || presentation.status !== "active" || (presentation.expiresAt && presentation.expiresAt < new Date())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // sendBeacon duration update: { viewId, durationSec } — best-effort, no reply body needed.
  if (body.viewId) {
    const durationSec = Number(body.durationSec);
    if (Number.isFinite(durationSec) && durationSec >= 0 && durationSec < 24 * 3600) {
      await prisma.presentationView.updateMany({ where: { id: String(body.viewId), presentationId: presentation.id }, data: { durationSec: Math.round(durationSec) } }).catch(() => {});
    }
    return new NextResponse(null, { status: 204 });
  }

  const developmentId = body.developmentId ? String(body.developmentId) : null;

  // Everything we need to know BEFORE inserting the new row: has this
  // presentation ever been viewed, and on how many distinct earlier days.
  const priorViews = await prisma.presentationView.findMany({
    where: { presentationId: presentation.id },
    select: { createdAt: true },
  });
  const isFirstViewEver = priorViews.length === 0;
  const today = todayUTC();
  const priorDays = new Set(priorViews.map((v) => v.createdAt.toISOString().slice(0, 10)));
  const isFirstViewToday = !priorDays.has(today);
  const distinctEarlierDays = new Set(Array.from(priorDays).filter((d) => d !== today)).size;

  const ip = clientIpFromHeaders(req.headers);
  const ua = req.headers.get("user-agent") ?? "";
  const view = await prisma.presentationView.create({
    data: { presentationId: presentation.id, developmentId, sessionHash: dailyVisitorHash(ip, ua) },
    select: { id: true },
  });

  // Opening a specific property's overlay is the client actually looking at
  // it — clear its "New for you" badge so it doesn't linger after they've
  // seen it once.
  if (developmentId) {
    await prisma.clientPresentationItem.updateMany({
      where: { presentationId: presentation.id, developmentId, isNew: true },
      data: { isNew: false },
    }).catch(() => {});
  }

  const crmLink = `${requestOrigin(req)}/admin/crm`; // per-lead deep link not resolvable from a view alone without another query; kept simple + best-effort
  const name = escapeHtml(presentation.greetingName);

  // Alerts are mutually exclusive and best-effort — never let a Telegram hiccup
  // break the page for the client.
  try {
    if (isFirstViewEver) {
      await sendTelegramMessage(`👀 ${name} opened their personal page — <a href="${crmLink}">CRM</a>`);
    } else if (isFirstViewToday && distinctEarlierDays >= 2) {
      // Guarded to at most one per presentation per day by isFirstViewToday itself.
      const visitNumber = distinctEarlierDays + 1;
      await sendTelegramMessage(`🔥 ${name} is back on their page (visit #${visitNumber})`);
    }
  } catch (e) { console.error("Presentation view Telegram alert failed:", e); }

  // LeadActivity: only the first view per day, so repeat card-opens don't spam the timeline.
  if (isFirstViewToday) {
    const p = await prisma.clientPresentation.findUnique({ where: { id: presentation.id }, select: { leadId: true } });
    if (p) {
      await prisma.leadActivity.create({
        data: { leadId: p.leadId, type: "PRESENTATION_VIEWED", content: isFirstViewEver ? "Presentation opened for the first time" : "Presentation viewed again" },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ id: view.id });
}
