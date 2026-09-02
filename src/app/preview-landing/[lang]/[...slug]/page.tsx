import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";

import { i18n } from "@/i18n.config";
import { isLocale, localizedHref } from "@/lib/locale";
import { getSinglePageByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import type { Translation } from "@/types/homepage";

import Nav from "@/app/preview-home/sections/Nav";
import Footer from "@/app/preview-home/sections/Footer";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";
import LandingProjectsGrid from "../../LandingProjectsGrid";
import OffPlanSnapshot from "../../OffPlanSnapshot";
import FaqAccordion, { type FaqItem } from "@/app/preview-insights/FaqAccordion";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Params = { params: { lang: string; slug: string[] } };

/** The five block types the landing family is built from, in render order. */
const LANDING_TEXT = new Set(["landingTextStart", "landingTextFirst", "landingTextSecond"]);

export default async function PreviewLandingPage({ params }: Params) {
  const { lang } = params;
  if (!isLocale(lang)) notFound();

  // Slugs can be multi-segment (parent/child), exactly as the live catch-all
  // resolves them — join rather than take the first, or a child page 404s.
  const slug = (params.slug ?? []).join("/");
  const page = (await getSinglePageByLang(lang, slug)) as any;
  if (!page) notFound();

  const blocks: any[] = Array.isArray(page.contentBlocks) ? page.contentBlocks : [];
  const intro = blocks.find((b) => b?._type === "landingIntroBlock");
  const faq = blocks.find((b) => b?._type === "landingFaqBlock");
  const projectsBlock = blocks.find((b) => b?._type === "landingProjectsBlock");
  const snapshot = blocks.find((b) => b?._type === "offPlanSnapshotBlock");
  const texts = blocks.filter((b) => LANDING_TEXT.has(b?._type));

  const s = projectsStrings(lang);
  // Translation is { path, language } — the same shape preview-about builds.
  // The landing slug is per-language in the DB, so a locale that has no
  // translation of this page would need its own lookup; for the preview tree
  // the slug is carried across unchanged, which is right for the ~93 pages
  // whose slug is identical in every language and wrong for the rest.
  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: l.id === "en" ? `/${slug}` : `/${l.id}/${slug}`,
  }));

  // Same precedence the live block uses: a hand-pinned list wins over the
  // live query, and an absent field is an empty list rather than a crash.
  const manual = Array.isArray(projectsBlock?.projects) ? projectsBlock.projects : [];
  const filtered = Array.isArray(projectsBlock?.filteredProjects) ? projectsBlock.filteredProjects : [];
  const projects = manual.length > 0 ? manual : filtered;

  // Shape is { items: [{ _key, question, answer }] } with answer as Portable
  // Text — the same one preview-insights' FaqBlock handles, so the mapping is
  // its mapping. Rendering a raw answer would put a Portable Text object
  // straight into JSX ("Objects are not valid as a React child").
  const faqItems: FaqItem[] = (faq?.faq?.items ?? []).map((it: any, i: number) => ({
    key: it?._key ?? `faq-${i}`,
    question: it?.question ?? "",
    answer: Array.isArray(it?.answer)
      ? <PortableText value={it.answer} components={insightsComponents as any} />
      : <p className="pl-prose">{it?.answer ?? ""}</p>,
  }));

  // The clouds alternate sides down the page — projects left, then each prose
  // section flipping after it. Counted here rather than with :nth-child so the
  // rhythm survives a section being absent: a page without a projects block
  // still starts on the left.
  const side = (i: number) => (i % 2 === 0 ? "pl-atmos--left" : "pl-atmos--right");
  const firstProseIndex = projectsBlock ? 1 : 0;

  const heroImage = intro?.image ? urlFor(intro.image).url() : null;

  return (
    <>
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />

      <main className="pl" data-theme="dark">
        {/* The article hero, class for class — full-bleed cover behind a scrim
            with the claim sitting on it. Reusing .iart__hero rather than a
            landing-specific one keeps the two page types on one hero, so a
            change to it lands on both instead of drifting apart. */}
        {intro && (
          <header className={`iart__hero${heroImage ? " iart__hero--image" : ""}`}>
            {heroImage && (
              <div className="iart__hero-bg" aria-hidden="true">
                <img src={heroImage} alt="" fetchPriority="high" />
                <span className="iart__hero-scrim" />
              </div>
            )}
            <div className="wrap iart__hero-inner">
              {intro.subtitle && <p className="iart__kicker">{intro.subtitle}</p>}
              <h1 className="iart__title">{intro.title || page.title}</h1>
              {intro.description && <p className="pl-hero__lead">{intro.description}</p>}
              {intro.buttonLabel && (
                <a className="btn btn--glass" href={`${localizedHref(lang)}/contacts`}>
                  {intro.buttonLabel}
                </a>
              )}
            </div>
          </header>
        )}

        {projectsBlock && (
          <section className={`pl__sec pl-atmos ${side(0)}`}>
            <div className="pl__wrap">
              {projectsBlock.title && <h2 className="pl__h2 pl__h2--center">{projectsBlock.title}</h2>}
              {projects.length > 0 ? (
                <LandingProjectsGrid projects={projects} lang={lang} />
              ) : (
                <p className="pl-grid__empty">{s.empty}</p>
              )}
            </div>
          </section>
        )}

        {/* Sits between the listings and the prose, where the CMS put it
            (position 2 of 6 on all three off-plan pages). */}
        {snapshot && (
          <section className={`pl__sec--tight pl__sec pl-atmos ${side(firstProseIndex)}`}>
            <div className="pl__wrap">
              <OffPlanSnapshot block={snapshot} ctaHref={`${localizedHref(lang)}/contacts`} />
            </div>
          </section>
        )}

        {texts.map((t, i) => (
          <section className={`pl__sec--tight pl__sec pl-atmos ${side(firstProseIndex + (snapshot ? 1 : 0) + i)}`} key={t._key}>
            <div className="pl__wrap">
              <div className="pl-prose">
                <PortableText value={t.content} components={insightsComponents as any} />
              </div>
            </div>
          </section>
        ))}

        {/* The FAQ sits on paper, the way the article's reading body does:
            "section is-light" is the redesign's own pair — .section paints
            var(--bg) and .is-light redefines that token to --paper, so the
            accordion inherits the light values it was styled against. The gold
            contour is dropped here; the surface change already separates the
            sections, and a divider on top of it would be a second one. */}
        {faqItems.length > 0 && (
          <section className="section is-light">
            <div className="pl__wrap">
              {faq.title && <h2 className="pl__h2">{faq.title}</h2>}
              <FaqAccordion items={faqItems} />
            </div>
          </section>
        )}
      </main>

      <Footer lang={lang} />
    </>
  );
}
