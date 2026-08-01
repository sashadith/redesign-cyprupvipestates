// Resolves a DeveloperAccount's linked public developer page (Bündel 3
// Schritt 1, 2026-08-01). See the schema comment on
// DeveloperAccount.developerTranslationGroupId for why this is a plain
// lookup by translationGroupId rather than a formal Prisma relation.
import { prisma } from "@/lib/prisma";

export type LinkedDeveloper = { id: string; slug: string; title: string; logo: unknown };

// Resolves the Developer row for a specific language. Returns null when
// unlinked (developerTranslationGroupId is null) OR when the link is stale
// (the group no longer has a row in that language) — callers that need to
// tell these two states apart should use developerGroupExists() alongside.
export async function resolveLinkedDeveloper(
  developerTranslationGroupId: string | null,
  lang: string,
): Promise<LinkedDeveloper | null> {
  if (!developerTranslationGroupId) return null;
  return prisma.developer.findFirst({
    where: { translationGroupId: developerTranslationGroupId, language: lang as any },
    select: { id: true, slug: true, title: true, logo: true },
  });
}

// Does the linked translation group still exist AT ALL (any language)? A
// non-null developerTranslationGroupId with no matching row in ANY language
// is a broken link (the Developer group was deleted, or its id changed) —
// see developerLinkBrokenReminders() in actionCenter/rules/developers.ts.
export async function developerGroupExists(developerTranslationGroupId: string): Promise<boolean> {
  const row = await prisma.developer.findFirst({
    where: { translationGroupId: developerTranslationGroupId },
    select: { id: true },
  });
  return !!row;
}

// Options for the admin "link a public page" dropdown — one entry per
// translation group, labelled with its English title (every real profile
// has an EN row; if one genuinely doesn't, it simply won't be selectable
// here rather than guessing a label from another language).
export async function listDeveloperPageOptions(): Promise<{ translationGroupId: string; title: string; slug: string }[]> {
  const rows = await prisma.developer.findMany({
    where: { language: "en" as any, translationGroupId: { not: null } },
    select: { translationGroupId: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });
  return rows as { translationGroupId: string; title: string; slug: string }[];
}
