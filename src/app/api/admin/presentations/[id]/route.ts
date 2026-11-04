import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { cleanPresentationInput, presentationLeadId, savePresentationEdit } from "@/lib/crm/presentations/core";

// Same reasoning as the create-flow route (src/app/api/admin/presentations/route.ts):
// build the origin from the actual request, not a hardcoded production URL.
function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) return null;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // 404 before validation, as before.
  if (!(await presentationLeadId(params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleaned = cleanPresentationInput(body, { defaultAdvisorId: null });
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const actor = { id: (session.user as any)?.id ?? null, name: session.user?.name ?? "admin" };
  const result = await savePresentationEdit(actor, params.id, cleaned.input, requestOrigin(req));
  if ("error" in result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, url: result.url, whatsappUrl: result.whatsappUrl, summary: result.summary });
}
