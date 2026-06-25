// app/[lang]/[[...slug]]/page.tsx
import React from "react";
import { notFound } from "next/navigation";
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
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import TableBlockComponent from "@/app/components/TableBlockComponent/TableBlockComponent";
import LandingIntroBlockComponent from "@/app/components/LandingPage/LandingIntroBlockComponent/LandingIntroBlockComponent";
import LandingTextFirstComponent from "@/app/components/LandingPage/LandingTextFirstComponent/LandingTextFirstComponent";
import LandingTextSecondComponent from "@/app/components/LandingPage/LandingTextSecondComponent/LandingTextSecondComponent";
import LandingProjectsBlockComponent from "@/app/components/LandingPage/LandingProjectsBlockComponent/LandingProjectsBlockComponent";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import LandingTextStartComponent from "@/app/components/LandingPage/LandingTextStartComponent/LandingTextStartComponent";
import SectionLinks from "@/app/components/SectionLinks/SectionLinks";
import { urlFor } from "@/sanity/sanity.client";
import { abs, localizedPath, DEFAULT_OG_IMAGE } from "@/lib/seo";

type Props = {
  params: {
    lang: string;
    slug: string[];
  };
};

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
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug = [] } = params;
  const current = slug[slug.length - 1] || "";
  const page = (await getSinglePageByLang(lang, current)) as Singlepage | null;

  if (!page) {
    return {};
  }

  const canonical = abs(localizedPath(lang, slug));

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
  const ogTitle = page?.seo?.metaTitle || page?.title;
  const ogDesc = page?.seo?.metaDescription || page?.excerpt;
  const ogImage = (page as any)?.previewImage ? urlFor((page as any).previewImage).url() : DEFAULT_OG_IMAGE;

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

const SinglePage = async ({ params }: Props) => {
  const { lang, slug } = params;
  const current = slug[slug.length - 1] || "";
  const page = (await getSinglePageByLang(lang, current)) as Singlepage | null;

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
        const projectsToShow =
          manual.length > 0
            ? manual
            : Array.isArray(b.filteredProjects)
              ? b.filteredProjects
              : [];

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
      case "landingIntroBlock":
        return (
          <LandingIntroBlockComponent
            key={block._key}
            block={block as LandingIntroBlock}
            lang={lang}
          />
        );
      case "landingTextStart":
        return (
          <LandingTextStartComponent
            key={block._key}
            lang={lang}
            block={block as LandingTextStart}
          />
        );
      case "landingTextFirst":
        return (
          <LandingTextFirstComponent
            key={block._key}
            lang={lang}
            block={block as LandingTextFirst}
          />
        );
      case "landingTextSecond":
        return (
          <LandingTextSecondComponent
            key={block._key}
            lang={lang}
            block={block as LandingTextSecond}
            formDocument={formDocument}
          />
        );
      case "landingProjectsBlock":
        const b = block as LandingProjectsBlock;
        // Если поле projects отсутствует или null — считаем его пустым массивом
        const manual = Array.isArray(b.projects) ? b.projects : [];
        const projectsToShow =
          manual.length > 0
            ? manual
            : Array.isArray(b.filteredProjects)
              ? b.filteredProjects
              : [];

        return (
          <LandingProjectsBlockComponent
            key={b._key}
            block={{
              _key: b._key,
              _type: b._type,
              title: b.title,
              projects: projectsToShow,
            }}
            lang={lang}
          />
        );
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
        return <p key={block._key}>Unsupported block type</p>;
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
      <Footer params={params} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={params.lang} />
    </>
  );
};

export default SinglePage;
