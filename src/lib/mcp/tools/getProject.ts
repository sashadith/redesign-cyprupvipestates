import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { computeAvailability, listedUnits } from "@/lib/developmentAvailability";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const Input = z
  .object({
    developmentId: z.string().uuid().optional(),
    slug: z.string().min(1).max(200).optional(),
    query: z.string().min(2).max(100).optional().describe("Name search when neither id nor slug is known; returns up to 10 candidates instead of one project."),
  })
  .refine((v) => [v.developmentId, v.slug, v.query].filter(Boolean).length === 1, { message: "Provide exactly one of developmentId, slug or query." });

const MAX_UNITS = 50;

export function registerGetProject(server: McpServer) {
  server.registerTool(
    "crm_get_project",
    {
      title: "Get project / development",
      description:
        "One development with its real, current figures: price range, availability computed from the unit list (not the cached counters), completion, location, public URL, and up to 50 units (type, beds, area, price, status). The source of truth for any number you put in a message. Pass exactly one of `developmentId`, `slug` or `query`; with `query`, returns candidate projects to pick from.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_get_project", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        if (!input.developmentId && !input.slug) {
          const candidates = await prisma.development.findMany({
            where: { OR: [{ publicName: { contains: input.query!, mode: "insensitive" } }, { developerName: { contains: input.query!, mode: "insensitive" } }] },
            select: { id: true, publicName: true, developer: true, town: true, district: true, publishStatus: true, slug: true },
            take: 10,
            orderBy: { publicName: "asc" },
          });
          return { candidates: candidates.map((d) => ({ developmentId: d.id, name: d.publicName, developer: d.developer, location: [d.district, d.town].filter(Boolean).join(", ") || null, publishStatus: d.publishStatus, slug: d.slug })) };
        }
        const d = await prisma.development.findFirst({
          where: input.developmentId ? { id: input.developmentId } : { slug: input.slug },
          select: {
            id: true, publicName: true, developer: true, category: true, status: true, stage: true, completion: true, district: true, town: true, area: true,
            priceFrom: true, priceTo: true, currency: true, slug: true, publishStatus: true, soldOutSince: true, updatedAt: true,
            units: {
              orderBy: { sortIndex: "asc" },
              select: { id: true, ref: true, label: true, type: true, status: true, price: true, currency: true, beds: true, baths: true, areaBuilt: true, areaPlot: true, floor: true },
            },
          },
        });
        if (!d) throw new ToolError("not_found", "Project not found.");
        const listed = listedUnits(d.units);
        const availability = computeAvailability(listed);
        return {
          developmentId: d.id,
          name: d.publicName,
          developer: d.developer,
          category: d.category,
          status: d.status,
          stage: d.stage,
          completion: d.completion,
          location: { area: d.area, district: d.district, town: d.town },
          priceFrom: d.priceFrom,
          priceTo: d.priceTo,
          currency: d.currency,
          availability: { available: availability.available, total: availability.total, soldOut: availability.soldOut, soldOutSince: fmtDate(d.soldOutSince) },
          publishStatus: d.publishStatus,
          publicUrl: d.slug && d.publishStatus === "published" ? { en: `/en/projects/${d.slug}`, de: `/de/projects/${d.slug}`, pl: `/pl/projects/${d.slug}`, ru: `/ru/projects/${d.slug}` } : null,
          dataUpdatedAt: fmtDate(d.updatedAt),
          units: { total: listed.length, returned: Math.min(listed.length, MAX_UNITS), rows: listed.slice(0, MAX_UNITS) },
        };
      }),
  );
}
