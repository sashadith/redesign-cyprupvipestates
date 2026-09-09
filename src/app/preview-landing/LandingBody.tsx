import React from "react";
import Link from "next/link";
import { PortableText } from "@portabletext/react";
import { localizedHref } from "@/lib/locale";
import { urlFor } from "@/sanity/sanity.client";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";
import LandingProjectsGrid from "./LandingProjectsGrid";
import OffPlanSnapshot from "./OffPlanSnapshot";
import FaqAccordion, { type FaqItem } from "@/app/preview-insights/FaqAccordion";
import { HEADINGS } from "@/app/components/SectionLinks/SectionLinks";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";
// Pager visual style reused as-is from ProjectsSectionBlockComponent (.pager/
// .pagerLink/.pagerLinkActive/.pagerLinkDisabled/.pagerGap) -- same reuse the
// deleted LandingProjectsBlockComponent made before the 2026-09-02 redesign
// dropped it. That component's pager markup never made it into this one when
// it replaced it (see docs/SITE-CHANGELOG.md, 2026-09-09 entry); this restores
// it rather than reinventing it.
import pagerStyles from "@/app/components/ProjectsSectionBlockComponent/ProjectsSectionBlockComponent.module.scss";

// Windowed page numbers: 1 … current-1 current current+1 … last. Duplicated
// from ProjectsSectionBlockComponent's identical helper (and from the deleted
// LandingProjectsBlockComponent, which duplicated it first) rather than
// exporting it from that untouched, out-of-scope client component.
function pageWindow(current: number, total: number): Array<number | "…"> {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!keep.has(n)) continue;
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

/* The landing family's body, held apart from any one route so the live
   catch-all and the preview tree render the identical thing — the same split
   preview-project/ProjectPageBody uses for the project pages. Only the
   surrounding chrome differs: the live route wraps it in the site's shared
   Header/Footer, the preview tree in the redesign's own Nav/Footer.

   The five block types the landing family is built from, in render order. */
const LANDING_TEXT = new Set(["landingTextStart", "landingTextFirst", "landingTextSecond"]);

/** Every block type this body knows how to render. */
const RENDERED = new Set([
  "landingIntroBlock",
  "landingTextStart",
  "landingTextFirst",
  "landingTextSecond",
  "landingProjectsBlock",
  "landingFaqBlock",
  "offPlanSnapshotBlock",
]);

/* True only when this body can render the WHOLE page, not merely part of it.

   "Has a landing block" is not enough: the English and Russian top-100 lists
   carry one landing block and are otherwise built from the classic block set,
   so that test would route them here and drop almost everything they contain.
   A page qualifies when it uses the landing family AND every block it has is
   one this body renders — which also means a page stays on the old renderer
   the moment an editor adds a classic block to it, rather than silently
   losing that block. */
export function isLandingPage(blocks: any[]): boolean {
  const bs = Array.isArray(blocks) ? blocks : [];
  const types = bs.map((b) => String(b?._type ?? "")).filter(Boolean);
  if (!types.length) return false;
  if (!types.some((t) => t.startsWith("landing"))) return false;
  return types.every((t) => RENDERED.has(t));
}

export default function LandingBody({
  page,
  lang,
  relatedLinks = [],
  pagePath,
}: {
  page: any;
  lang: string;
  /** Editor-curated links to sibling landing pages. 99 of the 107 pages carry
      them, so they are the family's internal linking — dropping them in the new
      body would strip internal links from almost every landing page. */
  relatedLinks?: { title: string; href: string }[];
  /** The current page's own relative path (e.g. "/en/off-plan-properties-in-paphos"),
      needed to build real, crawlable ?page=N hrefs. Only read when the projects
      block actually has pagination enabled (totalPages > 1) -- every other
      caller can omit it, same as the deleted LandingProjectsBlockComponent's
      pagePath prop worked. */
  pagePath?: string;
}) {
  const blocks: any[] = Array.isArray(page.contentBlocks) ? page.contentBlocks : [];
  const intro = blocks.find((b) => b?._type === "landingIntroBlock");
  const faq = blocks.find((b) => b?._type === "landingFaqBlock");
  const projectsBlock = blocks.find((b) => b?._type === "landingProjectsBlock");
  const snapshot = blocks.find((b) => b?._type === "offPlanSnapshotBlock");
  const texts = blocks.filter((b) => LANDING_TEXT.has(b?._type));

  const s = projectsStrings(lang);

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

  // totalPages is only ever set by resolveBlocks when pagesEnabled is true on
  // this block; every other landingProjectsBlock leaves it undefined, so
  // isPaginated is false for all of them exactly as before this change.
  const totalPages: number | undefined = projectsBlock?.totalPages;
  const currentPage: number = projectsBlock?.currentPage ?? 1;
  const isPaginated = !!totalPages && totalPages > 1 && !!pagePath;
  // Page 1 always points at the bare path with no query string, so the
  // canonical/no-query URL is never one click away from itself with a stray
  // "?page=1".
  const hrefFor = (n: number) => `${pagePath}${n > 1 ? `?page=${n}` : ""}`;

  return (
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
              {isPaginated && (
                <nav className={pagerStyles.pager} aria-label="Results pagination">
                  {currentPage > 1 ? (
                    <Link href={hrefFor(currentPage - 1)} className={pagerStyles.pagerLink} aria-label="Previous">‹</Link>
                  ) : (
                    <span className={`${pagerStyles.pagerLink} ${pagerStyles.pagerLinkDisabled}`} aria-hidden="true">‹</span>
                  )}
                  {pageWindow(currentPage, totalPages!).map((it, i) =>
                    it === "…" ? (
                      <span key={`gap-${i}`} className={pagerStyles.pagerGap} aria-hidden="true">…</span>
                    ) : (
                      <Link
                        key={it}
                        href={hrefFor(it)}
                        className={it === currentPage ? `${pagerStyles.pagerLink} ${pagerStyles.pagerLinkActive}` : pagerStyles.pagerLink}
                        aria-current={it === currentPage ? "page" : undefined}
                      >
                        {it}
                      </Link>
                    ),
                  )}
                  {currentPage < totalPages! ? (
                    <Link href={hrefFor(currentPage + 1)} className={pagerStyles.pagerLink} aria-label="Next">›</Link>
                  ) : (
                    <span className={`${pagerStyles.pagerLink} ${pagerStyles.pagerLinkDisabled}`} aria-hidden="true">›</span>
                  )}
                </nav>
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
        {(faqItems.length > 0 || relatedLinks.length > 0) && (
          <div className="section is-light">
            {faqItems.length > 0 && (
              <div className="pl__wrap">
                {faq.title && <h2 className="pl__h2">{faq.title}</h2>}
                <FaqAccordion items={faqItems} />
              </div>
            )}
            {/* Rendered here rather than through SectionLinks: that component
                carries its own SCSS module from the old design and stood out
                against everything around it. The headings are imported from it
                so the wording stays in one place. */}
            {relatedLinks.length > 0 && (
              <div className="pl__wrap pl-links">
                <h2 className="pl__h2">{HEADINGS.related?.[lang] ?? HEADINGS.related.en}</h2>
                <ul className="pl-links__list">
                  {relatedLinks.map((l) => (
                    <li key={l.href}>
                      <a className="pl-links__item" href={l.href}>{l.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
  );
}
