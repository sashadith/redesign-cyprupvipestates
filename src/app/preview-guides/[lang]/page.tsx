import type { Metadata } from "next";
import { i18n } from "@/i18n.config";
import { abs, languageAlternates, ogLocale } from "@/lib/seo";
import type { Translation } from "@/types/homepage";
import Header from "@/app/components/Header/Header";
import Footer from "../../preview-home/sections/Footer";
import { getFormStandardDocumentByLang } from "@/sanity/sanity.utils";
import GuideGet from "@/app/components/GuideCta/GuideGet";
import { GUIDE_IDS, GUIDE_UI, getGuideContent, guideMainArticleSlug, guideTeaser, isGuideLang, type GuideId } from "@/lib/guides/registry";
import { GUIDES_PAGE_SLUG, guidesPagePath, guidesPageTranslations } from "@/lib/guidesPage";
import { localizedHref } from "@/lib/locale";
import { corporatePath } from "@/lib/corporatePageSlugs";
import type { GuideLang } from "@/lib/guides/types";
import { guidesPageCopy } from "../copy";
import { GUIDE_COVERS } from "../covers";

/* Cyprus VIP Estates — the free guides page. Same shell as About/Contacts (shared Header and Footer, the design
   system's hero, eyebrow, stripe and button classes); the cards use the same "get this guide" mechanism as the
   in-article offer (GuideGet): the article form revealed in place, then the signed download link. */

type Props = { params: { lang: GuideLang } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = params.lang;
  // Not a guide language (a direct hit on /preview-guides/xx): the layout redirects, no metadata to build.
  if (!isGuideLang(lang)) return {};
  const t = guidesPageCopy(lang);
  const { canonical, languages } = languageAlternates({
    lang,
    slug: GUIDES_PAGE_SLUG[lang],
    pathFor: (lg, slug) => (lg === "en" ? `/${slug}` : `/${lg}/${slug}`),
    translations: guidesPageTranslations(),
  });
  const ogImage = abs(GUIDE_COVERS["cost-of-buying"][lang].src);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: ogLocale(lang),
      type: "website",
      images: [{ url: ogImage }],
    },
    twitter: { card: "summary_large_image", title: t.metaTitle, description: t.metaDescription, images: [ogImage] },
  };
}

export default async function GuidesPage({ params }: Props) {
  const { lang } = params;
  const t = guidesPageCopy(lang);
  const ui = GUIDE_UI[lang];
  const form = await getFormStandardDocumentByLang(lang);

  const translations: Translation[] = i18n.languages
    .filter((l) => l.id in GUIDES_PAGE_SLUG)
    .map((l) => ({ language: l.id, path: guidesPagePath(l.id) }));

  const cards = GUIDE_IDS.map((id: GuideId) => {
    const teaser = guideTeaser(id, lang);
    const article = guideMainArticleSlug(id, lang);
    return { id, teaser, articleHref: article ? localizedHref(lang, ["blog", article]) : null, cover: GUIDE_COVERS[id][lang], accent: getGuideContent(id, lang).titleAccent };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t.metaTitle,
    description: t.metaDescription,
    inLanguage: lang,
    url: abs(guidesPagePath(lang)),
    isPartOf: { "@type": "WebSite", name: "Cyprus VIP Estates", url: abs("/") },
    hasPart: cards.map((c) => ({ "@type": "DigitalDocument", name: c.teaser.title, description: c.teaser.subtitle, encodingFormat: "application/pdf", inLanguage: lang })),
  };

  return (
    <>
      <Header params={{ lang }} translations={translations} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <main className="gds">
        <section className="hero gds__hero">
          <div className="hero__scrim" aria-hidden />
          <div className="hero__inner wrap">
            <h1 className="hero__title">
              <span className="hero__brand">{t.heroEyebrow}</span>
              <span className="hero__headline">
                {t.heroTitle[0]}
                <span className="it">{t.heroTitle[1]}</span>
                {t.heroTitle[2]}
              </span>
            </h1>
            <div className="hero__stripe shimmer" aria-hidden />
            <p className="hero__desc">{t.heroLead}</p>
            <div className="hero__cta">
              <a className="btn btn--glass" href="#guides"><span>{t.heroCta}</span></a>
            </div>
          </div>
        </section>

        <section className="section is-light gds__list" id="guides">
          <div className="wrap">
            <p className="gds__eyebrow">{t.listEyebrow}</p>
            <h2 className="gds__title">{t.listTitle}</h2>
            <hr className="shimmer gds__stripe" />
            <div className="gds__grid">
              {cards.map((c) => (
                <article className="gds__card" key={c.id} data-guide={c.id}>
                  <div className="gds__cover">
                    <img src={c.cover.src} width={c.cover.width} height={c.cover.height} alt={c.teaser.title} loading="lazy" />
                  </div>
                  <div className="gds__body">
                    <p className="gds__meta">{ui.eyebrow} · {ui.fileMeta} · {c.teaser.edition}</p>
                    <h3 className="gds__card-title">{c.teaser.title}</h3>
                    <p className="gds__sub">{c.teaser.subtitle}</p>
                    {form ? (
                      <GuideGet
                        id={c.id}
                        ui={ui}
                        form={form}
                        lang={lang}
                        buttonClass="guidecta__btn"
                        closedExtra={
                          <>
                            <p className="gds__label">{ui.insideLabel}</p>
                            <ul className="gds__inside">
                              {c.teaser.inside.map((h) => <li key={h}>{h}</li>)}
                            </ul>
                          </>
                        }
                      />
                    ) : (
                      // The form document is missing for this language: a button that opens it would throw on the
                      // client, so offer the contact page instead of a blank page.
                      <>
                        <p className="gds__label">{ui.insideLabel}</p>
                        <ul className="gds__inside">
                          {c.teaser.inside.map((h) => <li key={h}>{h}</li>)}
                        </ul>
                        <a className="guidecta__btn" href={corporatePath("contacts", lang)}>{t.ctaButton}</a>
                      </>
                    )}
                    {c.articleHref && <p className="gds__read"><a href={c.articleHref}>{ui.readArticle} →</a></p>}
                  </div>
                </article>
              ))}
            </div>
            <p className="gds__note">{t.note}</p>
          </div>
        </section>

        <section className="section gds__steps">
          <div className="wrap">
            <p className="gds__eyebrow">{t.stepsEyebrow}</p>
            <h2 className="gds__title gds__title--dark">{t.stepsTitle}</h2>
            <hr className="shimmer gds__stripe" />
            <ol className="gds__steplist">
              {t.steps.map((s, i) => (
                <li key={s.title} className="gds__step">
                  <span className="gds__stepn" aria-hidden>{i + 1}</span>
                  <div>
                    <h3 className="gds__steptitle">{s.title}</h3>
                    <p className="gds__steptext">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section is-light gds__cta">
          <div className="wrap gds__cta-inner">
            <div>
              <h2 className="gds__title">{t.ctaTitle}</h2>
              <p className="gds__ctatext">{t.ctaText}</p>
            </div>
            <a className="btn btn--primary" href={corporatePath("contacts", lang)}><span>{t.ctaButton}</span></a>
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </>
  );
}
