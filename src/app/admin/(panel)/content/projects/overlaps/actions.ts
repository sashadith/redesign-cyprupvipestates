"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Confirm a legacy Project <-> Development match from the heuristic candidate
// list (see candidates.ts). Writes the link; visibility of the legacy project
// itself is untouched here — that's the separate ACTIVATE/DEACTIVATE toggle
// (Phase 5.3).
export async function confirmOverlap(legacyProjectId: string, developmentId: string) {
  await prisma.project.update({
    where: { id: legacyProjectId },
    data: { supersededByDevelopmentId: developmentId },
  });
  revalidatePath("/admin/content/projects/overlaps");
}

// Reject a specific candidate pairing. Tracked per-candidate (not a single
// flag on the project) because one legacy project can appear against more
// than one candidate Development in the heuristic list.
export async function rejectOverlap(legacyProjectId: string, developmentId: string) {
  const project = await prisma.project.findUnique({
    where: { id: legacyProjectId },
    select: { overlapRejectedDevelopmentIds: true },
  });
  const existing = Array.isArray(project?.overlapRejectedDevelopmentIds)
    ? (project!.overlapRejectedDevelopmentIds as string[])
    : [];
  if (!existing.includes(developmentId)) {
    await prisma.project.update({
      where: { id: legacyProjectId },
      data: { overlapRejectedDevelopmentIds: [...existing, developmentId] },
    });
  }
  revalidatePath("/admin/content/projects/overlaps");
}
