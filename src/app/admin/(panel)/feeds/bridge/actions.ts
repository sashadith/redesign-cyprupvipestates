"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setBridgeEnabled } from "@/lib/bridge/config";

// Same shape as `requireSession` in src/app/admin/actions.ts, and for the same
// reason: `auth()` only reads the JWT, so a user deactivated five minutes ago
// would keep acting for the rest of their token's lifetime unless the session is
// re-checked against the DB (audit M3). That re-check is the point of this
// helper, not decoration.
//
// Deliberately NOT called `requireAdmin`: that name is taken in
// src/app/admin/actions.ts by a stricter helper which also demands
// role === "ADMIN". This screen lives next to Analytics/Feeds, which is not
// role-gated, and borrowing the name would tell the next reader a role gate
// exists here when it does not.
async function requireActiveUser() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

// Flip one developer's delivery switch. `setBridgeEnabled` stamps
// `bridgeChangedAt` on every call, including a no-op re-enable — the incremental
// sync query reads that stamp to learn that a developer's projects became (or
// stopped being) deliverable, because the flip itself writes nothing to the
// Development rows. Short-circuiting an unchanged value here would silently
// break that signal, so this action never tries to be clever about it.
export async function toggleBridgeDeveloper(slug: string, enabled: boolean): Promise<void> {
  await requireActiveUser();
  await setBridgeEnabled(slug, enabled);
  revalidatePath("/admin/feeds/bridge");
}
