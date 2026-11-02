// Public URL of a Blog row, for code that holds a row but not its category (admin saves, cron jobs).
// The section (blog or guides) follows the article's category, see articleSections.ts.
import { prisma } from "@/lib/prisma";
import { articleHref } from "@/lib/articleSections";

export async function articlePublicHref(row: { language: string; slug: string; categoryId?: string | null }): Promise<string> {
  const group = row.categoryId
    ? (await prisma.category.findUnique({ where: { id: row.categoryId }, select: { translationGroupId: true } }))?.translationGroupId
    : null;
  return articleHref(row.language, row.slug, group);
}
