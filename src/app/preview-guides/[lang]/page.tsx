import type { Metadata } from "next";
import { i18n } from "@/i18n.config";
import { abs, languageAlternates, ogLocale } from "@/lib/seo";
import type { Translation } from "@/types/homepage";
import Header from "@/app/components/Header/Header";
import Footer from "../../preview-home/sections/Footer";
import Form from "../../preview-home/sections/Form";
import { getBlogPostsByLangWithPagination, getFormStandardDocumentByLang, getTotalBlogPostsByLang } from "@/sanity/sanity.utils";
import { prisma } from "@/lib/prisma";
import { urlFor } from "@/sanity/sanity.client";
import { GUIDE_CATEGORY_GROUPS, articleHref, sectionSegments } from "@/lib/articleSections";
import { guidesCountLabel, guidesSectionStrings } from "@/app/[lang]/blog/guidesSectionI18n";
import GuideGet from "@/app/components/GuideCta/GuideGet";
import { GUIDE_IDS, GUIDE_UI, getGuideContent, guideMainArticleSlug, guideTeaser, isGuideLang, type GuideId } from "@/lib/guides/registry";
import { GUIDES_PAGE_SLUG, guidesPagePath, guidesPageTranslations } from "@/lib/guidesPage";
import { localizedHref } from "@/lib/locale";
import { corporatePath } from "@/lib/corporatePageSlugs";
import type { GuideLang } from "@/lib/guides/types";
import { guidesPageCopy } from "../copy";
import { GUIDE_COVERS } from "../covers";
import { GUIDE_FACTS } from "../facts";

/* Cyprus VIP Estates — the free guides page. Same shell as About/Contacts (shared Header and Footer, the design
   system's hero, eyebrow, stripe and button classes); the cards use the same "get this guide" mechanism as the
   in-article offer (GuideGet): the article form revealed in place, then the signed download link. */

type Props = { params: { lang: GuideLang } };

// The page lists every guide article of the language, so it must refresh when one is published or edited
// (the admin and the publish cron also revalidate it on demand).
export const revalidate = 1800;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = params.lang;
  // Not a guide language (a direct hit on /preview-guides/xx): the layout redirects, no metadata to build.
  if (!isGuideLang(lang)) return {};
  // A language with no guide articles yet keeps the page as it was: free PDF guides only.
  const t = guidesPageCopy(lang, (await getTotalBlogPostsByLang(lang, "guides")) > 0);
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
  const ui = GUIDE_UI[lang];
  const form = await getFormStandardDocumentByLang(lang);

  const translations: Translation[] = i18n.languages
    .filter((l) => l.id in GUIDES_PAGE_SLUG)
    .map((l) => ({ language: l.id, path: guidesPagePath(l.id) }));

  // Every published guide article of this language (the guides section, see src/lib/articleSections.ts),
  // grouped by category in the section's own order.
  const articles = (await getBlogPostsByLangWithPagination(lang, 5000, 0, "guides")) as any[];
  const byGroup = new Map<string, any[]>();
  for (const a of articles) {
    const g = a.category?.groupId;
    if (!g) continue;
    byGroup.set(g, [...(byGroup.get(g) ?? []), a]);
  }
  const groups = GUIDE_CATEGORY_GROUPS.filter((g) => byGroup.get(g)?.length).map((g) => ({
    id: g,
    title: byGroup.get(g)![0].category.title as string,
    items: byGroup.get(g)!,
  }));
  const t = guidesPageCopy(lang, articles.length > 0);
  const sec = guidesSectionStrings(lang);
  const imgUrl = (img: unknown) => {
    try {
      return urlFor(img as never).url();
    } catch {
      return undefined;
    }
  };
  // The article each PDF guide is based on may sit in either section; link to where it lives.
  const mainSlugs = GUIDE_IDS.map((id) => guideMainArticleSlug(id, lang)).filter((s): s is string => !!s);
  const mainRows = mainSlugs.length
    ? await prisma.blog.findMany({ where: { language: lang as any, slug: { in: mainSlugs } }, select: { slug: true, category: { select: { translationGroupId: true } } } })
    : [];
  const mainHref = new Map(mainRows.map((r) => [r.slug, articleHref(lang, r.slug, r.category?.translationGroupId)]));

  const cards = GUIDE_IDS.map((id: GuideId) => {
    const teaser = guideTeaser(id, lang);
    const article = guideMainArticleSlug(id, lang);
    return { id, teaser, articleHref: article ? mainHref.get(article) ?? localizedHref(lang, ["blog", article]) : null, cover: GUIDE_COVERS[id][lang], fact: GUIDE_FACTS[id][lang], accent: getGuideContent(id, lang).titleAccent };
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
              <a className="btn btn--glass" href={groups.length ? "#all-guides" : "#guides"}><span>{t.heroCta}</span></a>
              {groups.length > 0 && <a className="btn btn--glass" href="#guides"><span>{t.heroCta2}</span></a>}
            </div>
          </div>
        </section>

        {groups.length > 0 && (
          <section className="section is-light gds__articles" id="all-guides">
            <div className="wrap">
              <p className="gds__eyebrow">{sec.allEyebrow}</p>
              <h2 className="gds__title">{sec.allTitle}</h2>
              <hr className="shimmer gds__stripe" />
              <p className="gds__lead">{sec.allLead}</p>
              <nav className="gds__chips" aria-label={sec.allEyebrow}>
                {groups.map((g) => (
                  <a key={g.id} className="gds__chip" href={`#g-${g.id.slice(0, 8)}`}>{g.title} · {g.items.length}</a>
                ))}
              </nav>
              {groups.map((g) => (
                <div className="gds__group" id={`g-${g.id.slice(0, 8)}`} key={g.id}>
                  <h3 className="gds__group-title">{g.title}<span className="gds__group-count">{guidesCountLabel(lang, g.items.length)}</span></h3>
                  <div className="ins__grid">
                    {g.items.map((a: any) => {
                      const slug = a.slug?.[lang]?.current ?? "";
                      const img = imgUrl(a.previewImage);
                      return (
                        <a className="icard" href={localizedHref(lang, sectionSegments(lang, slug, a.section))} key={a._id}>
                          <div className="icard__media">{img ? <img src={img} alt={a.title} loading="lazy" /> : <div className="icard__ph" />}</div>
                          <div className="icard__body">
                            <h4 className="icard__title">{a.title}</h4>
                            {a.excerpt && <p className="icard__excerpt">{a.excerpt}</p>}
                            {/* No date on a guide card: guides carry no dates. */}
                            <div className="icard__foot">
                              <span className="icard__more">{sec.read}</span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section is-light gds__list" id="guides">
          <div className="wrap">
            <p className="gds__eyebrow">{t.listEyebrow}</p>
            <h2 className="gds__title">{t.listTitle}</h2>
            <hr className="shimmer gds__stripe" />
            <div className="gds__grid">
              {cards.map((c) => (
                <article className="gds__card" key={c.id} data-guide={c.id}>
                  <p className="gds__meta">{ui.eyebrow} · {ui.fileMeta}</p>
                  <h3 className="gds__card-title">{c.teaser.title}</h3>
                  <p className="gds__sub">{c.teaser.subtitle}</p>
                  <p className="gds__fact">{c.fact.before}<b>{c.fact.bold}</b>{c.fact.after}</p>
                  {form ? (
                    <GuideGet id={c.id} ui={ui} title={c.teaser.title} form={form} lang={lang} buttonClass="gds__btn" />
                  ) : (
                    // The form document is missing for this language: a button that opens it would throw on the
                    // client, so offer the contact page instead of a blank page.
                    <a className="gds__btn" href={corporatePath("contacts", lang)}>{t.ctaButton}</a>
                  )}
                  {c.articleHref && <p className="gds__read"><a href={c.articleHref}>{ui.readArticle} →</a></p>}
                  <div className="gds__cover">
                    <img src={c.cover.src} width={c.cover.width} height={c.cover.height} alt={c.teaser.title} loading="lazy" />
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
      </main>

      {/* The standard consultant form, same as the other pages (replaces the old "contact us" block). */}
      <Form lang={lang} />

      <Footer lang={lang} />
    </>
  );
}
