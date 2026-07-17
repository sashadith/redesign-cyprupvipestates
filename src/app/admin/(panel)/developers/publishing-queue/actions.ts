"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { localizedHref } from "@/lib/locale";
import { deactivateProjectWithRedirect } from "../../../actions";

async function requireAdmin() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true, role: true, name: true, email: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  if (user.role !== "ADMIN") throw new Error("Forbidden — ADMIN role required");
  return { id: uid, name: user.name, email: user.email };
}

// One-time batch action: archive every confirmed-and-still-published legacy
// project group (the overlap-review "Confirmed" rows), each with a redirect
// to its linked Development — same effect as running the individual
// deactivate dialog once per group, just without the 25 separate clicks.
// Idempotent: a group already ARCHIVED (most of the 25, as of 2026-07-17 —
// only "Premier Residences" was still live) is skipped, not re-processed, so
// this is safe to run again if new pairs get confirmed later.
export async function batchDeactivateConfirmedOverlaps() {
  const actor = await requireAdmin();

  const confirmed = await prisma.project.findMany({
    where: { language: "en", supersededByDevelopmentId: { not: null } },
    select: { id: true, slug: true, title: true, status: true, supersededByDevelopmentId: true },
  });

  const results: { slug: string; title: string; action: "deactivated" | "skipped_already_archived" | "skipped_no_dev_slug" }[] = [];

  for (const row of confirmed) {
    if (row.status === "ARCHIVED") {
      results.push({ slug: row.slug, title: row.title, action: "skipped_already_archived" });
      continue;
    }
    const dev = await prisma.development.findUnique({ where: { id: row.supersededByDevelopmentId! }, select: { slug: true } });
    if (!dev?.slug) {
      results.push({ slug: row.slug, title: row.title, action: "skipped_no_dev_slug" });
      continue;
    }
    const target = localizedHref("en", ["projects", dev.slug]);
    await deactivateProjectWithRedirect(row.id, target);
    results.push({ slug: row.slug, title: row.title, action: "deactivated" });

    await prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        action: "batch_deactivate_confirmed_overlap",
        targetType: "Project",
        targetId: row.id,
        detail: { slug: row.slug, title: row.title, developmentSlug: dev.slug },
      },
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "batch_deactivate_confirmed_overlap_summary",
      targetType: "Project",
      targetId: "batch",
      detail: { count: confirmed.length, results },
    },
  });

  revalidatePath("/admin/developers/publishing-queue");
  revalidatePath("/admin/content/projects");
  revalidatePath("/admin/content/projects/overlaps");
  return results;
}
