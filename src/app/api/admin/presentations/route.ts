import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { cleanPresentationInput, createPresentation } from "@/lib/crm/presentations/core";

// Deliberately NOT src/lib/seo.ts's SITE_URL — that constant is hardcoded to
// the production domain, which would make every presentation generated on
// staging (design.cyprusvipestates.com, where this admin panel currently
// lives) produce a link pointing at production instead — a real bug hit in
// practice. Build the origin from the actual incoming request instead, so the
// link is always correct for whichever domain the admin is using.
function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

// Session-gated (ADMIN + EDITOR both allowed, matches every other CRM action).
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const leadId = String(body.leadId ?? "");
  const itemCount = Array.isArray(body.items) ? body.items.length : 0;
  if (!leadId || itemCount === 0) return NextResponse.json({ error: "leadId and at least one item are required" }, { status: 400 });

  const uid = (session.user as any)?.id ?? null;
  const cleaned = cleanPresentationInput(body, { defaultAdvisorId: uid });
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const actor = { id: uid, name: session.user?.name ?? "admin" };
  const result = await createPresentation(actor, leadId, cleaned.input, requestOrigin(req));
  if ("error" in result) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ ok: true, ...result });
}
