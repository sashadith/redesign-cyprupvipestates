import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CrmUser } from "./access";

// The signed-in staff member as the new CRM sees them (2026-10-18). Same
// session as /admin; rights come from the DB on every call, never from the JWT.
export type SessionCrmUser = CrmUser & { name: string; email: string };

export async function getCrmUser(): Promise<SessionCrmUser | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isOwner: true, isActive: true, canSeeColleagues: true, canEditColleagues: true },
  });
  if (!u || !u.isActive) return null;
  return { ...u, role: u.role as CrmUser["role"] };
}

export async function requireCrmUser(): Promise<SessionCrmUser> {
  const u = await getCrmUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}
