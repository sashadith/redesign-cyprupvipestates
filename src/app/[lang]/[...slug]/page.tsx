// app/[lang]/[[...slug]]/page.tsx
import React from "react";
import { notFound, permanentRedirect } from "next/navigation";
import AccordionContainer from "@/app/components/AccordionContainer/AccordionContainer";
import Footer from "@/app/components/Footer/Footer";
import Header from "@/app/components/Header/Header";
import { i18n } from "@/i18n.config";
import {
  getFormStandardDocumentByLang,
  getSinglePageByLang,
  getAllPathsForLang,
  getNotFoundPageByLang,
  getSinglePagePathItems,
  getChildLandingPages,
  getRelatedLandingPages,
} from "@/sanity/sanity.utils";
import {
  AccordionBlock,
  TextContent,
  ContactFullBlock,
  TeamBlock,
  LocationBlock,
  ImageFullBlock,
  DoubleTextBlock,
  ButtonBlock,
  ImageBulletsBlock,
  ReviewsFullBlock,
  ProjectsSectionBlock,
  FaqBlock,
  FormMinimalBlock,
  HowWeWorkBlock,
  BulletsBlock,
  TableBlock,
  LandingIntroBlock,
  LandingTextFirst,
  LandingTextSecond,
  LandingProjectsBlock,
  LandingFaqBlock,
  LandingTextStart,
} from "@/types/blog";
import { FormStandardDocument } from "@/types/formStandardDocument";
import {
  BenefitsBlock as BenefitsBlockType,
  Translation,
} from "@/types/homepage";
import { Singlepage } from "@/types/singlepage";
import { Metadata } from "next";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import TextContentComponent from "@/app/components/TextContentComponent/TextContentComponent";
import PropertyIntro from "@/app/components/PropertyIntro/PropertyIntro";
import ContactFullBlockComponent from "@/app/components/ContactFullBlockComponent/ContactFullBlockComponent";
import TeamBlockComponent from "@/app/components/TeamBlockComponent/TeamBlockComponent";
import LocationBlockComponent from "@/app/components/LocationBlockComponent/LocationBlockComponent";
import ImageFullBlockComponent from "@/app/components/ImageFullBlockComponent/ImageFullBlockComponent";
import DoubleTextBlockComponent from "@/app/components/DoubleTextBlockComponent/DoubleTextBlockComponent";
import ButtonBlockComponent from "@/app/components/ButtonBlockComponent/ButtonBlockComponent";
import ImageBulletsBlockComponent from "@/app/components/ImageBulletsBlockComponent/ImageBulletsBlockComponent";
import BenefitsBlock from "@/app/components/BenefitsBlock/BenefitsBlock";
import ReviewsFullBlockComponent from "@/app/components/ReviewsFullBlockComponent/ReviewsFullBlockComponent";
import { StructuredData } from "@/app/components/StructuredData/StructuredData";
import ProjectsSectionBlockComponent from "@/app/components/ProjectsSectionBlockComponent/ProjectsSectionBlockComponent";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import HowWeWorkBlockComponent from "@/app/components/HowWeWorkBlockComponent/HowWeWorkBlockComponent";
import BulletsBlockComponent from "@/app/components/BulletsBlockComponent/BulletsBlockComponent";
import Breadcrumbs from "@/app/components/Breadcrumbs/Breadcrumbs";
// The landing family renders through the redesigned body, the same split
// /projects/[slug] uses with preview-project/ProjectPageBody: one body, two
// routes, the site's shared chrome around it.
import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-insights/insights.css";
import "@/app/preview-landing/landing.css";
import LandingBody, { isLandingPage } from "@/app/preview-landing/LandingBody";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import TableBlockComponent from "@/app/components/TableBlockComponent/TableBlockComponent";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import SectionLinks from "@/app/components/SectionLinks/SectionLinks";
import { urlFor } from "@/sanity/sanity.client";
import { abs, localizedPath, DEFAULT_OG_IMAGE } from "@/lib/seo";

type Props = {
  params: {
    lang: string;
    slug: string[];
  };
  // Only read for pagination (?page=N) — every other page on this shared
  // dispatcher ignores it, since nothing currently links to it except the
  // pager this change adds, and only on a block with pagesEnabled set.
  searchParams: { page?: string };
};

// Locale suffix appended to <title>/meta description on page 2+, so
// paginated URLs don't carry an identical title to page 1 despite
// self-canonicalizing to their own ?page=N URL (a soft duplicate-content
// signal otherwise). H1 is deliberately left unchanged.
const PAGE_TITLE_SUFFIX: Record<string, (n: number) => string> = {
  en: (n) => ` — Page ${n}`,
  de: (n) => ` — Seite ${n}`,
  pl: (n) => ` — Strona ${n}`,
  ru: (n) => ` — Страница ${n}`,
};

// No ?page= at all -> "default" (render as page 1, no redirect: the bare URL
// already IS page 1's canonical address). An explicit "?page=1" -> redirect,
// so page 1 never has two addresses. Anything that isn't a plain positive
// integer ("abc", "0", "-1", "1.5", "1e2") -> invalid, 404s rather than
// silently coercing to something else. A real "?page=2"+ integer is handled
// once we know the block's actual totalPages (see PageOutOfRangeError).
type RequestedPage =
  | { kind: "default" }
  | { kind: "redirectToCanonical" }
  | { kind: "invalid" }
  | { kind: "page"; page: number };

function parseRequestedPage(raw: string | undefined): RequestedPage {
  if (raw == null) return { kind: "default" };
  if (!/^[1-9]\d*$/.test(raw)) return { kind: "invalid" };
  const n = Number(raw);
  return n === 1 ? { kind: "redirectToCanonical" } : { kind: "page", page: n };
}

// export const dynamicParams = false;
export const revalidate = 60;

/**
 * Собираем все combinations [lang, slug[]] для SSG
 */
export async function generateStaticParams(): Promise<Props["params"][]> {
  const langs = i18n.languages.map((l) => l.id);
  const paths: Props["params"][] = [];

  for (const lang of langs) {
    // получаем у каждого документа current и parent
    const items: { current: string; parent?: string }[] =
      await getSinglePagePathItems(lang);

    // строим вложенные массивы slug
    const map: Record<string, string[]> = {};
    items.forEach(({ current, parent }) => {
      if (!parent) map[current] = [current];
    });
    let added = true;
    while (added) {
      added = false;
      items.forEach(({ current, parent }) => {
        if (parent && map[parent] && !map[current]) {
          map[current] = [...map[parent], current];
          added = true;
        }
      });
    }

    // теперь пушим только:
    // • root-страницы (parent undefined) — slugArr.length === 1
    // • реальные дочерние (slugArr.length > 1)
    Object.values(map).forEach((slugArr) => {
      const last = slugArr[slugArr.length - 1];
      const hadParent = items.find((i) => i.current === last)?.parent;
      if (!hadParent || slugArr.length > 1) {
        paths.push({ lang, slug: slugArr });
      }
    });
  }

  return paths;
}

/**
 * Динамическая SEO-мета
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { lang, slug = [] } = params;
  const current = slug[slug.length - 1] || "";
  const requested = parseRequestedPage(searchParams?.page);
  // Invalid page -> the page component will 404. "?page=1" -> it will
  // redirect. Either way this response's body never ships, so there's
  // nothing worth fetching data for -- return empty metadata without
  // touching the DB.
  if (requested.kind === "invalid" || requested.kind === "redirectToCanonical") {
    return {};
  }
  const requestedPage = requested.kind === "page" ? requested.page : 1;
  // Must match SinglePage's own call below exactly (same three arguments) --
  // getSinglePageByLang is wrapped in React's per-request cache(), so a
  // mismatched page number here vs. there would silently serve one of the
  // two callers the wrong page's data instead of erroring.
  const page = (await getSinglePageByLang(lang, current, requestedPage)) as Singlepage | null;

  if (!page) {
    return {};
  }

  // Self-canonicalizing: page 2+ points at its own ?page=N URL, not back at
  // page 1 -- deliberately not mirroring /projects's pattern of always
  // canonicalizing to the bare path (see the pagination scoping discussion).
  // Harmless no-op for every page that never receives a ?page=2+ request,
  // i.e. every landingProjectsBlock page other than the one with
  // pagesEnabled set, since nothing links to ?page=2+ on them.
  const canonical = abs(localizedPath(lang, slug)) + (requestedPage > 1 ? `?page=${requestedPage}` : "");

  // hreflang for every sibling language. Top-level pages use the leaf slug directly;
  // nested pages resolve the full ancestor path per language via getAllPathsForLang
  // (the same source the language switcher uses), so deep pages get correct alternates.
  const languages: Record<string, string> = { [lang]: canonical };
  const translations = (page as any)?._translations as
    | { slug?: Record<string, { current?: string } | undefined> }[]
    | undefined;
  for (const t of translations ?? []) {
    for (const [l, v] of Object.entries(t.slug ?? {})) {
      const leaf = v?.current;
      if (!l || !leaf || languages[l]) continue;
      if (slug.length === 1) {
        languages[l] = abs(localizedPath(l, [leaf]));
      } else {
        const paths = await getAllPathsForLang(l);
        const match = paths.find((arr) => arr[arr.length - 1] === leaf);
        if (match) languages[l] = abs(localizedPath(l, match));
      }
    }
  }
  languages["x-default"] = languages["en"] ?? canonical;

  // Page-specific OG/Twitter image (was inheriting the generic site-logo default). Use the
  // landing page's own previewImage; fall back to the logo only when the page has none.
  const pageSuffix = requestedPage > 1 ? (PAGE_TITLE_SUFFIX[lang] ?? PAGE_TITLE_SUFFIX.en)(requestedPage) : "";
  const ogTitle = (page?.seo?.metaTitle || page?.title) + pageSuffix;
  // Never emit an empty (or literal "undefined") description: when both the CMS
  // metaDescription and the excerpt are blank, `x || y` collapsed to undefined
  // and `undefined + ""` shipped the string "undefined" — or an empty string,
  // which let Google fall back to the footer disclaimer text in sitelink
  // snippets. Fall through to a per-language brand default instead.
  const FALLBACK_DESC: Record<string, string> = {
    en: "Explore luxury properties, new developments and investment homes for sale across Cyprus with Cyprus VIP Estates.",
    de: "Entdecken Sie Luxusimmobilien, Neubauprojekte und Anlageobjekte in ganz Zypern mit Cyprus VIP Estates.",
    pl: "Odkryj luksusowe nieruchomości, nowe inwestycje i apartamenty inwestycyjne na Cyprze z Cyprus VIP Estates.",
    ru: "Элитная недвижимость, новостройки и инвестиционные объекты на Кипре с Cyprus VIP Estates.",
  };
  const ogDesc = (page?.seo?.metaDescription || page?.excerpt || FALLBACK_DESC[lang] || FALLBACK_DESC.en) + pageSuffix;
  const ogImage = (page as any)?.previewImage
    ? urlFor((page as any).previewImage).width(1200).height(630).url()
    : DEFAULT_OG_IMAGE;

  return {
    title: ogTitle,
    description: ogDesc,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: page?.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDesc,
      images: [ogImage],
    },
  };
}

const portableTextToPlainText = (blocks: any[] = []) => {
  return blocks
    .map((block) => {
      if (!block.children) return "";

      return block.children.map((child: any) => child.text || "").join("");
    })
    .join(" ")
    .trim();
};

const getFaqItemsFromBlocks = (blocks: any[] = []) => {
  return blocks.flatMap((block) => {
    const faq =
      block._type === "accordionBlock"
        ? block
        : block._type === "faqBlock"
          ? block.faq
          : block._type === "landingFaqBlock"
            ? block.faq
            : null;

    if (!faq?.items?.length) return [];

    return faq.items
      .filter((item: any) => item.question && item.answer)
      .map((item: any) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: portableTextToPlainText(item.answer),
        },
      }))
      .filter(
        (item: any) =>
          item.name &&
          item.acceptedAnswer.text &&
          item.acceptedAnswer.text.length > 0,
      );
  });
};

const SinglePage = async ({ params, searchParams }: Props) => {
  const { lang, slug } = params;
  const current = slug[slug.length - 1] || "";
  // Pure function of params, no DB -- computed before any fetch so the
  // ?page=1 redirect below doesn't need to wait on data it'll never render.
  const pagePath = localizedPath(lang, slug);

  const requested = parseRequestedPage(searchParams?.page);
  if (requested.kind === "invalid") {
    notFound();
  }
  if (requested.kind === "redirectToCanonical") {
    // 308, not a literal 301 -- Next's permanentRedirect() issues 308
    // (method-preserving permanent redirect), which browsers, Google, and
    // every other crawler treat as equivalent to 301 for GET requests. The
    // permanent-cacheable semantics you asked for hold either way.
    permanentRedirect(pagePath);
  }
  const requestedPage = requested.kind === "page" ? requested.page : 1;
  // Must match generateMetadata's own call above exactly -- see the comment
  // there on why (React cache() dedup keys on arguments).
  const page = (await getSinglePageByLang(lang, current, requestedPage)) as Singlepage | null;

  if (!page) {
    notFound();
  }

  if (slug.length === 1 && page?.parentPage) {
    notFound();
  }

  // if (!page) {
  //   return <p>Page Not Found</p>;
  // }

  // if (slug.length === 1 && page?.parentPage) {
  //   return <p>Page Not Found</p>;
  // }

  // if (slug.length === 1 && page?.parentPage) {
  //   const notFoundPage = await getNotFoundPageByLang(lang);
  //   return (
  //     <>
  //       <Header params={params} translations={[]} />
  //       <NotFoundPageComponent notFoundPage={notFoundPage} lang={lang} />
  //       <Footer params={params} />
  //     </>
  //   ); // Рендеринг компонента NotFound
  // }

  // const parentSlug = page.parentPage?.slug[lang]?.current;
  // const parentTitle = page.parentPage?.title;

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(lang);

  // Contextual parent -> child links (only present on pages that actually have children).
  const childPages = await getChildLandingPages(lang, (page as any)._id);
  // Editor-curated related landing pages (only present when manually set in the CMS).
  const relatedPages = await getRelatedLandingPages(lang, (page as any).relatedLandingPages);

  const allBlocks = page.contentBlocks || [];
  const faqItems = getFaqItemsFromBlocks(allBlocks);
  const sdBlocks = allBlocks.filter(
    (b): b is ContactFullBlock | TeamBlock | LocationBlock | ReviewsFullBlock =>
      [
        "contactFullBlock",
        "locationBlock",
        "teamBlock",
        "reviewsFullBlock",
      ].includes(b._type),
  );

  // const generateSlug = (slugObj: any, language: string) => {
  //   const cur = slugObj?.[language]?.current;
  //   if (!cur) return "#";
  //   return language === "de"
  //     ? `https://cyprusvipestates.com/${cur}`
  //     : `https://cyprusvipestates.com/${language}/${cur}`;
  // };

  // const url = generateSlug({ [lang]: { current } }, lang);
  const url = abs(localizedPath(lang, slug));
  const structuredDataProps = {
    slug: current,
    lang,
    metaTitle: page.seo.metaTitle,
    metaDescription: page.seo.metaDescription,
    url,
    image: (page as any).previewImage ? abs(urlFor((page as any).previewImage).url()) : undefined,
    blocks: sdBlocks,
  };

  // Правильный маппинг переводов без ошибки TS
  const translations: Translation[] = [];
  for (const { id: code } of i18n.languages) {
    if (code === lang) continue; // пропускаем текущий язык

    // находим перевод слуга текущей страницы
    const childSlug = page._translations.find((t) => Boolean(t.slug[code]))
      ?.slug[code].current;
    if (!childSlug) continue;

    // получаем все пути для этого языка
    const allPaths = await getAllPathsForLang(code);
    // ищем путь, у которого последний сегмент === childSlug
    const match = allPaths.find((arr) => arr[arr.length - 1] === childSlug);
    if (!match) continue;

    translations.push({
      language: code,
      path: localizedPath(code, match),
    });
  }

  const renderContentBlock = (block: any) => {
    switch (block._type) {
      case "textContent":
        return (
          <TextContentComponent key={block._key} block={block as TextContent} />
        );
      case "accordionBlock":
        return (
          <AccordionContainer
            key={block._key}
            block={block as AccordionBlock}
          />
        );
      case "contactFullBlock":
        return (
          <ContactFullBlockComponent
            key={block._key}
            block={block as ContactFullBlock}
            lang={lang}
          />
        );
      case "teamBlock":
        return (
          <TeamBlockComponent
            key={block._key}
            block={block as TeamBlock}
            lang={lang}
          />
        );
      case "locationBlock":
        return (
          <LocationBlockComponent
            key={block._key}
            block={block as LocationBlock}
            lang={lang}
          />
        );
      case "imageFullBlock":
        return (
          <ImageFullBlockComponent
            key={block._key}
            block={block as ImageFullBlock}
          />
        );
      case "doubleTextBlock":
        return (
          <DoubleTextBlockComponent
            key={block._key}
            block={block as DoubleTextBlock}
          />
        );
      case "buttonBlock":
        return (
          <ButtonBlockComponent key={block._key} block={block as ButtonBlock} />
        );
      case "imageBulletsBlock":
        return (
          <ImageBulletsBlockComponent
            key={block._key}
            block={block as ImageBulletsBlock}
          />
        );
      case "benefitsBlock":
        return (
          <BenefitsBlock
            key={block._key}
            benefitsBlock={block as BenefitsBlockType}
          />
        );
      case "reviewsFullBlock":
        return (
          <ReviewsFullBlockComponent
            key={block._key}
            block={block as ReviewsFullBlock}
            lang={lang}
          />
        );
      case "projectsSectionBlock": {
        const b = block as ProjectsSectionBlock;
        // Если поле projects отсутствует или null — считаем его пустым массивом
        const manual = Array.isArray(b.projects) ? b.projects : [];
        const filtered = Array.isArray(b.filteredProjects) ? b.filteredProjects : [];
        // Phase 2 (2026-07-20): once a page opts into filterCity/filterPropertyType,
        // the live city+type query is authoritative and `projects` becomes a pure
        // fallback for when the live result set is too thin to be worth showing
        // (MIN_LIVE_RESULTS) — not a permanent override. Pages with no filter set
        // keep the original manual-array-first behavior untouched.
        const MIN_LIVE_RESULTS = 6;
        const usingFiltered = !!(b.filterCity || b.filterPropertyType) && filtered.length >= MIN_LIVE_RESULTS;
        const projectsToShow = (b.filterCity || b.filterPropertyType)
          ? (filtered.length >= MIN_LIVE_RESULTS ? filtered : manual)
          : (manual.length > 0 ? manual : filtered);

        return (
          <ProjectsSectionBlockComponent
            key={b._key}
            block={{
              _key: b._key,
              _type: b._type,
              title: b.title,
              projects: projectsToShow,
              marginTop: b.marginTop,
              marginBottom: b.marginBottom,
              paginate: usingFiltered,
            }}
            lang={lang}
          />
        );
      }
      case "faqBlock":
        return (
          <div className="container" key={block._key}>
            <AccordionContainer block={(block as FaqBlock).faq} />
          </div>
        );
      case "formMinimalBlock":
        return (
          <FormMinimalBlockComponent
            key={(block as FormMinimalBlock)._key}
            form={(block as FormMinimalBlock).form}
            lang={lang}
            offerButtonCustomText={(block as FormMinimalBlock).buttonText}
          />
        );
      case "howWeWorkBlock":
        return (
          <HowWeWorkBlockComponent
            key={block._key}
            block={block as HowWeWorkBlock}
            lang={lang}
          />
        );
      case "bulletsBlock":
        return (
          <BulletsBlockComponent
            key={block._key}
            block={block as BulletsBlock}
            lang={lang}
          />
        );
      case "tableBlock":
        return (
          <TableBlockComponent key={block._key} block={block as TableBlock} />
        );
      // landingIntroBlock, landingTextStart/First/Second and landingProjectsBlock
      // are no longer rendered here. Any page built only from the landing family
      // is served by LandingBody instead (see the branch below the block map),
      // and the components that used to render them here were deleted with this
      // change — nothing on the site reached them any more.
      //
      // The consequence, stated plainly: a page that mixes a landing block with
      // classic ones stays on this renderer and now drops that landing block,
      // the same as any unknown type. No published page does today — the only
      // landing block left on this path is landingFaqBlock, handled below.
      case "landingFaqBlock":
        return (
          <section className="singlepage-faq-block" key={block._key}>
            <div className="container-short">
              <h2 className="singlepage-h2">{block.title}</h2>
              <AccordionContainer block={(block as LandingFaqBlock).faq} />
            </div>
          </section>
        );
      default:
        // Render nothing. This used to emit the literal string "Unsupported
        // block type" into the page — developer diagnostics shown to visitors,
        // live on the three off-plan pages for as long as their
        // offPlanSnapshotBlock had no component. An unknown block is a content
        // gap, not something a reader should be told about.
        return null;
    }
  };

  return (
    <>
      <Header params={params} translations={translations} />
      <StructuredData {...structuredDataProps} />
      {faqItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems,
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {isLandingPage(allBlocks) ? (
        /* Landing family — 105 pages built from one block sequence. The
           breadcrumb and intro below are skipped deliberately: the redesigned
           hero carries the title and none of these pages has a parent, so the
           trail would be a single self-link. The related-page links are kept,
           and passed through. */
        <LandingBody page={page} lang={lang} relatedLinks={relatedPages} />
      ) : (
      <main>
        {page.previewImage && page.allowIntroBlock && (
          <>
            <PropertyIntro
              title={page.title}
              previewImage={page.previewImage}
              excerpt={page.excerpt}
              lang={lang}
              isSold={false}
            />
            <Breadcrumbs
              lang={lang}
              segments={params.slug}
              currentTitle={page.title}
            />
          </>
        )}
        {!page.previewImage && !page.allowIntroBlock && (
          <div className="breadcrumbs-mt">
            <Breadcrumbs
              lang={lang}
              segments={params.slug}
              currentTitle={page.title}
            />
          </div>
        )}
        {allBlocks.map(renderContentBlock)}
        <SectionLinks lang={lang} links={childPages} variant="section" />
        <SectionLinks lang={lang} links={relatedPages} variant="related" />
      </main>
      )}
      <Footer params={params} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={params.lang} />
    </>
  );
};

export default SinglePage;
