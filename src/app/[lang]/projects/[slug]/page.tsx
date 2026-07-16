import React from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Metadata } from "next";
import { localizedHref } from "@/lib/locale";
import {
  getFormStandardDocumentByLang,
  getNotFoundPageByLang,
  getProjectByLang,
  getProjectSlugs,
  getLegacyProjectRedirect,
  ALL_LOCALES,
} from "@/sanity/sanity.utils";

export const revalidate = 3600;
export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of ALL_LOCALES) {
    for (const slug of await getProjectSlugs(lang)) params.push({ lang, slug });
  }
  return params;
}
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { Translation } from "@/types/homepage";
import PropertyIntro from "@/app/components/PropertyIntro/PropertyIntro";
import PropertyDescription from "@/app/components/PropertyDescription/PropertyDescription";
import dynamic from "next/dynamic";
import PropertyDistances from "@/app/components/PropertyDistances/PropertyDistances";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import { FormStandardDocument } from "@/types/formStandardDocument";
import PropertySlider from "@/app/components/PropertySlider/PropertySlider";
import PropertyFeatures from "@/app/components/PropertyFeatures/PropertyFeatures";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import { ButtonModal } from "@/app/components/ButtonModal/ButtonModal";
import ProjectSlider from "@/app/components/ProjectSlider/ProjectSlider";
const ProjectSameCity = dynamic(() => import("@/app/components/ProjectSameCity/ProjectSameCity"));
import { urlFor } from "@/sanity/sanity.client";
import QualificationForm from "@/app/components/QualificationForm/QualificationForm";
import FullDescriptionBlock from "@/app/components/FullDescriptionBlock/FullDescriptionBlock";
import AccordionContainer from "@/app/components/AccordionContainer/AccordionContainer";
import SchemaMarkup from "@/app/components/SchemaMarkup/SchemaMarkup";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import WhatAppButtonProject from "@/app/components/WhatAppButtonProject/WhatAppButtonProject";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
// Heavy, below-the-fold/modal components — code-split out of the initial bundle.
// ROI modal (recharts) is client-only (opens on click); related-projects slider (Swiper)
// keeps SSR so its internal links stay in the HTML for SEO, but its JS chunk is split.
const ModalRoiCalculator = dynamic(() => import("@/app/components/ModalRoiCalculator/ModalRoiCalculator"), { ssr: false });
import MetaViewContentTracker from "@/app/components/MetaViewContentTracker/MetaViewContentTracker";
import LinkedInConversionTracker from "@/app/components/LinkedInConversionTracker/LinkedInConversionTracker";
import ProjectPdfButton from "@/app/components/ProjectPdfButton/ProjectPdfButton";
import { languageAlternates, pathBuilders } from "@/lib/seo";

type Props = {
  params: { lang: string; slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const data = await getProjectByLang(lang, slug);

  let previewImageUrl: string | undefined = undefined;
  if (data?.previewImage) {
    previewImageUrl = urlFor(data.previewImage).width(1200).url();
  }

  const { canonical, languages } = languageAlternates({
    lang,
    slug,
    pathFor: pathBuilders.project,
    translations: data?._translations,
  });

  return {
    title: data?.seo.metaTitle,
    description: data?.seo.metaDescription,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
      images: previewImageUrl
        ? [
            {
              url: previewImageUrl,
              width: 1200,
              height: 630,
              alt: data?.title,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      images: previewImageUrl ? [previewImageUrl] : [],
    },
  };
}

const ProjectPage = async ({ params }: Props) => {
  const { lang, slug } = params;
  const project = await getProjectByLang(lang, slug);

  if (!project) {
    const redirectTarget = await getLegacyProjectRedirect(lang, slug);
    if (redirectTarget) permanentRedirect(redirectTarget);
    notFound();
  }

  // console.log("faq", project.faq);

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(params.lang);

  const propertyPageTranslationSlugs: {
    [key: string]: { current: string };
  }[] = project?._translations.map((item) => {
    const newItem: { [key: string]: { current: string } } = {};

    for (const key in item.slug) {
      if (key !== "_type") {
        newItem[key] = { current: item.slug[key].current };
      }
    }
    return newItem;
  });

  const translations = i18n.languages.reduce<Translation[]>((acc, lang) => {
    const translationSlug = propertyPageTranslationSlugs
      ?.reduce(
        (acc: string[], slug: { [key: string]: { current: string } }) => {
          const current = slug[lang.id]?.current;
          if (current) {
            acc.push(current);
          }
          return acc;
        },
        [],
      )
      .join(" ");

    return translationSlug
      ? [
          ...acc,
          {
            language: lang.id,
            path: pathBuilders.project(lang.id, translationSlug),
          },
        ]
      : acc;
  }, []);

  const MapWithNoSSR = dynamic(
    () => import("../../../components/PropertyMap/PropertyMap"),
    {
      ssr: false,
    },
  );

  // FAQPage structured data from the project's accordion FAQ (AEO / rich results).
  const ptToPlain = (blocks: any[] = []): string =>
    blocks
      .map((b) =>
        b?.children ? b.children.map((c: any) => c?.text || "").join("") : "",
      )
      .join(" ")
      .trim();
  const faqEntities = (project.faq?.items ?? [])
    .filter((item: any) => item?.question && item?.answer)
    .map((item: any) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: ptToPlain(item.answer),
      },
    }))
    .filter((q: any) => q.acceptedAnswer.text.length > 0);

  return (
    <>
      {project.location && project.previewImage && <SchemaMarkup project={project} />}
      {faqEntities.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqEntities,
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Header params={params} translations={translations} />
      <main>
        <MetaViewContentTracker
          title={project.title}
          projectId={project._id}
          price={project.keyFeatures?.price ?? null}
          city={project.keyFeatures?.city}
          propertyType={project.keyFeatures?.propertyType}
        />
        <LinkedInConversionTracker conversionId={27871513} />
        <PropertyIntro
          title={project.title}
          excerpt={project.excerpt}
          previewImage={project.previewImage}
          videoId={project.videoId}
          videoPreview={project.videoPreview}
          lang={params.lang}
          isSold={project.isSold}
        />
        {Array.isArray(project.images) && project.images.length > 0 && (
          <div className="container">
            <ProjectSlider images={project.images} />
          </div>
        )}
        <div className="container">
          <div className="property-content">
            <div className="property-description">
              <PropertyDescription description={project.description} />
              <div className="property-button">
                <ButtonModal modalType="brochure">
                  {lang === "en"
                    ? "Enquire this amazing project now!"
                    : lang === "de"
                      ? "Fragen Sie dieses erstaunliche Projekt jetzt an!"
                      : lang === "pl"
                        ? "Zapytaj o ten niesamowity projekt teraz!"
                        : lang === "ru"
                          ? "Узнайте об этом проекте!"
                          : "Enquire this amazing project now!"}
                </ButtonModal>
                <WhatAppButtonProject lang={params.lang} />
              </div>
              {(() => {
                const dev = project.developer as any;
                if (!dev?.slug || !dev?.name) return null;
                return (
                  <p className="project-developer" style={{ marginTop: 12, fontSize: 14 }}>
                    {lang === "de" ? "Bauträger" : lang === "ru" ? "Застройщик" : lang === "pl" ? "Deweloper" : "Developer"}:{" "}
                    <Link href={localizedHref(lang, ["developers", dev.slug])} style={{ color: "#bd8948", fontWeight: 500 }}>
                      {dev.name}
                    </Link>
                  </p>
                );
              })()}
            </div>
            <div className="property-features">
              <PropertyFeatures keyFeatures={project.keyFeatures} lang={lang} />
              <div className="property-features-roi-button">
                <ProjectPdfButton lang={lang} slug={slug} />
                <ButtonModal modalType="roiCalculator">
                  {lang === "ru"
                    ? "Рассчитать ROI"
                    : lang === "de"
                      ? "ROI berechnen"
                      : lang === "pl"
                        ? "Oblicz ROI"
                        : "Calculate ROI"}
                </ButtonModal>
              </div>
            </div>
          </div>
        </div>
        <PropertyDistances distances={project.distances} lang={params.lang} />
        {/* <RoiCalculator project={project} lang={params.lang} /> */}
        {project.location && (
          <MapWithNoSSR
            lat={project.location.lat}
            lng={project.location.lng}
            lang={params.lang}
            showPopup={true}
            title={project.title}
            // slug={project.slug?.current}
            city={project.keyFeatures?.city}
            price={project.keyFeatures?.price}
            previewUrl={
              project.previewImage
                ? urlFor(project.previewImage).width(800).height(500).url()
                : undefined
            }
          />
        )}
        <div className="container">
          <QualificationForm lang={lang} projectSlug={slug} projectTitle={project.title} />
        </div>
        <FullDescriptionBlock description={project.fullDescription} />
        {project.faq && (
          <div className="container">
            <div className="property-faq">
              <h2 className="h2-white">
                {lang === "en"
                  ? "FAQ"
                  : lang === "pl"
                    ? "Najczęściej zadawane pytania"
                    : lang === "ru"
                      ? "Часто задаваемые вопросы"
                      : "Häufig gestellte Fragen"}
              </h2>
              <AccordionContainer block={project.faq} />
            </div>
          </div>
        )}
        <WhatsAppButton lang={params.lang} />
      </main>
      <ProjectSameCity
        lang={params.lang}
        city={project.keyFeatures.city}
        currentProjectId={project._id}
      />

      <Footer params={params} />
      <ModalBrochure lang={params.lang} formDocument={formDocument} />
      <ModalRoiCalculator lang={params.lang} project={project} />
    </>
  );
};

export default ProjectPage;
