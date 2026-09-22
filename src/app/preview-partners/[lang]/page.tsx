import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { localizedHref, localesForStaticRoute, UNLOCALIZED_ROUTES } from "@/lib/locale";
import { abs, staticAlternates, ogLocale } from "@/lib/seo";
import type { Translation } from "@/types/homepage";
import type { BenefitsBlock } from "@/types/homepage";
import Nav from "../../preview-home/sections/Nav";
import Footer from "../../preview-home/sections/Footer";
import Benefits from "../../preview-home/sections/Benefits";
import LightHeroFlag from "../../preview-insights/LightHeroFlag";
import HreflangLinks from "../../components/HreflangLinks/HreflangLinks";
import PartnersMotion from "./PartnersMotion";
import PartnersForm from "./PartnersForm";
import PartnersFaq from "./PartnersFaq";
import { partnersCopy } from "./copy";

/* Cyprus VIP Estates — Partners, redesigned. This is now the LIVE /partners
   page (see ./layout.tsx for the indexability fix + why this lives outside
   src/app/[lang] despite having its own [lang] segment). The old hardcoded
   /[lang]/partners page (PartnersHero/Benefits/Cta/Stars/Count/Contact +
   FormPartners/ModalPartners) has been deleted — it was unreachable dead
   code once middleware.ts's rewrite shipped, and is fully superseded by
   this page. generateMetadata below builds canonical via staticAlternates()
   (fixed-path type — /partners is identical across all 4 locales); hreflang
   is rendered SEPARATELY via <HreflangLinks> in the page body below, not
   through generateMetadata's `alternates.languages` field — see that
   component's own file header for why (short version: both that mechanism
   AND a plain JSX `<link hrefLang="...">` render as `hrefLang`, the DOM-IDL
   casing, not the HTML5 spec's lowercase `hreflang` attribute name — harmless
   for real browsers/Google/Bing, which are case-insensitive here, but
   <HreflangLinks> sidesteps it anyway as cheap insurance for simpler
   text-matching tools). Same component to reuse if this is ever rolled out
   to other routes.

   REUSED, not reinvented (see partners.css header for the full breakdown):
     - Hero: Home's OWN .hero/.hero__media/.hero__scrim/.hero__inner/
       .hero__title/.hero__brand/.hero__headline/.hero__stripe/.hero__desc/
       .hero__cta, verbatim, with the page's existing photo as the
       background image (Home's own pattern, just a still image instead of
       video). This is the right reference for a conversion/landing page —
       not the FAQ/Insights/Case-Studies .ins__hero, which is a lighter,
       two-column "content index" pattern built around a device mockup.
     - Stats band: the REAL Benefits.tsx component (imported directly, not
       re-implemented) fed the existing 195/10/360°/100% facts as a
       BenefitsBlock — same layout/counter-animation/typography as the
       homepage's own stats band.
     - "Benefits of partnering" cards: Insights' .ins__topics/.ins__topic
       glass-card pattern (numbered, hover-lift) verbatim.
     - "Who we work with": the homepage's .about__medallion icon-badge
       pattern verbatim, gold star icon preserved from the live page.
     - "How it works" (new — see copy.ts): the one section with no direct
       existing analog, an editorial numbered sequence rather than a third
       card grid, for real compositional variation between sections.
     - Form: same as before — a dedicated PartnersForm.tsx (not the shared
       preview-home Form.tsx) because the live FormPartners.tsx posts to
       /api/email with a required `country` field and a PARTNER-sourced CRM
       lead, while Form.tsx posts to /api/monday and has no country field.
       Styled with the shared .formsec__* classes every other redesigned
       page's form already uses. */

type Props = { params: { lang: string } };

// Decision J (spec §4.4/§8): Partners stays English-only — it is not one of
// the pages that got translated, so a Hebrew URL for it would serve English
// copy (PARTNERS_COPY.he below is a straight `en` alias, not a translation).
// UNLOCALIZED_ROUTES (lib/locale.ts) is the single source of truth this
// checks against — staticAlternates()/the sitemap already exclude `he` for
// "partners" there; this is the matching runtime guard so the URL itself
// 404s instead of rendering.
function partnersOfferedIn(lang: string): boolean {
  return !(UNLOCALIZED_ROUTES.partners as readonly string[]).includes(lang);
}

const HERO_IMAGE = "/uploads/files/b2b577b92f5d66696f53125853d50ba3784f912d.webp";
// Same consultant photo/name/title every other redesigned page's form uses
// (src/app/preview-home/sections/Form.tsx) — reused verbatim, not a new asset.
const CONSULTANT_IMAGE = "/uploads/files/50b0d355d8507f9aadbe785a65e8a7233dd8f2e6.png";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!partnersOfferedIn(params.lang)) notFound();
  const t = partnersCopy(params.lang);
  const { canonical } = staticAlternates(params.lang, "partners");
  const ogImage = abs(HERO_IMAGE);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    // `languages` deliberately NOT passed here — see the file-header comment
    // above. Rendered instead via <HreflangLinks> in the page body.
    alternates: { canonical },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: ogLocale(params.lang),
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      images: [ogImage],
    },
  };
}

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Star = () => (
  <svg className="pnr__type-star" viewBox="0 0 86 82" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M42.7975 0L52.9007 31.0942H85.5951L59.1447 50.3115L69.2479 81.4058L42.7975 62.1885L16.3472 81.4058L26.4503 50.3115L0 31.0942H32.6944L42.7975 0Z"
      fill="var(--accent)"
    />
  </svg>
);

export default function PartnersPage({ params }: Props) {
  const { lang } = params;
  if (!partnersOfferedIn(lang)) notFound();
  const t = partnersCopy(lang);
  const { languages } = staticAlternates(lang, "partners");

  // I1 fix: build the switcher straight from localesForStaticRoute
  // ("partners") — the same source that gates the route itself (decision J
  // excludes "he" for "partners") — instead of the full public-locale list
  // the i18n config exposes, so no Hebrew entry is ever offered here once
  // `he` goes public (it would 404, see partnersOfferedIn() above).
  // LangSwitch only needs {language, path} per entry — it derives each
  // display name itself from LANG_LABELS — so no separate lookup is needed.
  const translations: Translation[] = localesForStaticRoute("partners").map((l) => ({
    language: l,
    path: localizedHref(l, "partners"),
  }));

  // Shaped exactly like the homepage's own BenefitsBlock (src/types/homepage.ts)
  // so the REAL Benefits component can render it with zero changes — title is
  // intentionally empty (this page supplies its own eyebrow/heading above the
  // component instead, via the same .pnr__eyebrow/.pnr__title pattern used
  // for every other section) since Benefits.tsx's own title-highlight logic
  // is hardcoded to the word "Cyprus" and isn't reusable for other headings.
  const benefitsBlock: BenefitsBlock = {
    _key: "partners-stats",
    _type: "benefitsBlock",
    title: "",
    benefits: t.stats.map((s, i) => ({
      _key: `stat-${i}`,
      _type: "benefits",
      counting: { _key: `count-${i}`, _type: "counting", conuntNumber: Number(s.number), sign: s.sign ?? "" },
      title: s.title,
      description: s.description,
    })),
  };

  return (
    <>
      <HreflangLinks languages={languages} />
      <PartnersMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />

      <main className="pnr">
        {/* ---------------------------------------------------------- HERO */}
        <section className="hero">
          <div className="hero__media pnr__hero-media">
            <img src={HERO_IMAGE} alt="" />
          </div>
          <div className="hero__scrim" aria-hidden />
          <div className="hero__inner wrap">
            <h1 className="hero__title">
              <span className="hero__brand">{t.heroEyebrow}</span>
              <span className="hero__headline">
                {t.heroTitleStart}<span className="it">{t.heroTitleAccent}</span>{t.heroTitleEnd}
              </span>
            </h1>
            <hr className="shimmer hero__stripe" />
            <p className="hero__desc">{t.heroLead}</p>
            <div className="hero__cta">
              <a className="btn btn--glass" href="#register">
                <span>{t.heroCta}</span>
              </a>
            </div>
            <p className="pnr__hero-note">{t.heroNote}</p>
          </div>
        </section>

        {/* --------------------------------------------------------- STATS */}
        <div className="pnr__stats-section is-light">
          <div className="wrap" style={{ paddingTop: "var(--section-y)" }}>
            <p className="pnr__eyebrow">{t.statsEyebrow}</p>
            <h2 className="pnr__title">
              {t.statsTitleStart}<span className="it">{t.statsTitleAccent}</span>
            </h2>
            <hr className="shimmer pnr__stripe" />
          </div>
          <Benefits block={benefitsBlock} />
        </div>

        {/* ------------------------------------------------------ BENEFITS */}
        <section className="section">
          <div className="wrap">
            <div className="pnr__section-head">
              <p className="pnr__eyebrow">{t.benefitsEyebrow}</p>
              <h2 className="pnr__title">
                {t.benefitsTitleStart}<span className="it">{t.benefitsTitleAccent}</span>{t.benefitsTitleEnd}
              </h2>
              <hr className="shimmer pnr__stripe" />
            </div>
            <div className="ins__topics pnr__benefit-grid">
              {t.benefits.map((b, i) => (
                <article className="ins__topic" key={b.title}>
                  <span className="ins__topic-no">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="ins__topic-title">{b.title}</h3>
                  <div className="ins__topic-body">
                    <p className="ins__guide-p">{b.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- TYPES */}
        <section className="section is-light">
          <div className="wrap">
            <div className="pnr__section-head">
              <p className="pnr__eyebrow">{t.typesEyebrow}</p>
              <h2 className="pnr__title">
                {t.typesTitleStart}<span className="it">{t.typesTitleAccent1}</span>{t.typesTitleMiddle}<span className="it">{t.typesTitleAccent2}</span>
              </h2>
              <hr className="shimmer pnr__stripe" />
            </div>
            <ul className="pnr__type-grid">
              {t.types.map((ty) => (
                <li className="pnr__type" key={ty.title}>
                  <span className="about__medallion"><Star /></span>
                  <h3 className="pnr__type-title">{ty.title}</h3>
                  <p className="pnr__type-desc">{ty.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ HOW */}
        <section className="section">
          <div className="wrap">
            <div className="pnr__section-head">
              <p className="pnr__eyebrow">{t.howEyebrow}</p>
              <h2 className="pnr__title">
                {t.howTitleStart}<span className="it">{t.howTitleAccent}</span>
              </h2>
              <hr className="shimmer pnr__stripe" />
            </div>
            <div className="pnr__step-grid">
              {t.steps.map((s, i) => (
                <div className="pnr__step" key={s.title}>
                  <p className="pnr__step-num">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="pnr__step-title">{s.title}</h3>
                  <p className="pnr__step-desc">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- FAQ */}
        <PartnersFaq
          eyebrow={t.faqEyebrow}
          titleStart={t.faqTitleStart}
          titleAccent={t.faqTitleAccent}
          items={t.faq}
        />

        {/* -------------------------------------------------- FORM / FINAL CTA */}
        <section className="section is-light formsec" id="register">
          <div className="wrap">
            <div className="formsec__grid">
              <div className="formsec__main">
                <div className="formsec__head">
                  <h2 className="formsec__title">
                    {t.formTitleStart}<span className="it">{t.formTitleAccent}</span>{t.formTitleEnd}
                  </h2>
                  <p className="formsec__subtitle">{t.ctaDescription}</p>
                  <hr className="shimmer formsec__stripe" />
                </div>
                <PartnersForm lang={lang} />
              </div>

              <aside className="formsec__aside">
                <div className="formsec__consultant-wrap">
                  <img className="formsec__consultant" src={CONSULTANT_IMAGE} alt="Sascha Dith, CEO Cyprus VIP Estates" />
                </div>
                <div className="formsec__caption">
                  <strong>Sascha Dith</strong>
                  <span>CEO Cyprus VIP Estates</span>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </>
  );
}
