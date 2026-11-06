"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isToolKey } from "@/lib/toolSwitches";

// On/off for SEO Advisor and Page Power (2026-11-05). Server Actions are
// reachable as a plain POST regardless of the (panel) layout's login check, so
// this checks the session itself: an active user with role ADMIN, the same bar
// as the site settings. Everyone else sees the switch read-only.
async function requireActiveAdmin() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true, role: true, name: true, email: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return { id: uid, name: user.name ?? null, email: user.email ?? null };
}

export async function setToolEnabledAction(key: string, enabled: boolean): Promise<{ error?: string }> {
  if (!isToolKey(key) || typeof enabled !== "boolean") return { error: "Unknown tool." };
  let actor: Awaited<ReturnType<typeof requireActiveAdmin>>;
  try {
    actor = await requireActiveAdmin();
  } catch (e) {
    return { error: e instanceof Error && e.message === "Forbidden" ? "Only admins can switch tools on or off." : "Not signed in." };
  }
  const updatedByName = actor.name ?? actor.email ?? "admin";
  await prisma.$transaction([
    prisma.toolSwitch.upsert({
      where: { key },
      create: { key, enabled, updatedByName },
      update: { enabled, updatedByName },
    }),
    prisma.adminAuditLog.create({
      data: {
        actorId: actor.id, actorName: actor.name, actorEmail: actor.email,
        action: enabled ? "tool_switched_on" : "tool_switched_off",
        targetType: "ToolSwitch", targetId: key,
      },
    }),
  ]);
  revalidatePath("/admin/analytics/seo/advisor");
  revalidatePath("/admin/analytics/seo/power");
  revalidatePath("/admin");
  return {};
}
