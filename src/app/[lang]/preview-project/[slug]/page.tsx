// SEO-facing project page for the new Development pipeline, addressed by a
// stable slug (assigned automatically on publish — src/lib/developmentSeo.ts)
// instead of the internal ?dev=&id= feed key. This is the route that carries
// real per-project metadata/canonical/hreflang/structured-data; the legacy
// query-string route (../page.tsx) now just 301s here once a slug exists.
//
// Interim path: this lives at /preview-project/[slug] during the transition —
// at cutover (old Sanity Project system retired) this route moves to
// /projects/[slug] and NEW_PROJECTS_INDEXABLE flips to true.
import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { abs, staticAlternates, DEFAULT_OG_IMAGE } from "@/lib/seo";
import type { Translation } from "@/types/homepage";

import ProjectPageBody from "@/app/preview-project/ProjectPageBody";
import DevelopmentSchema from "@/app/components/DevelopmentSchema/DevelopmentSchema";
import { getDbProjectBySlug } from "@/lib/developmentRender";
import { resolveMetaTitle, resolveMetaDescription, NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";

export const dynamic = "force-dynamic";

type Props = { params: { lang: string; slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const p = await getDbProjectBySlug(slug);
  if (!p) return {};

  const title = resolveMetaTitle(p, lang, p.seoOverride);
  const description = resolveMetaDescription(p, lang, p.seoOverride);
  const { canonical, languages } = staticAlternates(lang, ["preview-project", slug]);
  const ogImage = p.gallery[0] ? abs(p.gallery[0]) : DEFAULT_OG_IMAGE;
  const canIndex = NEW_PROJECTS_INDEXABLE && p.publishStatus === "published";

  return {
    title,
    description,
    alternates: { canonical, languages },
    robots: { index: canIndex, follow: canIndex },
    openGraph: {
      title, description, url: canonical, siteName: "Cyprus VIP Estates", locale: lang, type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: p.publicName }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function ProjectSlugPage({ params }: Props) {
  const { lang, slug } = params;
  const p = await getDbProjectBySlug(slug);
  if (!p) notFound();

  const { canonical } = staticAlternates(lang, ["preview-project", slug]);
  const translations: Translation[] = i18n.languages.map((l) => ({ language: l.id, path: localizedHref(l.id, ["preview-project", slug]) }));

  return (
    <>
      <DevelopmentSchema p={p} lang={lang} canonical={canonical} />
      <ProjectPageBody p={p} lang={lang} params={params} translations={translations} />
    </>
  );
}
