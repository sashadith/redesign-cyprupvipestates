import type { Metadata } from "next";
import { LuEuro, LuMapPin, LuHouse, LuClock } from "react-icons/lu";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { staticAlternates, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "@/lib/seo";
import type { Translation } from "@/types/homepage";
import Nav from "../../preview-home/sections/Nav";
import Footer from "../../preview-home/sections/Footer";
import Form from "../../preview-home/sections/Form";
import LightHeroFlag from "../../preview-insights/LightHeroFlag";
import CaseStudiesMotion from "./CaseStudiesMotion";
import CaseStudiesSeo from "./CaseStudiesSeo";
import { urlFor } from "@/sanity/sanity.client";
import {
  getCaseStudiesByLangWithDetails,
  getTotalCaseStudiesByLang,
  getCaseStudiesPageByLang,
} from "@/sanity/sanity.utils";
import { CASE_CATEGORY_LABELS } from "../../preview-home/sections/homeI18n";
import { caseStudiesCopy } from "./copy";

/* Cyprus VIP Estates — Case Studies, redesigned. See ../[lang]/layout.tsx for
   why this lives outside src/app/[lang] despite having its own [lang] segment.
   Header + hero deliberately reuse Insights' OWN .ins__hero/.ins__device
   markup and CSS verbatim (see layout.tsx import), not a re-approximation —
   this was an explicit requirement.

   Design departs from a filterable grid (right for Insights' 100+ posts or
   the FAQ's 60 questions) because there are only 3 published case studies
   today — a filter/search UI would be mostly empty chrome. Instead each case
   study is a full-width "magazine feature" block, alternating image side,
   surfacing the client-overview facts (budget/location/property/timeline)
   directly on the index. */

const PLACEHOLDER = "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

type Props = { params: { lang: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = caseStudiesCopy(params.lang);
  const { canonical, languages } = staticAlternates(params.lang, "case-studies");
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function CaseStudiesPage({ params }: Props) {
  const { lang } = params;
  const t = caseStudiesCopy(lang);
  const total = await getTotalCaseStudiesByLang(lang);
  const stories = await getCaseStudiesByLangWithDetails(lang);
  const pageDoc = await getCaseStudiesPageByLang(lang);
  const labels = CASE_CATEGORY_LABELS[lang] ?? CASE_CATEGORY_LABELS.en;

  const featured = stories[0];
  const featuredImg = featured ? safeUrl(featured.previewImage) || PLACEHOLDER : PLACEHOLDER;

  // Fixed path present in every locale — same page exists for en/de/pl/ru.
  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: localizedHref(l.id, "case-studies"),
  }));

  return (
    <>
      <LightHeroFlag />
      <CaseStudiesMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />
      <main className="ins csp">
        <header className="ins__hero is-light">
          <div className="wrap ins__hero-grid">
            <div className="ins__hero-text">
              <p className="ins__eyebrow">{t.eyebrow}</p>
              <h1 className="ins__hero-title">
                {t.heroTitlePlain}<span className="it">{t.heroTitleItalic}</span>
              </h1>
              <p className="ins__hero-lead">{t.heroLead}</p>
              <p className="ins__hero-meta">{total === 1 ? `${total} ${t.heroMetaOne}` : t.heroMetaMany(total)}</p>
            </div>

            <div className="ins__hero-art" aria-hidden>
              <div className="ins__device">
                <div className="ins__device-screen">
                  <div className="ins__device-topbar">
                    <span className="ins__device-brand">Cyprus VIP Estates</span>
                    <span className="ins__device-dots"><i /><i /><i /></span>
                  </div>
                  <div className="ins__device-cover" style={{ backgroundImage: `url("${featuredImg}")` }} />
                  <div className="ins__device-content">
                    <span className="ins__device-kicker">{featured ? labels[featured.category] : t.deviceKickerFallback}</span>
                    <p className="ins__device-headline">{featured?.title ?? t.deviceHeadlineFallback}</p>
                    <span className="ins__device-line" />
                    <span className="ins__device-line" />
                    <span className="ins__device-line ins__device-line--short" />
                    <span className="ins__device-read">{t.deviceRead}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="csp__list">
          <div className="wrap csp__stories">
            {stories.map((cs, i) => {
              const img = safeUrl(cs.previewImage) || PLACEHOLDER;
              const current = cs.slug?.[lang]?.current ?? Object.values(cs.slug ?? {})[0]?.current ?? "";
              const overview = cs.clientOverview;
              return (
                <article className={`csstory${i % 2 === 1 ? " csstory--reverse" : ""}`} key={cs._id}>
                  <div className="csstory__media">
                    <img src={img} alt={cs.previewImage?.alt || cs.title} />
                    <span className="cscard__cat">{labels[cs.category]}</span>
                  </div>
                  <div className="csstory__body">
                    <h2 className="csstory__title">{cs.fullTitle || cs.title}</h2>

                    {overview && (
                      <dl className="csstory__stats">
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
                          <div><dt>{t.statProperty}</dt><dd className="csstory__cap">{overview.propertyType}</dd></div>
                        </div>
                        <div className="csstory__stat">
                          <LuClock size={16} />
                          <div><dt>{t.statTimeline}</dt><dd>{overview.purchaseTimeline}</dd></div>
                        </div>
                      </dl>
                    )}

                    <a className="btn btn--primary csstory__cta" href={localizedHref(lang, ["case-studies", current])}>
                      <span>{t.ctaReadFull}</span>
                      <Arrow />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {pageDoc?.content && (
          <CaseStudiesSeo content={pageDoc.content} eyebrow={t.guideEyebrow} title={t.guideTitle} />
        )}
      </main>

      <Form
        lang={lang}
        title={<>{t.formIndexTitlePlain}<span className="it">{t.formIndexTitleItalic}</span> move?</>}
        subtitle={t.formIndexSubtitle}
      />
      <Footer lang={lang} />
    </>
  );
}
