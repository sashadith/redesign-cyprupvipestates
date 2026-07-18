// src/app/[lang]/case-studies/[slug]/page.tsx

import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import PropertyIntro from "@/app/components/PropertyIntro/PropertyIntro";
import Breadcrumbs from "@/app/components/Breadcrumbs/Breadcrumbs";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import TextContentComponent from "@/app/components/TextContentComponent/TextContentComponent";
import DoubleTextBlockComponent from "@/app/components/DoubleTextBlockComponent/DoubleTextBlockComponent";
import ImageFullBlockComponent from "@/app/components/ImageFullBlockComponent/ImageFullBlockComponent";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import ProjectsSectionBlockComponent from "@/app/components/ProjectsSectionBlockComponent/ProjectsSectionBlockComponent";

import {
  getCaseStudyByLang,
  getFormStandardDocumentByLang,
  getCaseStudySlugs,
  ALL_LOCALES,
} from "@/sanity/sanity.utils";

export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of ALL_LOCALES) {
    for (const slug of await getCaseStudySlugs(lang)) params.push({ lang, slug });
  }
  return params;
}

import { i18n } from "@/i18n.config";
import { Translation } from "@/types/homepage";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { CaseStudy } from "@/types/caseStudy";
import {
  TextContent,
  DoubleTextBlock,
  ImageFullBlock,
  FormMinimalBlock,
} from "@/types/blog";
import CaseStudyDetails from "@/app/components/CaseStudyDetails/CaseStudyDetails";
import CaseStudyOverview from "@/app/components/CaseStudyOverview/CaseStudyOverview";
import CaseStudyIntro from "@/app/components/CaseStudyIntro/CaseStudyIntro";
import FormStatic from "@/app/components/FormStatic/FormStatic";
import { languageAlternates, pathBuilders, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  params: {
    lang: string;
    slug: string;
  };
};

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const caseStudy = await getCaseStudyByLang(params.lang, params.slug);

  if (!caseStudy) return {};

  const { canonical, languages } = languageAlternates({
    lang: params.lang,
    slug: params.slug,
    pathFor: pathBuilders.caseStudy,
    translations: caseStudy._translations,
  });

  const ogTitle = caseStudy.seo?.metaTitle || caseStudy.title;
  const ogDesc = caseStudy.seo?.metaDescription || caseStudy.excerpt;
  const ogImage = caseStudy.previewImage
    ? urlFor(caseStudy.previewImage).width(1200).height(630).url()
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
      locale: params.lang,
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: caseStudy.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDesc,
      images: [ogImage],
    },
  };
}

const CaseStudyPage = async ({ params }: Props) => {
  const { lang, slug } = params;

  const caseStudy = (await getCaseStudyByLang(lang, slug)) as CaseStudy | null;

  if (!caseStudy) {
    notFound();
  }

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(lang);

  const translations: Translation[] = [];

  for (const { id: code } of i18n.languages) {
    if (code === lang) continue;

    const translatedSlug = caseStudy._translations?.find((t) =>
      Boolean(t.slug?.[code]),
    )?.slug?.[code]?.current;

    if (!translatedSlug) continue;

    translations.push({
      language: code,
      path: pathBuilders.caseStudy(code, translatedSlug),
    });
  }

  const relatedPropertiesTitle =
    lang === "de"
      ? "Verwandte Immobilien"
      : lang === "ru"
        ? "Похожие объекты"
        : lang === "pl"
          ? "Powiązane nieruchomości"
          : "Related Properties";

  const renderContentBlock = (block: any) => {
    switch (block._type) {
      case "textContent":
        return (
          <TextContentComponent key={block._key} block={block as TextContent} />
        );

      case "doubleTextBlock":
        return (
          <DoubleTextBlockComponent
            key={block._key}
            block={block as DoubleTextBlock}
          />
        );

      case "imageFullBlock":
        return (
          <ImageFullBlockComponent
            key={block._key}
            block={block as ImageFullBlock}
          />
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

      default:
        return null;
    }
  };

  return (
    <>
      <Header params={params} translations={translations} />

      <main>
        {caseStudy.previewImage && (
          <>
            <CaseStudyIntro
              title={caseStudy.fullTitle || caseStudy.title}
              previewImage={caseStudy.previewImage}
              excerpt={caseStudy.excerpt}
              lang={lang}
              isSold={false}
            />

            <Breadcrumbs
              lang={lang}
              segments={["case-studies", slug]}
              currentTitle={caseStudy.title}
            />
          </>
        )}

        {caseStudy.clientOverview && (
          <CaseStudyOverview
            lang={lang}
            clientOverview={caseStudy.clientOverview}
          />
        )}

        {!caseStudy.previewImage && (
          <div className="breadcrumbs-mt">
            <Breadcrumbs
              lang={lang}
              segments={["case-studies", slug]}
              currentTitle={caseStudy.title}
            />
          </div>
        )}

        {caseStudy.caseDetails && (
          <CaseStudyDetails lang={lang} caseDetails={caseStudy.caseDetails} />
        )}

        <div className="mb40">
          <FormStatic lang={params.lang} />
        </div>

        {caseStudy.mainContent?.map(renderContentBlock)}

        <div className="mb50 mt70">
          {caseStudy.relatedProjects?.length ? (
            <ProjectsSectionBlockComponent
              block={{
                _key: "case-study-related-projects",
                _type: "projectsSectionBlock",
                title: relatedPropertiesTitle,
                projects: caseStudy.relatedProjects,
              }}
              lang={lang}
            />
          ) : null}
        </div>
      </main>

      <Footer params={params} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={lang} />
    </>
  );
};

export default CaseStudyPage;
