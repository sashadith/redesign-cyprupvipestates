import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { uniquePresentationToken } from "@/lib/crm/presentationToken";

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

const WHATSAPP_MSG: Record<string, (name: string, url: string) => string> = {
  en: (name, url) => `Hello ${name}, I have prepared your personal property selection: ${url}`,
  de: (name, url) => `Hallo ${name}, ich habe Ihre persönliche Immobilienauswahl vorbereitet: ${url}`,
  pl: (name, url) => `Dzień dobry ${name}, przygotowałem Państwa osobisty wybór nieruchomości: ${url}`,
  ru: (name, url) => `Здравствуйте, ${name}. Я подготовил для вас персональную подборку объектов: ${url}`,
};

type ItemInput = { developmentId: string; unitRefs?: string[] | null; unitIds?: string[] | null; sortIndex?: number; advisorComment?: string | null };

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const leadId = String(body.leadId ?? "");
  const items: ItemInput[] = Array.isArray(body.items) ? body.items : [];
  if (!leadId || items.length === 0) return NextResponse.json({ error: "leadId and at least one item are required" }, { status: 400 });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, phone: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const locale = ["en", "de", "pl", "ru"].includes(body.locale) ? body.locale : "en";
  const greetingName = String(body.greetingName ?? "").trim().slice(0, 120) || "there";
  const personalNote = String(body.personalNote ?? "").trim().slice(0, 2000) || null;
  const advisorId = body.advisorId ? String(body.advisorId) : (session.user as any)?.id ?? null;
  const expiresAt = new Date(Date.now() + 30 * 86_400_000);
  // Snapshot of the matching-panel filters at generation time — the "your
  // preferences" chips on the public page render exclusively from `criteria`,
  // never from the lead's own profile fields. filterBedrooms/filterLocations
  // are deprecated (superseded by criteria) but still filled in, derived from
  // the same source, purely for backward-compat with anything still reading them.
  const criteria = body.criteria && typeof body.criteria === "object" ? JSON.parse(JSON.stringify(body.criteria)) : {};
  const filterBedrooms: number[] = Array.isArray(criteria.bedrooms) ? criteria.bedrooms.map(Number).filter((n: number) => Number.isFinite(n)) : [];
  const filterLocations: string[] = (criteria.areas?.length ? criteria.areas : criteria.districts) ?? [];

  const token = await uniquePresentationToken();

  const presentation = await prisma.clientPresentation.create({
    data: {
      leadId, token, locale, greetingName, personalNote, advisorId, expiresAt, filterBedrooms, filterLocations, criteria,
      items: {
        create: items.map((it, i) => ({
          developmentId: it.developmentId,
          unitRefs: it.unitRefs && it.unitRefs.length ? it.unitRefs : undefined,
          // Only ever populated for units with no ref at all (manual units) —
          // see PART 1 / src/lib/unitRef.ts. Never written to for anything else.
          unitIds: it.unitIds && it.unitIds.length ? it.unitIds : undefined,
          sortIndex: it.sortIndex ?? i,
          advisorComment: (it.advisorComment ?? "").trim().slice(0, 300) || null,
        })),
      },
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId, type: "PRESENTATION_CREATED",
      content: `Presentation created (${items.length} propert${items.length === 1 ? "y" : "ies"})`,
      createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null,
    },
  });

  const url = `${requestOrigin(req)}/c/${token}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#081512", light: "#F5F1E8" } });
  const whatsappUrl = lead.phone
    ? `https://wa.me/${lead.phone.replace(/[^\d+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent((WHATSAPP_MSG[locale] ?? WHATSAPP_MSG.en)(greetingName, url))}`
    : null;

  return NextResponse.json({ ok: true, id: presentation.id, token, url, qrSvg, whatsappUrl });
}
