// Lead CSV export (audit H3). Auth-gated; honours the same filters as the list page.
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildLeadWhere, orderForSort, type LeadSearchParams } from "../filters";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const raw = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  // CSV formula-injection guard: lead fields are attacker-controlled (public forms), so a value
  // beginning with = + - @ TAB or CR would execute as a formula when the CSV is opened in
  // Excel/Sheets. Neutralise by prefixing a single quote, then apply normal CSV quoting.
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) return new Response("Unauthorized", { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!u?.isActive) return new Response("Unauthorized", { status: 401 });

  const sp: LeadSearchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
  const leads = await prisma.lead.findMany({
    where: buildLeadWhere(sp),
    orderBy: orderForSort(sp),
    take: 50000,
    include: { assignedTo: { select: { name: true } } },
  });

  const cols = ["id", "createdAt", "status", "source", "firstName", "lastName", "email", "phone", "nationality", "language", "budgetMin", "budgetMax", "timeline", "financing", "propertyTypeInterest", "message", "notes", "assignedTo", "pageSource", "utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "gclid", "fbclid", "referrer"];
  const rows = leads.map((l) => [
    l.id, l.createdAt.toISOString(), l.status, l.source, l.firstName, l.lastName, l.email, l.phone,
    l.nationality, l.languagePreference, l.budgetMin, l.budgetMax, l.timeline, l.financing,
    l.propertyTypeInterest, l.message, l.notes, l.assignedTo?.name, l.pageSource,
    l.utmSource, l.utmMedium, l.utmCampaign, l.utmTerm, l.utmContent, l.gclid, l.fbclid, l.referrer,
  ].map(csvCell).join(","));
  // Leading BOM so Excel reads UTF-8 correctly.
  const csv = "﻿" + [cols.join(","), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cve-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
