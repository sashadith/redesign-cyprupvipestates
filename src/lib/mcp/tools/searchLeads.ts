import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { LEAD_ROW_SELECT, leadRow } from "../leadRow";

// Stored Lead.phone values keep whatever punctuation the lead typed in
// ("+49 151 234"); reduce to digits-only so we can compare against a
// digits-only query regardless of formatting on either side.
export const digitsOf = (s: string) => s.replace(/\D/g, "");

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
        // Stored phone numbers are unnormalised ("+49 151 234"); a plain
        // `contains` on the input digits misses them. Normalise the column
        // side with a raw query instead, gated on a minimum digit count so
        // short/no-digit queries (e.g. a name) don't trigger it.
        let phoneIds: string[] = [];
        if (input.query && digitsOf(input.query).length >= 5) {
          const digits = digitsOf(input.query);
          const phoneMatches = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM leads WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`;
          phoneIds = phoneMatches.map((r) => r.id);
        }
        const where: Prisma.LeadWhereInput = {
          deletedAt: null,
          ...(input.bucket === "partner" ? { source: "PARTNER" } : { source: { notIn: ["NEWSLETTER", "PARTNER"] } }),
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
                  { phone: { contains: input.query.trim() } },
                  ...(phoneIds.length ? [{ id: { in: phoneIds } }] : []),
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
