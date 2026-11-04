import { prisma } from "@/lib/prisma";
import type { CrmUser } from "./access";

export async function loadCrmUser(userId: string): Promise<CrmUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isOwner: true, isActive: true, canSeeColleagues: true, canEditColleagues: true },
  });
  return u ? { ...u, role: u.role as CrmUser["role"] } : null;
}
