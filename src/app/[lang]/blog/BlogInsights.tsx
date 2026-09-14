// Shared body for the live blog listing (page 1 = /[lang]/blog, page N =
// /[lang]/blog/page/N). Ports the /preview-insights design to the LIVE
// multilingual route: keeps the live Header/Footer + real Prisma data + SEO
// (handled by the route generateMetadata), swaps the old FormStatic for the new
// redesign form, and adds de/pl/ru UI translations. Design-system CSS + fonts
// are imported here so they load only on the listing routes (not /blog/[slug]).
import React from "react";
import { notFound } from "next/navigation";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "@/app/preview-home/tokens.css";
import "@/app/preview-insights/insights.css";

import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { blogIndexMode } from "@/lib/blogIndexMode";
import {
  getBlogPageByLang,
  getBlogPostsByLangWithPagination,
  getFormStandardDocumentByLang,
  getTotalBlogPostsByLang,
} from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { Translation } from "@/types/homepage";
import { FormStandardDocument } from "@/types/formStandardDocument";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";

import InsightsList, { type InsightsCard } from "@/app/preview-insights/InsightsList";
import InsightsSeo from "@/app/preview-insights/InsightsSeo";
import InsightsMotion from "@/app/preview-insights/InsightsMotion";
import Form from "@/app/preview-home/sections/Form";
import { blogStrings } from "./blogI18n";

// Fonts scoped to the blog listing (applied on <main>, not the shared <body>, so
// the live Header/Footer keep their font). Config MUST match preview-insights/
// layout.tsx exactly — same weights, italic style, and subsets — otherwise the
// gold `.it` accent words render as faux-synthesized italic and weights differ.
const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Mulish({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const cyr = Playfair_Display({
  subsets: ["cyrillic"],
  weight: ["400", "500"],
  variable: "--font-display-cyr",
  display: "swap",
});

const REGULAR_PER_PAGE = 15;
const PAGE_1_TOTAL = 1 + REGULAR_PER_PAGE; // 1 featured + 15 regular
export const totalPagesFor = (total: number) =>
  total <= PAGE_1_TOTAL ? 1 : 1 + Math.ceil((total - PAGE_1_TOTAL) / REGULAR_PER_PAGE);

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const slugOf = (p: any, lang: string): string =>
  p?.slug?.[lang]?.current ?? (Object.values(p?.slug ?? {})[0] as any)?.current ?? p?.slug?.current ?? "";

export default async function BlogInsights({ lang, page }: { lang: string; page: number }) {
  const t = blogStrings(lang);

  // Phase 6 — cross-locale index: `he` has no Hebrew articles yet, so below
  // MIN_OWN_ARTICLES (see blogIndexMode.ts) the index borrows the ENGLISH
  // articles instead of querying (empty) `language: "he"` rows. `heCount` is
  // only ever consulted for lang === "he"; every other locale is unaffected
  // (mode.sourceLang === lang, noindex: false).
  const heCount = lang === "he" ? await getTotalBlogPostsByLang("he") : 0;
  const mode = blogIndexMode(lang, heCount);
  const crossLocale = mode.sourceLang !== lang;
  // In cross-locale mode the count names the language ("articles in English");
  // once `he` has its own articles the plain nouns apply. LTR never crosses.
  const articleOne = crossLocale ? (t.articleOneCross ?? t.articleOne) : t.articleOne;
  const articleMany = crossLocale ? (t.articleManyCross ?? t.articleMany) : t.articleMany;
  const total = mode.sourceLang === "he" ? heCount : await getTotalBlogPostsByLang(mode.sourceLang);
  const pages = totalPagesFor(total);
  if (!Number.isInteger(page) || page < 1 || (total > 0 && page > pages)) notFound();

  // Fetch the full ordered list once — the "All" view shows this page's slice +
  // pager, while the client category filter needs every article. Sourced from
  // `mode.sourceLang`, not `lang`, so the cross-locale case fetches EN posts.
  const allPosts = await getBlogPostsByLangWithPagination(mode.sourceLang, Math.max(total, PAGE_1_TOTAL), 0);
  const blogBase = localizedHref(lang, "blog"); // "/blog" | "/de/blog" | ... — this locale's OWN pagination base
  // Card hrefs point at the source locale's article path — for `he` in
  // cross-locale mode that's the EN article ("/blog/<slug>", no /he/ prefix).
  const articleBase = crossLocale ? localizedHref(mode.sourceLang, "blog") : blogBase;
  const allCards: InsightsCard[] = (allPosts ?? []).map((p: any) => ({
    id: p._id,
    title: p.title,
    excerpt: p.excerpt ?? "",
    href: `${articleBase}/${slugOf(p, mode.sourceLang)}`,
    image: safeUrl(p.previewImage),
    // Cross-locale mode replaces the (English) category with the "In
    // English" badge in the same slot (icard__cat / ifeat__cat) — it reads
    // as the intended badge AND, being identical on every card, collapses
    // InsightsList's category filter to a single value, which hides the
    // category tabs (InsightsList only renders them when count > 1). Chosen
    // over showing (English-language) category tabs on a Hebrew page.
    category: crossLocale ? t.englishBadge : (p.category?.title ?? ""),
    date: p.publishedAt ?? "",
  }));
  const heroCard = allCards[0];

  const blogPage = await getBlogPageByLang(lang);
  const formDocument: FormStandardDocument = await getFormStandardDocumentByLang(lang);

  // hero heading: compact localized brand heading (like the preview), last word
  // gold-accented. The SEO <title>/description still come from the blogPage doc.
  const titleRaw = (t.heroTitle || "Cyprus Insights").trim();
  const words = titleRaw.split(/\s+/);
  const titleAccent = words.pop() ?? "";
  const titleLead = words.join(" ");
  const heroLead = blogPage?.metaDescription || "";

  // language switcher (same logic as the previous live blog page)
  const translationSlugs = blogPage?._translations?.map((item: any) => {
    const out: { [k: string]: { current: string } } = {};
    for (const key in item.slug) if (key !== "_type") out[key] = { current: item.slug[key].current };
    return out;
  });
  const translations = i18n.languages.reduce<Translation[]>((acc, l) => {
    const slug = translationSlugs
      ?.reduce((a: string[], s: any) => {
        const cur = s[l.id]?.current;
        if (cur) a.push(cur);
        return a;
      }, [])
      .join(" ");
    return slug ? [...acc, { language: l.id, path: localizedHref(l.id, slug) }] : acc;
  }, []);

  return (
    <>
      <Header params={{ lang }} translations={translations} />
      <main className={`ins ${display.variable} ${body.variable} ${cyr.variable}`} style={{ fontFamily: "var(--font-body)" }}>
        <InsightsMotion />
        <header className="ins__hero is-light">
          <div className="wrap ins__hero-grid">
            <div className="ins__hero-text">
              <p className="ins__eyebrow">{t.eyebrow}</p>
              <h1 className="ins__hero-title">
                {titleLead ? `${titleLead} ` : ""}
                <span className="it">{titleAccent}</span>
              </h1>
              {heroLead && <p className="ins__hero-lead">{heroLead}</p>}
              <p className="ins__hero-meta">
                {/* Hebrew needs the whole line, not "{n} {noun}": at 0 it reads
                    "there are no articles yet", at 1 the numeral is spelled out
                    inside the noun phrase and no digit is printed. From 2 up it
                    is the same "{n} {plural}" shape the LTR locales use, which
                    stay byte-identical. See docs/i18n/reviews/wp4.md. */}
                {lang === "he" && total <= 1 ? (
                  total === 0 ? "אין עדיין מאמרים" : articleOne
                ) : (
                  <>{total} {total === 1 ? articleOne : articleMany}</>
                )}
              </p>
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
                    <span className="ins__device-kicker">{titleRaw}</span>
                    <p className="ins__device-headline">{heroCard?.title ?? titleRaw}</p>
                    <span className="ins__device-line" />
                    <span className="ins__device-line" />
                    <span className="ins__device-line ins__device-line--short" />
                    <span className="ins__device-read">{t.readArticle}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <InsightsList
          allCards={allCards}
          page={page}
          totalPages={pages}
          basePath={blogBase}
          locale={t.dateLocale}
          navSelector="header"
          strings={{
            all: t.filterAll,
            read: t.read,
            readArticle: t.readArticle,
            categoriesAria: t.categoriesAria,
            pagerAria: t.pagerAria,
            firstPage: t.firstPage,
            lastPage: t.lastPage,
            pageWord: t.pageWord,
            empty: t.empty,
          }}
        />

        {/* new lead form (design layer only; same submit/CRM/validation) —
            below the grid/pagination, before the SEO/content section */}
        <Form lang={lang} />

        {page === 1 && blogPage?.content && (
          <InsightsSeo content={blogPage.content} eyebrow={t.guideEyebrow} title={t.guideTitle} />
        )}
      </main>
      <Footer params={{ lang }} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={lang} />
    </>
  );
}
