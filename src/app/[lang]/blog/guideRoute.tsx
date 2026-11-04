// The four guide-article routes (/guides/<slug>, /de/ratgeber/<slug>, /pl/poradniki/<slug>,
// /ru/gajdy/<slug>) are separate folders because Next route folders cannot be translated; each
// is a few lines that call into here. Everything that decides what a guide URL does is in this
// file: it renders the article when the article belongs to the guides section of THIS language's
// URL, and otherwise sends the visitor with a permanent redirect to where the article lives
// (the other section, or the right language's guides slug). See src/lib/articleSections.ts.
import React from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { missingTarget } from "@/lib/missingPageRedirect";
import { localizedHref } from "@/lib/locale";
import { guidesSectionSlug, hasGuidesSection, sectionSegments } from "@/lib/articleSections";
import { getBlogPostByLang } from "@/sanity/sanity.utils";
import { ArticleView, articleMetadata } from "./ArticleView";

type Params = { lang: string; slug: string };

/** Where this URL should end up, or null when it is the right URL for a guide. */
async function guideRedirectTarget(routeSlug: string, { lang, slug }: Params) {
  // Hebrew has no guides section: whatever is at this slug is a blog article (or nothing).
  if (!hasGuidesSection(lang)) return { target: localizedHref(lang, ["blog", slug]), post: null };
  const post = await getBlogPostByLang(lang, slug);
  if (!post) return { target: null, post: null };
  if (post.section !== "guides") return { target: localizedHref(lang, sectionSegments(lang, slug, post.section)), post };
  if (guidesSectionSlug(lang) !== routeSlug) return { target: localizedHref(lang, [guidesSectionSlug(lang), slug]), post };
  return { target: null, post };
}

export async function guideMetadata(props: { params: Params }, routeSlug: string): Promise<Metadata> {
  const { target, post } = await guideRedirectTarget(routeSlug, props.params);
  // A page that only redirects needs no metadata; a missing article renders via the missing-page resolver.
  if (target || !post) return {};
  return articleMetadata(props);
}

export async function GuidePage(props: { params: Params }, routeSlug: string) {
  const { target, post } = await guideRedirectTarget(routeSlug, props.params);
  if (target) permanentRedirect(target);
  if (!post) {
    const { lang, slug } = props.params;
    // The missing-page resolver finds the article's sibling or, failing that, the blog index; a guides URL
    // that matches nothing belongs to the guides index instead.
    const target = await missingTarget("blog", lang, [slug], localizedHref(lang, [routeSlug, slug]));
    if (target) permanentRedirect(target === localizedHref(lang, "blog") ? localizedHref(lang, guidesSectionSlug(lang)) : target);
    notFound();
  }
  return <ArticleView {...props} />;
}
