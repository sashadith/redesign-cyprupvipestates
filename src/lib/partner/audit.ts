/** Audit rows for actions a partner takes in the portal (actorId stays null: the actor is not staff). */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { partnerDisplayName } from "./bankFlow";

export async function writePartnerAudit(
  partner: { id: string; company: string | null; firstName: string; lastName: string },
  user: { email: string },
  action: string,
  detail?: Record<string, unknown>,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: null,
      actorName: `Partner: ${partnerDisplayName(partner)}`,
      actorEmail: user.email,
      action,
      targetType: "partner",
      targetId: partner.id,
      detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
