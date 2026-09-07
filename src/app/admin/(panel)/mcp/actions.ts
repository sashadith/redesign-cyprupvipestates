"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revokeFamily } from "@/lib/mcp/auth/tokens";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const uid = (session?.user as any)?.id as string | undefined;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return uid;
}

// A user can only disconnect their own token families.
export async function disconnectMcpFamily(formData: FormData) {
  const uid = await requireUserId();
  const familyId = String(formData.get("familyId") ?? "");
  const owned = await prisma.mcpToken.findFirst({ where: { familyId, userId: uid }, select: { id: true } });
  if (!owned) throw new Error("Not found");
  await revokeFamily(familyId);
  revalidatePath("/admin/mcp");
}
