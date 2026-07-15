"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { matchDevelopmentsForLead, type MatchFilters, type DevelopmentMatch } from "@/lib/crm/matching";

// Local, self-contained (mirrors src/app/admin/actions.ts's requireSession —
// not imported from there since exporting it from that "use server" file would
// turn an internal auth helper into a publicly-callable action).
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

export async function matchLeadAction(leadId: string, filters: MatchFilters): Promise<DevelopmentMatch[]> {
  await requireSession();
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { budgetMin: true, budgetMax: true, propertyTypeInterest: true },
  });
  if (!lead) return [];
  return matchDevelopmentsForLead(lead, filters);
}

// Silent auto-save of the matching panel's current filters, so reopening this
// lead later shows exactly what was last searched for. No revalidatePath —
// this fires on every filter change while the admin is actively editing, and
// revalidating would refetch server data mid-edit.
export async function saveMatchFiltersAction(leadId: string, filters: MatchFilters) {
  await requireSession();
  await prisma.lead.update({ where: { id: leadId }, data: { lastMatchFilters: JSON.parse(JSON.stringify(filters)) } });
}

export type LocationOptions = { districts: string[]; areasByDistrict: Record<string, string[]> };

// District -> Area cascade for the matching panel's location filter (PART 6).
// A development with no district falls back to its town, so nothing gets
// silently excluded from the District list just because a feed left that
// field empty.
export async function listPresentationLocations(): Promise<LocationOptions> {
  await requireSession();
  const rows = await prisma.development.findMany({
    where: { publishStatus: { in: ["published", "ready"] } },
    select: { town: true, district: true, area: true, override: { select: { town: true, district: true, area: true } } },
  });
  const areasByDistrict: Record<string, Set<string>> = {};
  for (const r of rows) {
    const town = r.override?.town || r.town;
    const district = r.override?.district || r.district || town;
    const area = r.override?.area || r.area;
    if (!district) continue;
    (areasByDistrict[district] ??= new Set()).add(area || "");
  }
  const districts = Object.keys(areasByDistrict).sort();
  const out: Record<string, string[]> = {};
  for (const d of districts) out[d] = Array.from(areasByDistrict[d]).filter(Boolean).sort();
  return { districts, areasByDistrict: out };
}

export async function revokePresentationAction(id: string) {
  const session = await requireSession();
  const p = await prisma.clientPresentation.update({ where: { id }, data: { status: "revoked" }, select: { leadId: true } });
  await prisma.leadActivity.create({
    data: { leadId: p.leadId, type: "PRESENTATION_REVOKED", content: "Presentation revoked", createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath(`/admin/crm/${p.leadId}`);
}

// Hard delete — items/views cascade via the schema's onDelete: Cascade.
// Confirmation happens client-side (see DeletePresentationButton.tsx) before
// this ever gets called; there's no soft-delete/undo here.
export async function deletePresentationAction(id: string) {
  const session = await requireSession();
  const p = await prisma.clientPresentation.delete({ where: { id }, select: { leadId: true } });
  await prisma.leadActivity.create({
    data: { leadId: p.leadId, type: "PRESENTATION_DELETED", content: "Presentation deleted", createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath(`/admin/crm/${p.leadId}`);
}

export async function extendPresentationAction(id: string, days: number) {
  const session = await requireSession();
  const current = await prisma.clientPresentation.findUnique({ where: { id }, select: { leadId: true, expiresAt: true } });
  if (!current) return;
  const base = current.expiresAt && current.expiresAt > new Date() ? current.expiresAt : new Date();
  const expiresAt = new Date(base.getTime() + days * 86_400_000);
  await prisma.clientPresentation.update({ where: { id }, data: { expiresAt, status: "active" } });
  await prisma.leadActivity.create({
    data: { leadId: current.leadId, type: "PRESENTATION_EXTENDED", content: `Presentation extended by ${days} days`, createdBy: session.user?.name ?? "admin", createdById: (session.user as any)?.id ?? null },
  });
  revalidatePath(`/admin/crm/${current.leadId}`);
}
