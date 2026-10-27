import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The OpenWA daily cap protects the company number, so it counts everything
// that leaves through it: messages sent by the MCP tool and developer
// registrations (2026-10-28). A registration row records the numbers it
// reached in metadata.to and counts once per number (at least once).
export function whatsAppSentTodayWhere(since: Date): Prisma.LeadInteractionWhereInput {
  return {
    occurredAt: { gte: since },
    OR: [
      { type: "WHATSAPP_OUT", metadata: { path: ["via"], equals: "mcp-whatsapp" } },
      {
        type: "SYSTEM",
        AND: [
          { metadata: { path: ["kind"], equals: "developer_registration" } },
          { metadata: { path: ["channel"], equals: "whatsapp" } },
        ],
      },
    ],
  };
}

type Row = { type: string; metadata: unknown };

export function sumWhatsAppSends(rows: Row[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.type !== "SYSTEM") { n += 1; continue; }
    const to = r.metadata && typeof r.metadata === "object" ? (r.metadata as { to?: unknown }).to : undefined;
    n += Array.isArray(to) && to.length > 0 ? to.length : 1;
  }
  return n;
}

export async function countWhatsAppSentToday(since: Date): Promise<number> {
  const rows = await prisma.leadInteraction.findMany({ where: whatsAppSentTodayWhere(since), select: { type: true, metadata: true } });
  return sumWhatsAppSends(rows);
}
