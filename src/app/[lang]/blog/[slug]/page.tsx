// Single Blog Post — migrated to the approved "Cyprus Insights" article design
// (dark hero + light reading body, sticky TOC, reading progress). Keeps the LIVE
// production data, SEO, JSON-LD, ISR/static params, header/footer, forms, CRM and
// multilingual content; only the visual layer is the staging redesign. Design CSS
// (.iart__*) + tokens are imported here so they load on the article route; the
// fonts (Fraunces/Mulish/Playfair) are already global via [lang]/layout.tsx.
import "@/app/preview-home/tokens.css";
import "@/app/preview-insights/insights.css";
// .prj/.prj__* card styles for ProjectsSectionBlockComponent's reuse of the
// /projects listing's own ProjectCard — same stylesheet the listing page and
// the project detail page (for AlternativesBlock) already import; global
// classnames, not CSS Modules, so this is the one place it must be loaded.
import "@/app/preview-projects/projects.css";

import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";

import {
  getBlogPostByLang,
  getFormStandardDocumentByLang,
  getBlogSlugs,
  getArticleFallbackProjects,
  ALL_LOCALES,
} from "@/sanity/sanity.utils";
import { isNewStyleProjectsBlock } from "@/lib/projectsBlockValidation";
import { urlFor } from "@/sanity/sanity.client";
import {
  abs,
  localizedPath,
  SITE_URL,
  languageAlternates,
  pathBuilders,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { Translation } from "@/types/homepage";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { blogStrings } from "../blogI18n";

import { extractToc, renderInsightsBlock } from "@/app/preview-insights/insightsBlocks";
import InsightsReader from "@/app/preview-insights/InsightsReader";
import ReadingProgress from "@/app/preview-insights/ReadingProgress";
import ArticleMotion from "@/app/preview-insights/ArticleMotion";
import Form from "@/app/preview-home/sections/Form";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import SchemaBlogPost from "@/app/components/SchemaBlogPost/SchemaBlogPost";
import SchemaBlogFaq from "@/app/components/SchemaBlogFaq/SchemaBlogFaq";
import LinkedInConversionTracker from "@/app/components/LinkedInConversionTracker/LinkedInConversionTracker";
import ProjectsSectionSlider from "@/app/components/ProjectsSectionSlider/ProjectsSectionSlider";
import ProjectsSectionBlockComponent from "@/app/components/ProjectsSectionBlockComponent/ProjectsSectionBlockComponent";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import BlogVideo from "@/app/components/BlogVideo/BlogVideo";

type Props = { params: { lang: string; slug: string } };

export const revalidate = 3600;
export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of ALL_LOCALES) {
    for (const slug of await getBlogSlugs(lang)) params.push({ lang, slug });
  }
  return params;
}

// SEO — unchanged from production (title/description/canonical/hreflang/OG/twitter).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const data = await getBlogPostByLang(lang, slug);

  const previewImageUrl = data?.previewImage
    ? urlFor(data.previewImage).width(1200).height(630).url()
    : DEFAULT_OG_IMAGE;

  const { canonical: url, languages } = languageAlternates({
    lang,
    slug,
    pathFor: pathBuilders.blog,
    translations: data?._translations,
  });

  return {
    title: data?.seo.metaTitle,
    description: data?.seo.metaDescription,
    alternates: { canonical: url, languages },
    openGraph: {
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      url,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "article",
      images: [{ url: previewImageUrl, width: 1200, height: 630, alt: data?.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      images: [previewImageUrl],
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

const wordCount = (blocks: any[]) => {
  let n = 0;
  for (const b of blocks ?? []) {
    if (b?._type === "textContent" && Array.isArray(b.content)) {
      for (const node of b.content) {
        if (node?._type === "block")
          n += (node.children ?? []).map((c: any) => c?.text ?? "").join(" ").split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return n;
};

const HOME_LABEL: Record<string, string> = { en: "Home", de: "Startseite", pl: "Strona główna", ru: "Главная" };

/* The three cities ProjectsSectionBlock.filterCity actually accepts, with the
   spellings that turn up in this site's four locales — RU and PL slugs are
   transliterated, so "pafos"/"limasol" appear there while the German and English
   copy uses the standard forms. Matched against the article's title and slug
   only; anything else falls through to the unfiltered set. */
const ARTICLE_CITY_TOKENS: Record<"Paphos" | "Limassol" | "Larnaca", string[]> = {
  Paphos: ["paphos", "pafos", "пафос"],
  Limassol: ["limassol", "limasol", "лимассол"],
  Larnaca: ["larnaca", "larnaka", "ларнака"],
};
/* Below this a city-filtered set reads as an accident rather than a selection,
   so the unfiltered recommended set is used instead. */
const FALLBACK_MIN = 3;
/* A live city/type query returning fewer than this renders nothing — see the
   guard in renderArticleBlock. Module-level so that guard and the
   does-this-article-already-route check below cannot drift apart. */
const MIN_BLOCK_RESULTS = 3;

/* Whether a Projects block will actually put cards on the page. Mirrors both
   guards in renderArticleBlock. Needed because "the article has a block" is not
   the same as "the article routes anywhere": /blog/paphos-vs-limassol-… carries
   a block with an empty title, no pins, no criteria and no results, which
   renders null — and that article is precisely the kind the fallback exists for,
   so testing for the block's mere presence would have skipped it. */
const projectsBlockRenders = (b: any): boolean => {
  if (b?._type !== "projectsSectionBlock") return false;
  const filtered = Array.isArray(b.filteredProjects) ? b.filteredProjects : [];
  if (isNewStyleProjectsBlock(b)) {
    if (!filtered.length) return false;
    return !(b._hasLiveCriteria && filtered.length < MIN_BLOCK_RESULTS);
  }
  const manual = Array.isArray(b.projects) ? b.projects : [];
  return manual.length > 0 || filtered.length > 0;
};

const PagePost = async ({ params }: Props) => {
  const { lang, slug } = params;
  const blog = await getBlogPostByLang(lang, slug);
  if (!blog) notFound();

  const t = blogStrings(lang);
  const formDocument: FormStandardDocument = await getFormStandardDocumentByLang(lang);

  const fmtDate = (d?: unknown) => {
    if (!d) return "";
    const dt = new Date(d as string);
    return isNaN(dt.getTime())
      ? ""
      : dt.toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" });
  };

  const toc = extractToc(blog.contentBlocks as any[]);
  const minutes = Math.max(1, Math.round(wordCount(blog.contentBlocks as any[]) / 200));
  const heroUrl = safeUrl(blog.previewImage);
  const author = blog.author as any;
  const authorUrl = safeUrl(author?.image);
  const related = (blog.relatedArticles ?? []) as any[];
  const contentBlocks = (blog.contentBlocks ?? []) as any[];

  // An article with no Projects block of its own gets one appended, so every
  // post offers the same step onward into a property. Editor-placed blocks
  // always win — this only fills the gap, and never adds a second block to an
  // article that already has one.
  //
  // City is read from the article's own title and slug against the three the
  // projects filter actually supports, rather than guessed: an article about
  // Paphos then lists Paphos properties. Slugs are transliterated in RU/PL, so
  // the local spellings are matched too. No match, or too thin a result, falls
  // back to the unfiltered recommended set rather than showing a near-empty row.
  const hasProjectsBlock = contentBlocks.some(projectsBlockRenders);
  const cityHit = hasProjectsBlock
    ? null
    : (["Paphos", "Limassol", "Larnaca"] as const).find((city) =>
        ARTICLE_CITY_TOKENS[city].some((token) =>
          `${blog.title ?? ""} ${slug}`.toLowerCase().includes(token),
        ),
      ) ?? null;
  const fallbackProjects = hasProjectsBlock
    ? []
    : await (async () => {
        const withCity = cityHit ? await getArticleFallbackProjects(lang, cityHit) : [];
        return withCity.length >= FALLBACK_MIN ? withCity : getArticleFallbackProjects(lang);
      })();
  const fallbackHeading = cityHit
    ? t.fallbackPropertiesInCity.replace("{city}", cityHit)
    : t.fallbackProperties;

  // Language-switcher translations (same logic as production).
  const translationSlugs = blog?._translations
    ?.filter((item: any) => item && item.slug)
    .map((item: any) => {
      const out: { [k: string]: { current: string } } = {};
      for (const key in item.slug) if (key !== "_type" && item.slug[key]) out[key] = { current: item.slug[key].current };
      return out;
    }) || [];
  const translations = i18n.languages.reduce<Translation[]>((acc, l) => {
    const s = translationSlugs
      ?.reduce((a: string[], sl: any) => {
        const cur = sl[l.id]?.current;
        if (cur) a.push(cur);
        return a;
      }, [])
      .join(" ");
    return s ? [...acc, { language: l.id, path: localizedHref(l.id, ["blog", s]) }] : acc;
  }, []);

  // Breadcrumb structured data (preserves the SEO the old BreadcrumbsBlog carried).
  const canonical = abs(localizedPath(lang, ["blog", slug]));
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: HOME_LABEL[lang] ?? HOME_LABEL.en, item: abs(localizedPath(lang, [])) },
      { "@type": "ListItem", position: 2, name: "Blog", item: abs(localizedPath(lang, ["blog"])) },
      { "@type": "ListItem", position: 3, name: blog.title, item: canonical },
    ],
  };

  // The staging reading view styles text/table/faq/image/double/accordion blocks
  // with the .iart__ design (via renderInsightsBlock). Production posts also use
  // projectsSectionBlock (68) and formMinimalBlock (29) — these are preserved via
  // the existing production components so no article content is dropped.
  const renderArticleBlock = (block: any) => {
    switch (block?._type) {
      case "projectsSectionBlock": {
        const b = block;
        // Admin-insertable "Projects" block (2026-07-24): any of these fields
        // present marks a block built via the new criteria+pin/exclude picker
        // — pre-existing Sanity-migrated posts never have them, so this can't
        // change how any already-published article renders. Shared with the
        // publish-time gate (src/lib/projectsBlockValidation.ts) so the two
        // definitions of "new-style" can never drift apart.
        if (isNewStyleProjectsBlock(b)) {
          const results = Array.isArray(b.filteredProjects) ? b.filteredProjects : [];
          if (!results.length) return null;
          // Empty/thin guard only applies to a live city/type/price query — a
          // hand-picked selection of 1-2 projects (no criteria) is a
          // deliberate editorial choice and always renders (2026-07-22 bug:
          // a real published article's hand-picked pins rendered nothing
          // because this guard treated the pick like a weak auto-query).
          if (b._hasLiveCriteria && results.length < MIN_BLOCK_RESULTS) return null;
          return <ProjectsSectionBlockComponent block={{ ...b, projects: results, paginate: true }} lang={lang} />;
        }
        const manual = Array.isArray(b.projects) ? b.projects : [];
        const projectsToShow = manual.length ? manual : Array.isArray(b.filteredProjects) ? b.filteredProjects : [];
        return <ProjectsSectionSlider block={{ ...b, projects: projectsToShow }} lang={lang} />;
      }
      case "formMinimalBlock":
        return <FormMinimalBlockComponent form={block.form} lang={lang} offerButtonCustomText={block.buttonText} />;
      default:
        return renderInsightsBlock(block);
    }
  };

  const hasVideo = !!(blog.videoBlock && blog.videoBlock.videoId && blog.videoBlock.posterImage);

  return (
    <>
      <Header params={params} translations={translations} />
      <SchemaBlogPost blog={blog} lang={lang} />
      <SchemaBlogFaq blocks={contentBlocks} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }} />
      <ArticleMotion />
      <ReadingProgress />

      <main className="iart">
        <LinkedInConversionTracker conversionId={27871521} />
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
                <a className="iart__back" href={localizedHref(lang, "blog")}>{t.heroTitle}</a>
                {blog.category?.title && (
                  <>
                    <span className="iart__sep">/</span>
                    <span className="iart__cat">{blog.category.title}</span>
                  </>
                )}
              </p>
              <h1 className="iart__title">{blog.title}</h1>
              <div className="iart__meta">
                {author?.name && (
                  <span className="iart__byline">
                    {authorUrl && <img className="iart__byline-img" src={authorUrl} alt={author.name} />}
                    <span className="iart__byline-name">{author.name}</span>
                  </span>
                )}
                <span className="iart__meta-dot">{minutes} {t.minRead}</span>
                {fmtDate(blog.publishedAt) && <span className="iart__meta-dot">{fmtDate(blog.publishedAt)}</span>}
              </div>
            </div>
          </header>

          <div className="iart__body section is-light">
            <div className="wrap iart__layout">
              <aside className="iart__aside">
                <InsightsReader headings={toc} label={t.tocLabel} />
              </aside>

              <div className="iart__content">
                {hasVideo && (
                  <div className="iart__figure">
                    <BlogVideo videoId={blog.videoBlock.videoId} posterImage={blog.videoBlock.posterImage} title={blog.title} />
                  </div>
                )}
                {contentBlocks.map((b: any) => (
                  <React.Fragment key={b._key}>{renderArticleBlock(b)}</React.Fragment>
                ))}

                {/* Only when the article carries no Projects block of its own —
                    see the resolution above. Rendered through the same component
                    an editor-placed block uses, so it is visually identical. */}
                {fallbackProjects.length > 0 && (
                  <ProjectsSectionBlockComponent
                    block={{
                      _key: "fallback-projects",
                      _type: "projectsSectionBlock",
                      title: fallbackHeading,
                      projects: fallbackProjects,
                    } as any}
                    lang={lang}
                  />
                )}

                {author?.name && (
                  <aside className="iart__author">
                    {authorUrl && <img className="iart__author-img" src={authorUrl} alt={author.name} />}
                    <div className="iart__author-body">
                      <div className="iart__author-meta">
                        <p className="iart__author-label">{t.writtenBy}</p>
                        <p className="iart__author-name">{author.name}</p>
                        {author.position && <p className="iart__author-role">{author.position}</p>}
                      </div>
                      {author.bio && <p className="iart__author-bio">{author.bio}</p>}
                      {author.linkedin && (
                        <a className="iart__author-link" href={author.linkedin} target="_blank" rel="noopener noreferrer">
                          LinkedIn ↗
                        </a>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="iart__related">
            <div className="wrap">
              <h2 className="iart__related-title">
                {t.relatedLead} <span className="it">{t.relatedAccent}</span>
              </h2>
              <hr className="shimmer iart__related-stripe" />
              <div className="ins__grid">
                {related.slice(0, 3).map((a: any) => (
                  <a className="icard" href={a.href || "#"} key={a._id}>
                    <div className="icard__media">
                      {safeUrl(a.previewImage) ? (
                        <img src={safeUrl(a.previewImage)} alt={a.title} loading="lazy" />
                      ) : (
                        <div className="icard__ph" />
                      )}
                      {a.category?.title && <span className="icard__cat">{a.category.title}</span>}
                    </div>
                    <div className="icard__body">
                      <h3 className="icard__title">{a.title}</h3>
                      <div className="icard__foot">
                        <span className="icard__date">{fmtDate(a.publishedAt)}</span>
                        <span className="icard__more">{t.read}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        <Form lang={lang} />
      </main>

      <Footer params={params} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={params.lang} />
    </>
  );
};

export default PagePost;
