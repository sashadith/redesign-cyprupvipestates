import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";

const STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"] as const;

const Input = z.object({
  query: z.string().trim().min(1).max(100).optional().describe("Matches first/last name, email or phone (case-insensitive contains)."),
  status: z.enum(STATUSES).optional(),
  bucket: z.enum(["leads", "partner"]).default("leads"),
  assignedToMe: z.boolean().default(false),
  hasEmail: z.boolean().optional(),
  createdAfter: z.string().datetime().optional().describe("ISO 8601"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export function registerSearchLeads(server: McpServer) {
  server.registerTool(
    "crm_search_leads",
    {
      title: "Search leads",
      description: "Find leads by name/email/phone, status, bucket (leads|partner), assignment or creation date. Paginated compact rows. Newsletter subscribers and deleted leads are never returned.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_search_leads", contextFromAuthInfo(ctx.http?.authInfo), null, async (c) => {
        const where: Prisma.LeadWhereInput = {
          deletedAt: null,
          ...(input.bucket === "partner" ? { source: "PARTNER" } : { ...EXCLUDE_NEWSLETTER, source: { notIn: ["NEWSLETTER", "PARTNER"] } }),
          ...(input.status ? { status: input.status } : {}),
          ...(input.assignedToMe ? { assignedToId: c.userId } : {}),
          ...(input.hasEmail === true ? { email: { not: null } } : input.hasEmail === false ? { email: null } : {}),
          ...(input.createdAfter ? { createdAt: { gte: new Date(input.createdAfter) } } : {}),
          ...(input.query
            ? {
                OR: [
                  { firstName: { contains: input.query, mode: "insensitive" } },
                  { lastName: { contains: input.query, mode: "insensitive" } },
                  { email: { contains: input.query, mode: "insensitive" } },
                  { phone: { contains: input.query.replace(/\s+/g, "") } },
                ],
              }
            : {}),
        };
        const [total, rows] = await Promise.all([
          prisma.lead.count({ where }),
          prisma.lead.findMany({ where, select: LEAD_ROW_SELECT, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
        ]);
        return { page: input.page, pageSize: input.pageSize, total, leads: rows.map(leadRow) };
      }),
  );
}
