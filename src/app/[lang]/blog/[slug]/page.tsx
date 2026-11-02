// Blog article. The page itself lives in ../ArticleView.tsx, shared with the guides routes.
// An article that belongs to the guides section (its category is a guide category,
// src/lib/articleSections.ts) is redirected permanently to its guides URL.
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getBlogPostByLang, getBlogSlugs, ALL_LOCALES } from "@/sanity/sanity.utils";
import { localizedHref } from "@/lib/locale";
import { sectionSegments } from "@/lib/articleSections";
import { ArticleView, articleMetadata } from "../ArticleView";

type Props = { params: { lang: string; slug: string } };

export const revalidate = 3600;
export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of ALL_LOCALES) {
    for (const slug of await getBlogSlugs(lang, "blog")) params.push({ lang, slug });
  }
  return params;
}

async function guideTarget({ lang, slug }: Props["params"]): Promise<string | null> {
  const post = await getBlogPostByLang(lang, slug);
  return post && post.section === "guides" ? localizedHref(lang, sectionSegments(lang, slug, "guides")) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return (await guideTarget(props.params)) ? {} : articleMetadata(props);
}

export default async function PagePost(props: Props) {
  const target = await guideTarget(props.params);
  if (target) permanentRedirect(target);
  return <ArticleView {...props} />;
}
