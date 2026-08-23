import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageKey, type PageKey } from "./types";

export type InventoryPage = {
  key: PageKey;
  locale: Locale;
  /** canonical path, English without a locale prefix */
  path: string;
  kind: "development" | "project" | "blog" | "singlepage";
  title: string;
};

const LOCALES: Locale[] = ["en", "de", "pl", "ru"] as Locale[];

/** English is served prefix-less; every other locale carries its prefix. */
function localised(locale: Locale, path: string): string {
  return locale === ("en" as Locale) ? path : `/${locale}${path}`;
}

/**
 * Every publicly reachable, indexable page, as canonical `locale::path` keys.
 *
 * Developments carry ONE language-agnostic slug (see developmentSeo.ts) and are
 * therefore reachable in all four locales. Projects, Blogs and Singlepages are
 * per-locale rows and exist only in the locale they were authored in.
 */
export async function getInventory(): Promise<InventoryPage[]> {
  const [devs, projects, blogs, singles] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: "published", slug: { not: null } },
      select: { slug: true, publicName: true },
    }),
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, language: true, title: true },
    }),
    prisma.singlepage.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, language: true, title: true },
    }),
  ]);

  const out: InventoryPage[] = [];

  for (const d of devs) {
    for (const locale of LOCALES) {
      const path = localised(locale, `/projects/${d.slug}`);
      out.push({ key: pageKey(locale, path), locale, path, kind: "development", title: d.publicName });
    }
  }
  for (const p of projects) {
    const path = localised(p.language, `/projects/${p.slug}`);
    out.push({ key: pageKey(p.language, path), locale: p.language, path, kind: "project", title: p.title });
  }
  for (const b of blogs) {
    const path = localised(b.language, `/blog/${b.slug}`);
    out.push({ key: pageKey(b.language, path), locale: b.language, path, kind: "blog", title: b.title });
  }
  for (const s of singles) {
    // Singlepage.slug may be multi-segment ("parent/child") — see schema.
    const path = localised(s.language, `/${s.slug}`);
    out.push({ key: pageKey(s.language, path), locale: s.language, path, kind: "singlepage", title: s.title });
  }

  // A Development slug can collide with a legacy Project slug during the
  // supersede window; the Development wins because it is what the dispatcher
  // serves (see src/app/[lang]/projects/[slug]/page.tsx).
  const byKey = new Map<PageKey, InventoryPage>();
  for (const page of out) {
    const existing = byKey.get(page.key);
    if (!existing || (existing.kind === "project" && page.kind === "development")) byKey.set(page.key, page);
  }
  return Array.from(byKey.values());
}
