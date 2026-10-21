import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function writeAudit(
  actor: { id: string; name: string; email: string },
  action: string, targetType: string, targetId: string, detail?: Record<string, unknown>,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await db.adminAuditLog.create({
    data: { actorId: actor.id, actorName: actor.name, actorEmail: actor.email, action, targetType, targetId, detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined },
  });
}
