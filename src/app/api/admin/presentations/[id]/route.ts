import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

// "I've updated your selection, take a look" — deliberately distinct from the
// create-flow's WHATSAPP_MSG (which introduces a brand-new link) since this is
// a nudge back to an EXISTING, already-shared link.
const WHATSAPP_UPDATED_MSG: Record<string, (url: string) => string> = {
  en: (url) => `I've updated your selection - take a look, there's something new: ${url}`,
  de: (url) => `Ich habe Ihre Auswahl aktualisiert - werfen Sie einen Blick darauf, es gibt etwas Neues: ${url}`,
  pl: (url) => `Zaktualizowałem Państwa wybór - proszę spojrzeć, pojawiło się coś nowego: ${url}`,
  ru: (url) => `Я обновил вашу подборку — взгляните, там появилось кое-что новое: ${url}`,
};

type ItemInput = {
  developmentId: string;
  aliasName?: string | null;
  unitRefs?: string[] | null;
  unitIds?: string[] | null;
  sortIndex?: number;
  advisorComment?: string | null;
  isNew?: boolean; // true only for items freshly added this edit session
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existingPresentation = await prisma.clientPresentation.findUnique({
    where: { id: params.id },
    select: { id: true, leadId: true, token: true, lead: { select: { phone: true } } },
  });
  if (!existingPresentation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items: ItemInput[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "At least one item is required" }, { status: 400 });

  const locale = ["en", "de", "pl", "ru"].includes(body.locale) ? body.locale : "en";
  const greetingName = String(body.greetingName ?? "").trim().slice(0, 120) || "there";
  const personalNote = String(body.personalNote ?? "").trim().slice(0, 2000) || null;
  const advisorId = body.advisorId ? String(body.advisorId) : null;
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
  // Every save re-snapshots the matching panel's current filter state — the
  // edit page's "Add properties" panel can change the effective criteria,
  // and the public page's "your preferences" chips must always reflect it.
  const criteria = body.criteria && typeof body.criteria === "object" ? JSON.parse(JSON.stringify(body.criteria)) : undefined;

  const existingItems = await prisma.clientPresentationItem.findMany({ where: { presentationId: params.id } });
  const existingByDevId = new Map(existingItems.map((e) => [e.developmentId, e]));
  const incomingDevIds = new Set(items.map((it) => it.developmentId));

  const toRemove = existingItems.filter((e) => !incomingDevIds.has(e.developmentId));
  let addedCount = 0;
  let removedCount = toRemove.length;
  let aliasChangedCount = 0;
  let commentChangedCount = 0;

  await prisma.$transaction([
    ...(toRemove.length ? [prisma.clientPresentationItem.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } })] : []),
    ...items.map((it, i) => {
      const ex = existingByDevId.get(it.developmentId);
      const aliasName = (it.aliasName ?? "").trim().slice(0, 120) || null;
      const advisorComment = (it.advisorComment ?? "").trim().slice(0, 300) || null;
      const unitRefs = it.unitRefs && it.unitRefs.length ? it.unitRefs : null;
      const unitIds = it.unitIds && it.unitIds.length ? it.unitIds : null;
      const sortIndex = it.sortIndex ?? i;
      if (ex) {
        if ((ex.aliasName || null) !== aliasName) aliasChangedCount++;
        if ((ex.advisorComment || null) !== advisorComment) commentChangedCount++;
        return prisma.clientPresentationItem.update({
          where: { id: ex.id },
          data: { aliasName, advisorComment, unitRefs: unitRefs ?? undefined, unitIds: unitIds ?? undefined, sortIndex },
        });
      }
      addedCount++;
      return prisma.clientPresentationItem.create({
        data: {
          presentationId: params.id, developmentId: it.developmentId,
          aliasName, advisorComment, unitRefs: unitRefs ?? undefined, unitIds: unitIds ?? undefined, sortIndex,
          isNew: true, newAddedAt: new Date(),
        },
      });
    }),
    prisma.clientPresentation.update({
      where: { id: params.id },
      data: { greetingName, locale, personalNote, advisorId, ...(expiresAt ? { expiresAt } : {}), ...(criteria !== undefined ? { criteria } : {}) },
    }),
  ]);

  const summaryParts: string[] = [];
  if (addedCount) summaryParts.push(`${addedCount} added`);
  if (removedCount) summaryParts.push(`${removedCount} removed`);
  if (aliasChangedCount) summaryParts.push(`${aliasChangedCount} alias changed`);
  if (commentChangedCount) summaryParts.push(`${commentChangedCount} comment changed`);
  const summary = summaryParts.length ? summaryParts.join(", ") : "details updated";

  await prisma.leadActivity.create({
    data: {
      leadId: existingPresentation.leadId, type: "PRESENTATION_EDITED",
      content: `Presentation edited (${summary})`,
      createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null,
    },
  });

  revalidatePath(`/admin/crm/${existingPresentation.leadId}`);

  const url = `${requestOrigin(req)}/c/${existingPresentation.token}`;
  const phone = existingPresentation.lead.phone;
  const whatsappUrl = phone
    ? `https://wa.me/${phone.replace(/[^\d+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent((WHATSAPP_UPDATED_MSG[locale] ?? WHATSAPP_UPDATED_MSG.en)(url))}`
    : null;

  return NextResponse.json({ ok: true, url, whatsappUrl, summary });
}
