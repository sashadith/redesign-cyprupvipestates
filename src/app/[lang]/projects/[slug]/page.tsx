import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";

import React from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Metadata } from "next";
import { localizedHref } from "@/lib/locale";
import {
  getFormStandardDocumentByLang,
  getNotFoundPageByLang,
  getProjectByLang,
  getLegacyProjectRedirect,
} from "@/sanity/sanity.utils";

// Cutover: this route now serves BOTH systems at one shared path — a published
// Development (new Prisma pipeline) is tried FIRST; a legacy Sanity-origin
// Project (below, unchanged) is the fallback. This is also the collision rule:
// on a slug collision the PUBLISHED entity wins, and checking Development
// first means an ARCHIVED legacy row can never shadow a live Development even
// if their slugs happened to coincide (verified zero live collisions exist at
// cutover time — see the 2026-07-17 SEO-activation commit message).
// force-dynamic (not the legacy route's former revalidate=3600 ISR): the
// Development branch needs always-fresh admin-edit visibility and previously
// ran force-dynamic at its old /preview-project/[slug] address; unifying both
// branches under one dynamic config was simpler and safer than threading
// revalidatePath calls through every Development admin mutation. Legacy pages
// lose build-time SSG as a result — acceptable, DB reads here are cheap and
// every other DB-driven route in this app (the merged listing, presentations,
// the old preview-project route) already runs force-dynamic the same way.
export const dynamic = "force-dynamic";

import ProjectPageBody from "@/app/preview-project/ProjectPageBody";
import DevelopmentSchema from "@/app/components/DevelopmentSchema/DevelopmentSchema";
import { getDbProjectBySlug } from "@/lib/developmentRender";
import { resolveMetaTitle, resolveMetaDescription, NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";
import { abs, staticAlternates, DEFAULT_OG_IMAGE } from "@/lib/seo";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { Translation } from "@/types/homepage";
import PropertyIntro from "@/app/components/PropertyIntro/PropertyIntro";
import PropertyDescription from "@/app/components/PropertyDescription/PropertyDescription";
// Renamed from the default "dynamic" export name — this file also exports the
// route-segment config `dynamic = "force-dynamic"` above, and both live in the
// same module scope.
import nextDynamic from "next/dynamic";
import PropertyDistances from "@/app/components/PropertyDistances/PropertyDistances";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import { FormStandardDocument } from "@/types/formStandardDocument";
import PropertySlider from "@/app/components/PropertySlider/PropertySlider";
import PropertyFeatures from "@/app/components/PropertyFeatures/PropertyFeatures";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import { ButtonModal } from "@/app/components/ButtonModal/ButtonModal";
import ProjectSlider from "@/app/components/ProjectSlider/ProjectSlider";
const ProjectSameCity = nextDynamic(() => import("@/app/components/ProjectSameCity/ProjectSameCity"));
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
const ModalRoiCalculator = nextDynamic(() => import("@/app/components/ModalRoiCalculator/ModalRoiCalculator"), { ssr: false });
import MetaViewContentTracker from "@/app/components/MetaViewContentTracker/MetaViewContentTracker";
import LinkedInConversionTracker from "@/app/components/LinkedInConversionTracker/LinkedInConversionTracker";
import ProjectPdfButton from "@/app/components/ProjectPdfButton/ProjectPdfButton";
import { languageAlternates, pathBuilders } from "@/lib/seo";

type Props = {
  params: { lang: string; slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;

  // Development wins on a slug collision when published — see the dispatch-order
  // comment above the route's `dynamic` export.
  const dev = await getDbProjectBySlug(slug);
  if (dev && dev.publishStatus === "published") {
    const title = resolveMetaTitle(dev, lang, dev.seoOverride);
    const description = resolveMetaDescription(dev, lang, dev.seoOverride);
    const { canonical, languages } = staticAlternates(lang, ["projects", slug]);
    const ogImage = dev.gallery[0] ? abs(dev.gallery[0]) : DEFAULT_OG_IMAGE;
    const canIndex = NEW_PROJECTS_INDEXABLE;
    return {
      title,
      description,
      alternates: { canonical, languages },
      robots: { index: canIndex, follow: canIndex },
      openGraph: {
        title, description, url: canonical, siteName: "Cyprus VIP Estates", locale: lang, type: "website",
        images: [{ url: ogImage, width: 1200, height: 630, alt: dev.publicName }],
      },
      twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
  }

  const data = await getProjectByLang(lang, slug);

  const previewImageUrl = data?.previewImage
    ? urlFor(data.previewImage).width(1200).height(630).url()
    : DEFAULT_OG_IMAGE;

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
      images: [
        {
          url: previewImageUrl,
          width: 1200,
          height: 630,
          alt: data?.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      images: [previewImageUrl],
    },
  };
}

const ProjectPage = async ({ params }: Props) => {
  const { lang, slug } = params;

  const dev = await getDbProjectBySlug(slug);
  if (dev && dev.publishStatus === "published") {
    const { canonical } = staticAlternates(lang, ["projects", slug]);
    const devTranslations: Translation[] = i18n.languages.map((l) => ({
      language: l.id,
      path: localizedHref(l.id, ["projects", slug]),
    }));
    return (
      <>
        <DevelopmentSchema p={dev} lang={lang} canonical={canonical} />
        <ProjectPageBody p={dev} lang={lang} params={params} translations={devTranslations} />
      </>
    );
  }

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

  const MapWithNoSSR = nextDynamic(
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
