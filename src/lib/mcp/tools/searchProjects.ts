import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { searchDevelopments, parseCompletionBefore, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "@/lib/crm/inventorySearch";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const Input = z.object({
  query: z.string().min(2).max(100).optional().describe("Contains-match on project name, developer, town or area."),
  districts: z.array(z.string().min(1).max(60)).max(10).optional(),
  areas: z.array(z.string().min(1).max(60)).max(10).optional().describe("Only meaningful together with districts."),
  propertyTypes: z.array(z.string().min(1).max(40)).max(6).optional().describe("Apartment | Villa | Townhouse | Penthouse (any spelling)."),
  bedrooms: z.array(z.number().int().min(0).max(5)).max(6).optional().describe("0 = studio, 5 = 5+."),
  budgetMin: z.number().int().nonnegative().nullable().optional(),
  budgetMax: z.number().int().nonnegative().nullable().optional(),
  onlyAvailable: z.boolean().default(true),
  completionBefore: z.string().max(7).optional().describe('"2027" (through end of 2027) or "2027-06" (through June 2027).'),
  stage: z.string().min(2).max(40).optional(),
  amenity: z.string().min(2).max(40).optional().describe('e.g. "sea view", "pool" — matched against project and unit amenities.'),
  developer: z.string().min(2).max(60).optional(),
  includeReady: z.boolean().default(false).describe("Also return internal 'ready' (unpublished) projects — never quote those to a customer."),
  sort: z.enum(["price_asc", "price_desc", "availability_desc", "updated_desc", "name"]).default("price_asc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export function registerSearchProjects(server: McpServer) {
  server.registerTool(
    "crm_search_projects",
    {
      title: "Search the project catalogue",
      description:
        "Browse the published project catalogue without a lead — filters for location, type, bedrooms, budget (applied to unit prices), completion, amenities and developer. Rows carry computed availability, the units that match your filters (count, price span, types), a summary by district/developer over the whole result set, and a `publicUrl` only when the project is published; never quote a row without `publicUrl` to a customer. For lead-specific ranking use `crm_match_properties`; for the full unit table of one project use `crm_get_project`.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_search_projects", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        if (parseCompletionBefore(input.completionBefore) === "invalid") {
          throw new ToolError("validation", 'completionBefore must be "YYYY" or "YYYY-MM".');
        }
        if (input.areas?.length && !input.districts?.length) {
          throw new ToolError("validation", "areas only narrows a district — pass districts as well.");
        }
        const r = await searchDevelopments(input);
        return {
          total: r.total,
          page: r.page,
          pageSize: r.pageSize,
          summary: r.summary,
          rows: r.rows.map((row) => ({ ...row, lastSyncedAt: fmtDate(row.lastSyncedAt) })),
        };
      }),
  );
}
