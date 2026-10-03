import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";
import { BLOG_LOCALES, groupArticles, localeUrls, metaDescriptionOf, type ArticleRow } from "@/lib/blog/articleUrls";
import { contentBlocksToMarkdown, extractSources } from "@/lib/blog/blocksToMarkdown";
import { runTool, ToolError } from "../toolWrapper";
import { contextFromAuthInfo } from "../context";
import { fmtDate } from "../format";
import { BLOG_ROW_SELECT } from "./blogListArticles";

const Input = z.object({
  slug: z.string().trim().min(1).max(200).describe("The slug in the requested locale (slugs differ per language — take it from blog_list_articles)."),
  locale: z.enum(BLOG_LOCALES).default("en"),
});

export function registerBlogGetArticle(server: McpServer) {
  server.registerTool(
    "blog_get_article",
    {
      title: "Get a blog article",
      description:
        "One published article in the requested locale: title, meta description, the four locale URLs (null where no published translation exists), the full body as clean Markdown (headings, lists, tables, FAQ, images; no HTML), the external links it cites as `sources` (own domain and social profiles excluded, deduplicated), its internal links, word count, author, category and dates.",
      inputSchema: Input,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (input, ctx) =>
      runTool("blog_get_article", contextFromAuthInfo(ctx.http?.authInfo), null, async () => {
        const row = await prisma.blog.findFirst({
          where: { language: input.locale, slug: input.slug, status: "PUBLISHED" },
          select: { ...BLOG_ROW_SELECT, excerpt: true, readingTime: true, contentBlocks: true, author: { select: { name: true } } },
        });
        if (!row) throw new ToolError("not_found", "Article not found.");
        const siblings = row.translationGroupId
          ? ((await prisma.blog.findMany({ where: { translationGroupId: row.translationGroupId, status: "PUBLISHED", language: { in: [...BLOG_LOCALES] } }, select: BLOG_ROW_SELECT })) as ArticleRow[])
          : [row as unknown as ArticleRow];
        const [group] = groupArticles(siblings.length ? siblings : [row as unknown as ArticleRow]);
        const urls = localeUrls(group);
        const body = contentBlocksToMarkdown(row.contentBlocks);
        const { sources, internalLinks } = extractSources(body.links);
        return {
          slug: row.slug,
          locale: row.language,
          title: row.title.trim() || null,
          metaDescription: metaDescriptionOf(row.seo),
          excerpt: row.excerpt,
          category: row.category ? { slug: row.category.slug, title: row.category.title } : null,
          author: row.author?.name ?? null,
          readingTimeMinutes: row.readingTime,
          wordCount: body.wordCount,
          urls,
          publishedAt: fmtDate(row.publishedAt),
          updatedAt: fmtDate(row.updatedAt),
          sources,
          internalLinks,
          body: body.markdown,
        };
      }),
  );
}
