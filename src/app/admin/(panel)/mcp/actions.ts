"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revokeFamily } from "@/lib/mcp/auth/tokens";
import { createPairingToken, pairingSecret, PAIRING_COOKIE, PAIRING_COOKIE_PATH, PAIRING_TTL_MS } from "@/lib/mcp/auth/pairing";

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

// Opens the 10-minute pairing window in THIS browser (see src/lib/mcp/auth/pairing.ts).
export async function openPairingWindow() {
  const uid = await requireUserId();
  cookies().set({
    name: PAIRING_COOKIE,
    value: createPairingToken(uid, pairingSecret()),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: PAIRING_COOKIE_PATH,
    maxAge: Math.floor(PAIRING_TTL_MS / 1000),
  });
  revalidatePath("/admin/mcp");
}
