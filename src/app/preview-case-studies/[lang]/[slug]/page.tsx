import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { LuEuro, LuMapPin, LuHouse, LuClock } from "react-icons/lu";
import Nav from "../../../preview-home/sections/Nav";
import Footer from "../../../preview-home/sections/Footer";
import Form from "../../../preview-home/sections/Form";
import LightHeroFlag from "../../../preview-insights/LightHeroFlag";
import ReadingProgress from "../../../preview-insights/ReadingProgress";
import InsightsReader from "../../../preview-insights/InsightsReader";
import { renderInsightsBlock, insightsComponents } from "../../../preview-insights/insightsBlocks";
import CaseStudyMotion from "./CaseStudyMotion";
import { urlFor } from "@/sanity/sanity.client";
import { getCaseStudyByLang } from "@/sanity/sanity.utils";
import { CASE_CATEGORY_LABELS } from "../../../preview-home/sections/homeI18n";
import { abs, languageAlternates, pathBuilders, SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { localizedHref } from "@/lib/locale";
import type { Translation } from "@/types/homepage";
import { caseStudiesCopy } from "../copy";

/* Cyprus VIP Estates — Case Study detail, redesigned. See ../layout.tsx for
   why this lives outside src/app/[lang] despite having its own [lang]
   segment. Header/hero reuse Insights' OWN .iart__hero article structure
   verbatim (background image, scrim, kicker back-link, title, same
   ReadingProgress + sticky TOC) — an explicit requirement, matching how the
   Case Studies INDEX already reuses Insights' .ins__hero.

   Departs from the live page's flat stack (intro → overview → 5 stacked
   sections → lessons → related) in two ways, both usability-driven:
   1. The 5-stage narrative (Client Situation → Requirements → Our Solution →
      Selected Property → Result) gets a sticky "The Journey" TOC with
      scroll-spy (InsightsReader, reused as-is) — on the live page a reader
      has no way to jump straight to e.g. "Result" without scrolling past
      four other sections first.
   2. The client-overview facts move out of their own mid-page section and
      into a stat band directly under the hero — the first thing a buyer
      evaluating "is this story like mine?" wants to see, not something
      several scrolls in. */

export const dynamic = "force-dynamic";

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

/* The source content sometimes has an explicit double soft-return ("\n\n")
   at the very start of the paragraph immediately after an inline image —
   @portabletext/react renders each "\n" as its own <br>, so two in a row
   read as an extra blank line directly under the image. This strips exactly
   ONE of those two leading breaks (never anything later in the same
   paragraph, never a paragraph not preceded by an image) so the paragraph
   still starts on its own line, just without the doubled gap. */
function stripDoubleBreakAfterImages(content: any[]): any[] {
  if (!Array.isArray(content)) return content;
  return content.map((node, i) => {
    const prev = content[i - 1];
    if (prev?._type !== "image" || node?._type !== "block" || !Array.isArray(node.children)) return node;
    const children = node.children.map((child: any, ci: number) => {
      if (ci !== 0 || typeof child?.text !== "string" || !child.text.startsWith("\n\n")) return child;
      return { ...child, text: child.text.slice(1) };
    });
    return { ...node, children };
  });
}

type Props = { params: { lang: string; slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cs = await getCaseStudyByLang(params.lang, params.slug);
  if (!cs) return {};
  const { canonical, languages } = languageAlternates({
    lang: params.lang,
    slug: params.slug,
    pathFor: pathBuilders.caseStudy,
    translations: cs._translations,
  });
  const title = cs.seo?.metaTitle || cs.title;
  const description = cs.seo?.metaDescription || cs.excerpt;
  const ogImage = cs.previewImage
    ? abs(urlFor(cs.previewImage).width(1200).height(630).url())
    : DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title, description, url: canonical, siteName: "Cyprus VIP Estates", locale: params.lang, type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: cs.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function CaseStudyDetailPage({ params }: Props) {
  const { lang, slug } = params;
  const cs = await getCaseStudyByLang(lang, slug);
  if (!cs) notFound();

  const t = caseStudiesCopy(lang);
  const labels = CASE_CATEGORY_LABELS[lang] ?? CASE_CATEGORY_LABELS.en;
  const PROPERTY_TYPE_LABELS: Record<string, string> = {
    villa: t.propertyTypeVilla, apartment: t.propertyTypeApartment, penthouse: t.propertyTypePenthouse,
    townhouse: t.propertyTypeTownhouse, plot: t.propertyTypePlot,
  };
  const STAGES = [
    { key: "clientSituation", title: t.stageClientSituation },
    { key: "requirements", title: t.stageClientRequirements },
    { key: "solution", title: t.stageOurSolution },
    { key: "selectedProperty", title: t.stageSelectedProperty },
    { key: "result", title: t.stageResult },
  ] as const;

  const heroUrl = cs.previewImage ? safeUrl(cs.previewImage) : undefined;
  const overview = cs.clientOverview;
  const stages = STAGES.map((s) => ({ ...s, content: (cs.caseDetails as any)?.[s.key] })).filter((s) => s.content?.length);
  const toc = stages.map((s) => ({ id: s.key, text: s.title }));
  const related = (cs.relatedProjects ?? []).slice(0, 3) as any[];
  const mainContent = (cs.mainContent ?? []).map((b: any) =>
    b?._type === "textContent" ? { ...b, content: stripDoubleBreakAfterImages(b.content) } : b,
  );

  // Per-story translations (this specific case study's sibling slugs in other
  // languages), not the fixed per-locale path the index page uses.
  const translations: Translation[] = (cs._translations ?? []).flatMap((tr: any) =>
    Object.entries(tr.slug ?? {}).map(([language, s]: [string, any]) => ({
      language,
      path: localizedHref(language, ["case-studies", s?.current]),
    })),
  );

  const canonical = abs(localizedHref(lang, ["case-studies", slug]));
  const ogImage = heroUrl ? abs(heroUrl) : undefined;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    url: canonical,
    headline: cs.fullTitle || cs.title,
    ...((cs.seo?.metaDescription || cs.excerpt) ? { description: cs.seo?.metaDescription || cs.excerpt } : {}),
    ...(ogImage ? { image: { "@type": "ImageObject", url: ogImage, width: 1200, height: 630 } } : {}),
    ...(cs.category ? { articleSection: labels[cs.category] } : {}),
    author: { "@type": "Organization", name: "Cyprus VIP Estates", url: SITE_URL },
    publisher: {
      "@type": "RealEstateAgent", name: "Cyprus VIP Estates", url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/uploads/files/a4760263e2ce6e46536dbc5ea7dcb55a7b5516c7.png` },
    },
    datePublished: cs.publishedAt,
    dateModified: cs._updatedAt || cs.publishedAt,
    inLanguage: lang,
    isAccessibleForFree: true,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }} />
      <LightHeroFlag />
      <CaseStudyMotion />
      <ReadingProgress />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />
      <main className="iart csd">
        <article>
          <header className={`iart__hero${heroUrl ? " iart__hero--image" : ""}`}>
            {heroUrl && (
              <div className="iart__hero-bg" aria-hidden="true">
                <img src={heroUrl} alt="" />
                <span className="iart__hero-scrim" />
              </div>
            )}
            <div className="wrap iart__hero-inner">
              <p className="iart__kicker">
                <a className="iart__back" href={localizedHref(lang, "case-studies")}>{t.backLink}</a>
                {cs.category && <><span className="iart__sep">/</span><span className="iart__cat">{labels[cs.category]}</span></>}
              </p>
              <h1 className="iart__title csd__title">{cs.fullTitle || cs.title}</h1>
              {cs.excerpt && <p className="csd__hero-excerpt">{cs.excerpt}</p>}
            </div>
          </header>

          {overview && (
            <section className="csd__stats-band">
              <div className="wrap csd__stats-row">
                <div className="csstory__stat">
                  <LuEuro size={16} />
                  <div><dt>{t.statBudget}</dt><dd>{overview.budget}</dd></div>
                </div>
                <div className="csstory__stat">
                  <LuMapPin size={16} />
                  <div><dt>{t.statLocation}</dt><dd>{overview.location}</dd></div>
                </div>
                <div className="csstory__stat">
                  <LuHouse size={16} />
                  <div><dt>{t.statProperty}</dt><dd>{PROPERTY_TYPE_LABELS[overview.propertyType] || overview.propertyType}</dd></div>
                </div>
                <div className="csstory__stat">
                  <LuClock size={16} />
                  <div><dt>{t.statTimeline}</dt><dd>{overview.purchaseTimeline}</dd></div>
                </div>
              </div>
              <p className="wrap csd__privacy">{t.privacyNote}</p>
            </section>
          )}

          <div className="iart__body section is-light">
            <div className="wrap iart__layout">
              <aside className="iart__aside">
                <InsightsReader headings={toc} label={t.journeyLabel} />
              </aside>

              <div className="iart__content">
                {stages.map((s) => (
                  <div className="iart__rich" id={s.key} key={s.key}>
                    <h2 className="iart__h2">{s.title}</h2>
                    <PortableText value={s.content} components={insightsComponents as any} />
                  </div>
                ))}

                {mainContent.map((b: any) => renderInsightsBlock(b))}
              </div>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="iart__related">
            <div className="wrap">
              <h2 className="iart__related-title">{t.relatedTitlePlain}<span className="it">{t.relatedTitleItalic}</span></h2>
              <hr className="shimmer iart__related-stripe" />
              <div className="newlist__grid">
                {related.map((p) => {
                  const img = safeUrl(p.previewImage);
                  const pslug = typeof p.slug === "string" ? p.slug : p.slug?.[lang]?.current ?? (Object.values(p.slug ?? {})[0] as any)?.current ?? "";
                  return (
                    <a className="pcard" href={localizedHref(lang, ["projects", pslug])} key={p._id}>
                      <div className="pcard__media">{img && <img src={img} alt={p.title} loading="lazy" />}</div>
                      <div className="pcard__shade" />
                      {p.isSold && <span className="pcard__sold">{t.soldBadge}</span>}
                      <div className="pcard__body"><h3 className="pcard__title">{p.title}</h3></div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <Form
          lang={lang}
          title={<>{t.formDetailTitlePlain}<span className="it">{t.formDetailTitleItalic}</span></>}
          subtitle={t.formDetailSubtitle}
        />
      </main>
      <Footer lang={lang} />
    </>
  );
}
