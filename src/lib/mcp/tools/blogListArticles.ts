import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { BLOG_LOCALES, groupArticles, listEntry, type ArticleRow } from "@/lib/blog/articleUrls";
import { runTool } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";

const Input = z.object({
  locale: z.enum(BLOG_LOCALES).optional().describe("Only articles that have a published translation in this locale."),
  category: z.string().trim().min(1).max(100).optional().describe("Category slug (any locale's slug of the category)."),
  limit: z.number().int().min(1).max(200).default(100),
  page: z.number().int().min(1).default(1),
});

export const BLOG_ROW_SELECT = {
  id: true, language: true, slug: true, title: true, status: true, seo: true, publishedAt: true, updatedAt: true, translationGroupId: true,
  category: { select: { slug: true, title: true } },
} as const;

export function registerBlogListArticles(server: McpServer) {
  server.registerTool(
    "blog_list_articles",
    {
      title: "List blog articles",
      description:
        "Every published blog article (one entry per article across its translations) with, per locale en/de/pl/ru, the title, meta description and the exact public URL the live site serves (English has no prefix; URLs come from the same helper the language switcher uses). A locale without a published translation is the string \"missing\". Newest first. For the body use blog_get_article.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("blog_list_articles", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const rows = (await prisma.blog.findMany({ where: { status: "PUBLISHED", language: { in: [...BLOG_LOCALES] } }, select: BLOG_ROW_SELECT })) as ArticleRow[];
        const groups = groupArticles(rows);
        const wanted = input.category?.toLowerCase();
        let entries = groups
          .filter((g) => !input.locale || g.rows.some((r) => r.language === input.locale))
          .filter((g) => !wanted || g.rows.some((r) => r.category?.slug.toLowerCase() === wanted))
          .map(listEntry)
          .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || a.slug.localeCompare(b.slug));
        const total = entries.length;
        const byLocale = {} as Record<(typeof BLOG_LOCALES)[number], number>;
        for (const l of BLOG_LOCALES) byLocale[l] = entries.filter((e) => e.locales[l] !== "missing").length;
        entries = entries.slice((input.page - 1) * input.limit, input.page * input.limit);
        return {
          total,
          publishedByLocale: byLocale,
          page: input.page,
          limit: input.limit,
          articles: entries.map((e) => ({
            slug: e.slug,
            category: e.category,
            publishedAt: fmtDate(e.publishedAt),
            updatedAt: fmtDate(e.updatedAt),
            locales: Object.fromEntries(
              BLOG_LOCALES.map((l) => {
                const v = e.locales[l];
                return [l, v === "missing" ? "missing" : { ...v, publishedAt: fmtDate(v.publishedAt), updatedAt: fmtDate(v.updatedAt) }];
              }),
            ),
          })),
        };
      }),
  );
}
