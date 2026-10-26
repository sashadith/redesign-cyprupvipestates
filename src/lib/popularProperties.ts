import { prisma } from "@/lib/prisma";
import { resolvePinnedProjects } from "@/sanity/sanity.utils";

/* Resolves an article's popularProperties ([{ link, label }]) to project cards.

   The links are /projects/<slug> URLs (absolute or relative, with or without a
   locale prefix); the slug is matched against PUBLISHED developments and the
   cards are built by resolvePinnedProjects, so they look exactly like the cards
   of an editor-placed Projects block (image, name, distances, availability).
   Entries that do not name a published development are dropped silently — a
   stale link must never render a dead card — and the caller falls back to the
   generic recommended set when nothing resolves. Order follows the editor's. */
export async function getPopularPropertyCards(items: unknown, lang: string, limit = 3) {
  if (!Array.isArray(items)) return [];
  const slugs: string[] = [];
  for (const it of items) {
    const link = typeof (it as any)?.link === "string" ? (it as any).link : "";
    const m = link.match(/\/projects\/([^/?#]+)/);
    if (m && !slugs.includes(m[1])) slugs.push(m[1]);
  }
  if (!slugs.length) return [];

  const rows = await prisma.development.findMany({
    where: { slug: { in: slugs }, publishStatus: "published" },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(rows.map((r) => [r.slug as string, r.id]));
  const ids = slugs.map((s) => idBySlug.get(s)).filter((id): id is string => !!id).slice(0, limit);
  return ids.length ? resolvePinnedProjects(ids, lang) : [];
}
