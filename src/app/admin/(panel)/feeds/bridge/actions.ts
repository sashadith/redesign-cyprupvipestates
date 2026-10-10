"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setBridgeEnabled } from "@/lib/bridge/config";

export type BridgeActor = { id: string; name: string | null; email: string | null };

/**
 * ADMIN only, and both the role and the active flag are read from the DATABASE
 * rather than the session.
 *
 * `auth()` only decodes the JWT. The stricter `requireAdmin` in
 * src/app/admin/actions.ts checks `session.user.role`, which is the role as it
 * stood when the token was issued — so an account demoted from ADMIN keeps
 * acting as one until its token expires. That is an acceptable trade for most
 * of the admin; it is not acceptable for the one control that publishes a
 * developer's whole catalogue to a second public domain. The DB read costs one
 * query per click.
 *
 * `isActive` is re-checked for the same reason (audit M3).
 */
async function requireBridgeAdmin(): Promise<BridgeActor> {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { isActive: true, role: true, name: true, email: true },
  });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  if (user.role !== "ADMIN") throw new Error("Forbidden: the Xellex Bridge switch is restricted to administrators.");
  return { id: uid, name: user.name, email: user.email };
}

/** Whether the current viewer may operate the switch — drives the UI, never the guard. */
export async function currentUserMayToggleBridge(): Promise<boolean> {
  try {
    await requireBridgeAdmin();
    return true;
  } catch {
    return false;
  }
}

/**
 * Flip one developer's delivery switch.
 *
 * `setBridgeEnabled` stamps `bridgeChangedAt` on every call, including a no-op
 * re-enable — the incremental sync query reads that stamp to learn that a
 * developer's projects became (or stopped being) deliverable, because the flip
 * itself writes nothing to the Development rows. Short-circuiting an unchanged
 * value here would silently break that signal, so this action never tries to be
 * clever about it.
 *
 * The stamp records WHEN. It cannot record WHO, because it is a column on
 * DeveloperAccount holding one timestamp. The actor goes to AdminAuditLog,
 * which already exists for exactly this and already carries actorId/Name/Email
 * — no new table, no migration. Written AFTER the switch, so a failed flip
 * cannot leave a log line claiming something happened.
 */
export async function toggleBridgeDeveloper(slug: string, enabled: boolean): Promise<void> {
  const actor = await requireBridgeAdmin();
  const acct = await prisma.developerAccount.findUnique({
    where: { slug },
    select: { id: true, name: true, _count: { select: { developments: true } } },
  });
  if (!acct) throw new Error("Unknown developer account.");

  await setBridgeEnabled(slug, enabled);

  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.id, actorName: actor.name, actorEmail: actor.email,
      action: enabled ? "bridge_developer_enabled" : "bridge_developer_disabled",
      targetType: "DeveloperAccount", targetId: acct.id,
      // The name and project count as they stood at the moment of the click:
      // an account renamed or emptied later would otherwise make an old log
      // line describe something that never happened.
      detail: { developerSlug: slug, developerName: acct.name, developments: acct._count.developments, enabled },
    },
  });

  revalidatePath("/admin/feeds/bridge");
}
