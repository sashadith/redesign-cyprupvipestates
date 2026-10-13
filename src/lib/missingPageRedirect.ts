import { notFound, permanentRedirect } from "next/navigation";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPublicLocale, localizedHref } from "@/lib/locale";
import { mergedTargetFor, nestedCanonicalFor } from "@/middleware";
import { resolveMissing, type MissingKind, type MissingRepo, type SlugRow } from "@/lib/missingPageResolve";

const sel = { language: true, slug: true, translationGroupId: true } as const;
const asRow = (r: { language: string; slug: string; translationGroupId: string | null } | null): SlugRow | null =>
  r ? { language: String(r.language), slug: r.slug, translationGroupId: r.translationGroupId } : null;
const asRows = (rs: Array<{ language: string; slug: string; translationGroupId: string | null }>): SlugRow[] =>
  rs.map((r) => asRow(r) as SlugRow);

export function prismaMissingRepo(db: PrismaClient): MissingRepo {
  return {
    blogsBySlug: async (slug) => asRows(await db.blog.findMany({ where: { slug, status: "PUBLISHED" }, select: sel })),
    blogSibling: async (groupId, language) =>
      asRow(await db.blog.findFirst({ where: { translationGroupId: groupId, language: language as any, status: "PUBLISHED" }, select: sel })),
    pagesBySlug: async (slug) => asRows(await db.singlepage.findMany({ where: { slug, status: "PUBLISHED" }, select: sel })),
    pagesEndingWith: async (language, last) =>
      asRows(await db.singlepage.findMany({ where: { language: language as any, status: "PUBLISHED", slug: { endsWith: `/${last}` } }, select: sel })),
    pageSibling: async (groupId, language) =>
      asRow(await db.singlepage.findFirst({ where: { translationGroupId: groupId, language: language as any, status: "PUBLISHED" }, select: sel })),
    pageExists: async (language, slug) =>
      !!(await db.singlepage.findFirst({ where: { language: language as any, slug, status: "PUBLISHED" }, select: { id: true } })),
  };
}

/** The best live page for a URL that matches nothing, or null (scanner junk, or the lookup failed). */
export async function missingTarget(kind: MissingKind, lang: string, segments: string[], currentPath?: string): Promise<string | null> {
  try {
    return await resolveMissing(prismaMissingRepo(prisma), { isPublicLocale, href: localizedHref, redirected: (p) => mergedTargetFor(p) ?? nestedCanonicalFor(p) }, { kind, lang, segments, currentPath });
  } catch (e) {
    console.error("[missing-page-redirect] lookup failed, answering 404:", e);
    return null;
  }
}

/**
 * Replaces a bare notFound(): sends the visitor (and Google) to the best live
 * page for a URL that matches nothing, with a permanent redirect. Falls back to
 * a real 404 only for scanner junk or if the lookup itself fails.
 */
export async function redirectMissingOrNotFound(kind: MissingKind, lang: string, segments: string[], currentPath?: string): Promise<never> {
  const target = await missingTarget(kind, lang, segments, currentPath);
  if (target) permanentRedirect(target);
  notFound();
}
