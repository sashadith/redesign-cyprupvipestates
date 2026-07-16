"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// The 4 per-language rows of one real-world legacy project share one
// translationGroupId (confirmed against the actual Luma Genesis rows —
// same field translationsFor() already uses elsewhere to resolve a
// project's language siblings). Confirm/Reject must cascade across the
// whole group, not just the single (English) row the overlaps page shows —
// otherwise DE/PL/RU keep behaving as if nothing was ever reviewed.
async function groupIds(legacyProjectId: string): Promise<string[]> {
  const anchor = await prisma.project.findUnique({ where: { id: legacyProjectId }, select: { translationGroupId: true } });
  if (!anchor?.translationGroupId) return [legacyProjectId];
  const rows = await prisma.project.findMany({ where: { translationGroupId: anchor.translationGroupId }, select: { id: true } });
  return rows.map((r) => r.id);
}

// Confirm a legacy Project <-> Development match from the heuristic candidate
// list (see candidates.ts). Writes the link on every locale row of the
// project group; visibility of the legacy project itself is untouched here —
// that's the separate ACTIVATE/DEACTIVATE toggle (Phase 5.3, also cascaded).
export async function confirmOverlap(legacyProjectId: string, developmentId: string) {
  const ids = await groupIds(legacyProjectId);
  await prisma.project.updateMany({
    where: { id: { in: ids } },
    data: { supersededByDevelopmentId: developmentId },
  });
  revalidatePath("/admin/content/projects/overlaps");
}

// Reject a specific candidate pairing, across every locale row of the group.
// Tracked per-candidate (not a single flag on the project) because one legacy
// project can appear against more than one candidate Development in the
// heuristic list. Each row keeps its own array (Json field, can't updateMany
// a computed append), so this reads and writes each row individually.
export async function rejectOverlap(legacyProjectId: string, developmentId: string) {
  const ids = await groupIds(legacyProjectId);
  const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, overlapRejectedDevelopmentIds: true } });
  await Promise.all(
    rows.map((row) => {
      const existing = Array.isArray(row.overlapRejectedDevelopmentIds) ? (row.overlapRejectedDevelopmentIds as string[]) : [];
      if (existing.includes(developmentId)) return null;
      return prisma.project.update({ where: { id: row.id }, data: { overlapRejectedDevelopmentIds: [...existing, developmentId] } });
    }),
  );
  revalidatePath("/admin/content/projects/overlaps");
}
