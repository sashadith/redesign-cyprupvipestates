import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { socialTraffic, MAX_RANGE_DAYS } from "@/lib/blog/socialTraffic";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const DAY = 86_400_000;

const Input = z.object({
  from: z.string().datetime({ offset: true }).describe("ISO 8601 start (inclusive)."),
  to: z.string().datetime({ offset: true }).describe("ISO 8601 end (inclusive)."),
  slug: z.string().trim().min(1).max(200).optional().describe("Any locale's slug of one article; omitted = every article with at least one social or UTM-tagged visit in the range."),
});

export function registerBlogSocialTraffic(server: McpServer) {
  server.registerTool(
    "blog_social_traffic",
    {
      title: "Blog traffic from social networks and UTM campaigns",
      description:
        `Per article: visits and unique visitors in a date range (max ${MAX_RANGE_DAYS} days), bot/prefetch/test rows excluded exactly as in the admin Analytics page. Untagged views are grouped by referrer network — linkedin, x, threads, bluesky, substack (each with its Android app) — with a per-locale breakdown. Views that carried utm_source/utm_medium/utm_campaign (stored per page view since 2026-10-14) count only under utm.bySource and utm.byCampaign, never also by referrer. Also leadsWithFirstTouchUtm — LEADS (not visits) whose first-touch utm_source named one of the networks and who landed on the article. Zero is a valid answer. Quote figures as returned.`,
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("blog_social_traffic", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const from = new Date(input.from);
        const to = new Date(input.to);
        if (to < from) throw new ToolError("validation", "`to` must not be before `from`.");
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY) throw new ToolError("validation", `The range may span at most ${MAX_RANGE_DAYS} days.`);
        const r = await socialTraffic({ from, to, slug: input.slug });
        if (input.slug && r.articles.length === 0) throw new ToolError("not_found", "Article not found.");
        return { range: { from: fmtDate(from), to: fmtDate(to) }, articles: r.articles, totals: r.totals, notes: r.notes };
      }),
  );
}
