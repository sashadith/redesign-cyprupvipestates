import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { matchDevelopmentsForLead, type MatchFilters } from "@/lib/crm/matching";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";

const Input = z.object({
  leadId: z.string().uuid(),
  filters: z
    .object({
      budgetMin: z.number().int().nonnegative().nullable().optional(),
      budgetMax: z.number().int().nonnegative().nullable().optional(),
      bedrooms: z.array(z.number().int().min(0).max(5)).optional().describe("5 means 5+"),
      districts: z.array(z.string()).optional(),
      areas: z.array(z.string()).optional(),
      propertyTypes: z.array(z.string()).optional().describe("Apartment | Villa | Townhouse | Penthouse"),
      onlyAvailable: z.boolean().optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

export function registerMatchProperties(server: McpServer) {
  server.registerTool(
    "crm_match_properties",
    {
      title: "Match properties for a lead",
      description:
        "Runs the CRM's property matching for a lead (budget, bedrooms, location, property type) — the same engine as the admin Property Matching panel. Defaults to the lead's own budget/type interest plus the filters last used in the admin; pass filters to override. Returns scored developments with up to 3 exactly-matching units each. Quote figures from here, never from memory.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ leadId, filters, limit }, ctx) =>
      runTool("crm_match_properties", contextFromAuthInfo(ctx.http?.authInfo), leadId, async () => {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
          select: { budgetMin: true, budgetMax: true, propertyTypeInterest: true, lastMatchFilters: true },
        });
        if (!lead) throw new ToolError("not_found", "Lead not found.");
        // Same loose treatment of the stored JSON as generate.ts:214 — the admin panel wrote it in MatchFilters shape.
        const effectiveFilters = { ...((lead.lastMatchFilters as MatchFilters | null) ?? {}), ...(filters ?? {}) } as MatchFilters;
        const matches = await matchDevelopmentsForLead(
          { budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, propertyTypeInterest: lead.propertyTypeInterest },
          effectiveFilters,
        );
        return {
          filtersUsed: effectiveFilters,
          matches: matches.slice(0, limit).map((m) => ({
            developmentId: m.development.id,
            name: m.development.publicName,
            developer: m.development.developer,
            location: [m.development.area, m.development.district, m.development.town].filter(Boolean).join(", ") || null,
            priceFrom: m.development.priceFrom,
            priceTo: m.development.priceTo,
            currency: m.development.currency,
            completion: m.development.completion,
            unitsMatching: m.development.unitsAvailable,
            unitsAvailableAll: m.development.unitsAvailableAll,
            unitsTotal: m.development.unitsTotal,
            score: m.score,
            scoreBreakdown: m.scoreBreakdown,
            publicUrl: m.development.slug && m.development.publishStatus === "published" ? `/en/projects/${m.development.slug}` : null,
            matchedUnits: m.matchedUnits.slice(0, 3).map((u) => ({ id: u.id, ref: u.ref, label: u.label, type: u.type, beds: u.beds, areaBuilt: u.areaBuilt, price: u.price })),
          })),
        };
      }),
  );
}
