import { prisma } from "@/lib/prisma";
import { randomToken } from "./crypto";

export async function registerClient(input: { clientName: string | null; redirectUris: string[] }): Promise<{ clientId: string }> {
  const clientId = randomToken(24);
  await prisma.mcpOAuthClient.create({ data: { clientId, clientName: input.clientName, redirectUris: input.redirectUris } });
  return { clientId };
}

export async function getClient(clientId: string) {
  return prisma.mcpOAuthClient.findUnique({ where: { clientId }, select: { clientId: true, clientName: true, redirectUris: true, createdAt: true } });
}
