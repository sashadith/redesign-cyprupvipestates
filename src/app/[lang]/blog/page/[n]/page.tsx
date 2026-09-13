// Live blog listing — pages 2+ (/[lang]/blog/page/N). Page 1 lives at
// /[lang]/blog, so /page/1 and non-numeric → 404 (avoids duplicate content).
import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  staticAlternates,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
} from "@/lib/seo";
import { getBlogPageByLang, getTotalBlogPostsByLang } from "@/sanity/sanity.utils";
import { blogIndexMode } from "@/lib/blogIndexMode";
import BlogInsights from "../../BlogInsights";

export const dynamic = "force-dynamic";

type Props = { params: { lang: string; n: string } };

const parse = (n: string) => {
  const v = Number(n);
  return Number.isInteger(v) && v >= 2 ? v : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parse(params.n) ?? 2;
  const data = await getBlogPageByLang(params.lang);
  // self-canonical + hreflang for THIS paginated page, in every language
  const { canonical, languages } = staticAlternates(params.lang, `blog/page/${page}`);
  const title = data?.metaTitle ? `${data.metaTitle} — ${page}` : undefined;
  // Phase 6: see page.tsx (page 1) — the same borrowed-EN-content window
  // stays noindex on every paginated page while `he` has under 5 own articles.
  const heCount = params.lang === "he" ? await getTotalBlogPostsByLang("he") : 0;
  const { noindex } = blogIndexMode(params.lang, heCount);
  return {
    title,
    description: data?.metaDescription,
    alternates: { canonical, languages },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description: data?.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: data?.metaDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const PageBlogPaged = async ({ params }: Props) => {
  const page = parse(params.n);
  if (page === null) notFound();
  return <BlogInsights lang={params.lang} page={page} />;
};

export default PageBlogPaged;
