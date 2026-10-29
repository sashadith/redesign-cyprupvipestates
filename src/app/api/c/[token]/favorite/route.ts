import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeRateLimiter, clientIp, escapeHtml } from "@/lib/antispam";
import { sendTelegramMessage } from "@/lib/telegram";
import { getCrmUser } from "@/lib/crm/session";

// No admin/user auth here by design — the token itself IS the auth for a
// client-side presentation page with no account system. Rate-limited per IP
// (reusing the same in-memory limiter shape as the public lead endpoints).
const ipLimiter = makeRateLimiter();

// Same origin logic as the view route: the link must point at the host the request came in on.
function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (ipLimiter(clientIp(req), 20, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  // A CRM user's heart is never saved or reported as the client's (same rule as the view route).
  if (await getCrmUser().catch(() => null)) return NextResponse.json({ ignored: "staff" });
  const developmentId = String(body?.developmentId ?? "");
  const favorited = !!body?.favorited;
  if (!developmentId) return NextResponse.json({ error: "developmentId required" }, { status: 400 });

  const presentation = await prisma.clientPresentation.findUnique({
    where: { token: params.token },
    select: { id: true, leadId: true, status: true, expiresAt: true, greetingName: true },
  });
  if (!presentation || presentation.status !== "active" || (presentation.expiresAt && presentation.expiresAt < new Date())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Never trust the client-supplied developmentId blindly — it must actually
  // belong to THIS presentation (never let one token touch another's items).
  const item = await prisma.clientPresentationItem.findUnique({
    where: { presentationId_developmentId: { presentationId: presentation.id, developmentId } },
    select: { id: true, development: { select: { publicName: true, override: { select: { alias: true } } } } },
  });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.clientPresentationItem.update({
    where: { id: item.id },
    data: { isFavorited: favorited, favoritedAt: favorited ? new Date() : null },
  });

  // Only the ON transition is newsworthy — un-favoriting is a quiet correction,
  // not an engagement signal worth pinging about.
  if (favorited) {
    const publicName = item.development.override?.alias || item.development.publicName;
    await prisma.leadActivity.create({
      data: { leadId: presentation.leadId, type: "PRESENTATION_FAVORITE", content: `Favorited: ${publicName}` },
    }).catch(() => {});
    await prisma.leadInteraction.create({
      data: {
        leadId: presentation.leadId,
        type: "PRESENTATION_EVENT",
        channel: "SYSTEM",
        body: `Favorited: ${publicName}`,
        metadata: { legacyType: "PRESENTATION_FAVORITE" },
      },
    }).catch(() => {});
    try {
      await sendTelegramMessage(`❤️ ${escapeHtml(presentation.greetingName)} favorited ${escapeHtml(publicName)} — <a href="${requestOrigin(req)}/crm/leads/${presentation.leadId}">CRM</a>`);
    } catch (e) { console.error("Favorite Telegram alert failed:", e); }
  }

  return NextResponse.json({ ok: true });
}
