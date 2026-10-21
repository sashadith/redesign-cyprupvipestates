import { PrismaClient } from "@prisma/client";
import { normalizeCreateRow, normalizeUpdateRow, dominantType } from "./unitType";

// Singleton Prisma client (avoids exhausting connections during dev HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // One unit-type vocabulary for every writer (2026-10-20, see ./unitType.ts).
  // Every sync and admin screen writes units through this client, so this is
  // the one place a feed's "Villas" / "apartment" / "" / "B" is turned into the
  // canonical word — and where an unusable value is kept from overwriting a
  // type that is already right. Raw SQL bypasses it (one-off scripts only).
  client.$use(async (params, next) => {
    if (params.model !== "DevelopmentUnit") return next(params);
    const a = params.args ?? {};
    const fallbackFor = async (developmentId: string) => {
      const rows = await client.developmentUnit.findMany({ where: { developmentId, type: { not: null } }, select: { type: true } });
      return dominantType(rows.map((r) => r.type));
    };
    if (params.action === "create" && a.data) await normalizeCreateRow(a.data, fallbackFor);
    else if (params.action === "createMany" && a.data) {
      const rows = Array.isArray(a.data) ? a.data : [a.data];
      const cache = new Map<string, Promise<string | null>>();
      const cached = (id: string) => { if (!cache.has(id)) cache.set(id, fallbackFor(id)); return cache.get(id)!; };
      for (const row of rows) await normalizeCreateRow(row, cached);
    } else if ((params.action === "update" || params.action === "updateMany") && a.data) normalizeUpdateRow(a.data);
    else if (params.action === "upsert") {
      if (a.create) await normalizeCreateRow(a.create, fallbackFor);
      if (a.update) normalizeUpdateRow(a.update);
    }
    return next(params);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
