import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBlogPageByLang,
  getBlogPostsByLangWithPagination,
  getTotalBlogPostsByLang,
} from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import InsightsList, { type InsightsCard } from "./InsightsList";
import InsightsSeo from "./InsightsSeo";
import LightHeroFlag from "./LightHeroFlag";
import InsightsMotion from "./InsightsMotion";
import Nav from "../preview-home/sections/Nav";
import Footer from "../preview-home/sections/Footer";

/* Cyprus Insights — paginated magazine index (EN). Page 1 = 1 featured + 15
   regular; page 2+ = 15 regular (no featured, no SEO guide → no duplicate content).
   Page 1 lives at /preview-insights; page N at /preview-insights/page/N. Shared by
   both routes so the markup/SEO stay in sync. */

const LANG = "en";
const REGULAR_PER_PAGE = 15;
const PAGE_1_TOTAL = 1 + REGULAR_PER_PAGE; // 1 featured + 15 regular = 16

export const pageHref = (n: number) => (n <= 1 ? "/preview-insights" : `/preview-insights/page/${n}`);

export const totalPagesFor = (total: number) =>
  total <= PAGE_1_TOTAL ? 1 : 1 + Math.ceil((total - PAGE_1_TOTAL) / REGULAR_PER_PAGE);

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const toCard = (p: any): InsightsCard => ({
  id: p._id,
  title: p.title,
  excerpt: p.excerpt ?? "",
  href: `/preview-insights/${p.slug?.[LANG]?.current ?? (Object.values(p.slug ?? {})[0] as any)?.current ?? ""}`,
  image: safeUrl(p.previewImage),
  category: p.category?.title ?? "",
  date: p.publishedAt ?? "",
});

export async function insightsPageMetadata(page: number): Promise<Metadata> {
  const title = page > 1 ? `Cyprus Insights — Page ${page}` : "Cyprus Insights";
  const description =
    page > 1
      ? `More stories, guides and market intelligence on living, buying and investing in Cyprus — page ${page}.`
      : "Stories, guides and market intelligence on living, buying and investing in Cyprus, from Cyprus VIP Estates.";
  // Self-canonical per page (avoids page 1 / page N duplicate content). The preview
  // stays noindex (layout robots) — this structure is correct for cutover.
  return { title, description, alternates: { canonical: pageHref(page) } };
}

export default async function InsightsIndex({ page }: { page: number }) {
  const total = await getTotalBlogPostsByLang(LANG);
  const pages = totalPagesFor(total);
  if (!Number.isInteger(page) || page < 1 || (total > 0 && page > pages)) notFound();

  // Fetch the full ordered list once: the "All" view shows this page's slice +
  // server pager, while the category filter (client-side) needs every article so
  // it can show all categories and filter across pages without navigation.
  const allPosts = await getBlogPostsByLangWithPagination(LANG, Math.max(total, PAGE_1_TOTAL), 0);
  const allCards = (allPosts ?? []).map(toCard);
  const heroCard = allCards[0];

  // SEO guide only on page 1 (prevents duplicate content across paginated pages)
  const blogPage = page === 1 ? await getBlogPageByLang(LANG) : null;

  return (
    <>
      <LightHeroFlag />
      <InsightsMotion />
      <Nav />
      <main className="ins">
        <header className="ins__hero is-light">
          <div className="wrap ins__hero-grid">
            <div className="ins__hero-text">
              <p className="ins__eyebrow">The Journal</p>
              <h1 className="ins__hero-title">
                Cyprus <span className="it">Insights</span>
              </h1>
              <p className="ins__hero-lead">
                Stories, guides and market intelligence on living, buying and investing in Cyprus — from the
                team behind Cyprus VIP Estates.
              </p>
              <p className="ins__hero-meta">{total} {total === 1 ? "article" : "articles"}</p>
            </div>

            <div className="ins__hero-art" aria-hidden>
              <div className="ins__device">
                <div className="ins__device-screen">
                  <div className="ins__device-topbar">
                    <span className="ins__device-brand">Cyprus VIP Estates</span>
                    <span className="ins__device-dots"><i /><i /><i /></span>
                  </div>
                  {heroCard?.image && (
                    <div className="ins__device-cover" style={{ backgroundImage: `url("${heroCard.image}")` }} />
                  )}
                  <div className="ins__device-content">
                    <span className="ins__device-kicker">Cyprus Insights</span>
                    <p className="ins__device-headline">{heroCard?.title ?? "Property in Cyprus"}</p>
                    <span className="ins__device-line" />
                    <span className="ins__device-line" />
                    <span className="ins__device-line ins__device-line--short" />
                    <span className="ins__device-read">Read article</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <InsightsList allCards={allCards} page={page} totalPages={pages} />

        {page === 1 && blogPage?.content && <InsightsSeo content={blogPage.content} />}
      </main>
      <Footer lang="en" />
    </>
  );
}
