"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localizedHref } from "@/lib/locale";

// Mirrors revalidateProjectPublic in ../../../actions.ts (not exported from
// there) — revert can flip status/redirects, which are public-facing.
function revalidateProjectPublic(language: string, slug: string) {
  const internal = `/${language}/projects/${slug}`;
  revalidatePath(internal);
  const clean = localizedHref(language, ["projects", slug]);
  if (clean !== internal) revalidatePath(clean);
  const listInternal = `/${language}/projects`;
  revalidatePath(listInternal);
  const listClean = localizedHref(language, ["projects"]);
  if (listClean !== listInternal) revalidatePath(listClean);
}

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

// Undo a previously-confirmed match — e.g. a mistaken pairing like "Azalea
// Apartments" (Limassol) confirmed against "Azalea Villas" (Paphos), two
// unrelated buildings. Clears supersededByDevelopmentId across the whole
// locale group (the same cascade confirm/reject already use), then either
// returns the pair to Pending or records it as Rejected so the heuristic
// list doesn't keep re-surfacing a known-bad match.
//
// Guard: a legacy project only reaches ARCHIVED via deactivateProjectWithRedirect
// (../../../actions.ts), which is only reachable through a confirmed link —
// so an ARCHIVED row here was deactivated *because of* this match. Reverting
// the match without also reactivating would leave a 301 pointing at a
// Development the admin just said is the WRONG building — silently broken
// for visitors. `reactivate: true` clears status back to PUBLISHED and
// deletes any redirect on every row in the group; the caller (the revert
// dialog) decides whether to offer this, based on whether any row is
// currently ARCHIVED.
export async function revertOverlap(
  legacyProjectId: string,
  developmentId: string,
  disposition: "pending" | "rejected",
  reactivate: boolean,
) {
  const ids = await groupIds(legacyProjectId);
  const rows = await prisma.project.findMany({
    where: { id: { in: ids } },
    select: { id: true, language: true, slug: true, status: true, supersededByDevelopmentId: true, overlapRejectedDevelopmentIds: true },
  });

  await prisma.$transaction(
    rows.flatMap((row) => {
      // Only touch rows actually linked to this development — a row that
      // somehow drifted (or was never linked) is left alone rather than
      // blindly nulled out.
      if (row.supersededByDevelopmentId !== developmentId) return [];
      const data: Record<string, unknown> = { supersededByDevelopmentId: null };
      if (disposition === "rejected") {
        const existing = Array.isArray(row.overlapRejectedDevelopmentIds) ? (row.overlapRejectedDevelopmentIds as string[]) : [];
        if (!existing.includes(developmentId)) data.overlapRejectedDevelopmentIds = [...existing, developmentId];
      }
      if (reactivate && row.status === "ARCHIVED") data.status = "PUBLISHED";
      const ops: Prisma.PrismaPromise<unknown>[] = [prisma.project.update({ where: { id: row.id }, data })];
      if (reactivate) ops.push(prisma.legacyProjectRedirect.deleteMany({ where: { projectId: row.id } }));
      return ops;
    }),
  );

  for (const row of rows) {
    if (row.supersededByDevelopmentId !== developmentId) continue;
    revalidatePath(`/admin/content/projects/${row.id}`);
    if (reactivate) revalidateProjectPublic(row.language, row.slug);
  }
  revalidatePath("/admin/content/projects");
  revalidatePath("/admin/content/projects/overlaps");
}
