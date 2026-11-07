import { resolveRelativeCompletion } from "@/lib/completionDate";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { computeAvailability, listedUnits } from "@/lib/developmentAvailability";
import { publicUrlFor } from "@/lib/crm/inventorySearch";
import { heroImageUrl, absoluteUrls } from "@/lib/developmentHero";
import { pageBenefits, pageGalleryUrls } from "@/lib/developmentPageFacts";
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
        "One development with its real, current figures: price range, availability computed from the unit list (not the cached counters), completion, location, public URL (relative and absolute), the hero image URL the public page uses (for social posts), and up to 50 units (type, beds, area, price, status). For published projects also `gallery` (the page's images in page order, absolute URLs of our largest hosted version, max 40 — the images render_instagram_carousel accepts), `amenities` (the page's features list) and `vatNote` (\"plus\" | \"included\" | null — the carousel price note, set per project in the admin). The source of truth for any number you put in a message. Pass exactly one of `developmentId`, `slug` or `query`; with `query`, returns candidate projects to pick from.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("crm_get_project", contextFromAuthInfo(ctx.http?.authInfo), null, () => getProjectData(input)),
  );
}

/** The tool's result, callable without an MCP session (testbed checks). */
export async function getProjectData(input: z.infer<typeof Input>) {
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
      // Gallery, amenities and vatNote leave only for a published project (see below).
      gallery: true, amenities: true, override: { select: { mainImage: true, gallery: true, amenities: true, vatNote: true, completion: true } },
      units: {
        orderBy: { sortIndex: "asc" },
        select: { id: true, ref: true, label: true, type: true, status: true, price: true, currency: true, beds: true, baths: true, areaBuilt: true, areaPlot: true, floor: true, amenities: true },
      },
    },
  });
  if (!d) throw new ToolError("not_found", "Project not found.");
  const published = d.publishStatus === "published";
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  // The unit features only feed `amenities` (as on the page) — they are not part of the unit rows.
  const listed = listedUnits(d.units.map(({ amenities: _features, ...u }) => u));
  const availability = computeAvailability(listed);
  return {
    developmentId: d.id,
    name: d.publicName,
    developer: d.developer,
    category: d.category,
    status: d.status,
    stage: d.stage,
    // Override wins, as on the page; "N months from signing" counted from today into a quarter.
    completion: resolveRelativeCompletion(d.override?.completion || d.completion) || null,
    location: { area: d.area, district: d.district, town: d.town },
    priceFrom: d.priceFrom,
    priceTo: d.priceTo,
    currency: d.currency,
    availability: { available: availability.available, total: availability.total, soldOut: availability.soldOut, soldOutSince: fmtDate(d.soldOutSince) },
    publishStatus: d.publishStatus,
    publicUrl: publicUrlFor(d.slug, d.publishStatus),
    publicUrlAbsolute: absoluteUrls(publicUrlFor(d.slug, d.publishStatus)),
    // The page's own hero / og:image at its largest hosted tier; null unless published.
    heroImageUrl: heroImageUrl(d),
    // What the public page shows (src/lib/developmentPageFacts.ts); null unless published.
    gallery: published ? pageGalleryUrls(d) : null,
    amenities: published ? pageBenefits(Array.from(new Set([...arr(d.override?.amenities), ...arr(d.amenities)])), d.units.map((u) => arr(u.amenities))) : null,
    vatNote: published ? ((d.override?.vatNote as "plus" | "included" | null | undefined) ?? null) : null,
    dataUpdatedAt: fmtDate(d.updatedAt),
    units: { total: listed.length, returned: Math.min(listed.length, MAX_UNITS), rows: listed.slice(0, MAX_UNITS) },
  };
}
