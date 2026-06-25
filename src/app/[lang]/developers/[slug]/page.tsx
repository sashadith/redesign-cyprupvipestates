import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  getFormStandardDocumentByLang,
  getDeveloperByLang,
  getProjectsByDeveloper,
  getNotFoundPageByLang,
  getDeveloperSlugs,
  ALL_LOCALES,
} from "@/sanity/sanity.utils";

export const revalidate = 3600;
export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];
  for (const lang of ALL_LOCALES) {
    for (const slug of await getDeveloperSlugs(lang)) params.push({ lang, slug });
  }
  return params;
}
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { Translation } from "@/types/homepage";
import dynamic from "next/dynamic";
import PropertyDistances from "@/app/components/PropertyDistances/PropertyDistances";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import { FormStandardDocument } from "@/types/formStandardDocument";
import PropertyFeatures from "@/app/components/PropertyFeatures/PropertyFeatures";
import { ButtonModal } from "@/app/components/ButtonModal/ButtonModal";
import { urlFor } from "@/sanity/sanity.client";
import FormStatic from "@/app/components/FormStatic/FormStatic";
import FullDescriptionBlock from "@/app/components/FullDescriptionBlock/FullDescriptionBlock";
import SchemaMarkup from "@/app/components/SchemaMarkup/SchemaMarkup";
import PropertyDescription from "@/app/components/PropertyDescription/PropertyDescription";
import DeveloperIntro from "@/app/components/DeveloperIntro/DeveloperIntro";
import ProjectLink from "@/app/components/ProjectLink/ProjectLink";
import DeveloperSchemaMarkup from "@/app/components/DeveloperSchemaMarkup/DeveloperSchemaMarkup";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import { abs, localizedPath, languageAlternates } from "@/lib/seo";

type Props = {
  params: { lang: string; slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const data = await getDeveloperByLang(lang, slug);

  let previewImageUrl: string | undefined = undefined;
  if (data?.logo?.asset?._ref) {
    previewImageUrl = urlFor(data.logo).width(1200).url();
  }

  const { canonical, languages } = languageAlternates({
    lang,
    slug,
    pathFor: (l, s) => localizedPath(l, ["developers", s]),
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
      images: previewImageUrl ? [{ url: previewImageUrl }] : [],
    },
  };
}

const DeveloperPage = async ({ params }: Props) => {
  const { lang, slug } = params;
  const developer = await getDeveloperByLang(lang, slug);

  if (!developer) {
    notFound();
  }

  const projects = await getProjectsByDeveloper(lang, developer._id);

  // const pageUrl = `/${lang}/developers/${developer.slug[lang].current}`;

  const pageUrl = abs(localizedPath(lang, ["developers", developer.slug[lang].current]));

  // console.log("projects", projects);

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(params.lang);

  const propertyPageTranslationSlugs: {
    [key: string]: { current: string };
  }[] = developer?._translations.map((item) => {
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
            path: localizedPath(lang.id, ["developers", translationSlug]),
          },
        ]
      : acc;
  }, []);

  return (
    <>
      {/* <SchemaMarkup project={developer} /> */}
      <DeveloperSchemaMarkup developer={developer} pageUrl={pageUrl} />
      <Header params={params} translations={translations} />
      <main>
        <DeveloperIntro
          titleFull={developer.titleFull}
          excerpt={developer.excerpt}
          logo={developer.logo}
        />
        <section className="">
          <div className="container">
            <h2 className="h2-white">
              {lang === "en"
                ? `Projects of developer ${developer.title}`
                : lang === "de"
                  ? `Projekte des Entwicklers ${developer.title}`
                  : lang === "pl"
                    ? `Projekty dewelopera ${developer.title}`
                    : lang === "ru"
                      ? `Проекты застройщика ${developer.title}`
                      : `Projects of developer ${developer.title}`}
            </h2>
            <div className="projectsDeveloper">
              {projects.length ? (
                projects.map((project) => (
                  <div key={project._id}>
                    <ProjectLink
                      url={localizedPath(lang, ["projects", project.slug[lang].current])}
                      previewImage={project.previewImage}
                      title={project.title}
                      price={project.keyFeatures.price}
                      bedrooms={parseFloat(project.keyFeatures.bedrooms)} // Преобразование строки в число
                      coveredArea={parseFloat(project.keyFeatures.coveredArea)} // Преобразование строки в число
                      plotSize={parseFloat(project.keyFeatures.plotSize)} // Преобразование строки в число
                      lang={params.lang}
                      isSold={project.isSold}
                    />
                  </div>
                ))
              ) : (
                <p>
                  {lang === "en"
                    ? "No projects available for this developer."
                    : lang === "de"
                      ? "Keine Projekte für diesen Entwickler verfügbar."
                      : lang === "pl"
                        ? "Brak projektów dostępnych dla tego dewelopera."
                        : lang === "ru"
                          ? "Нет доступных проектов для этого застройщика."
                          : "No projects available for this developer."}
                </p>
              )}
            </div>
          </div>
        </section>
        <FormStatic lang={params.lang} />
        <FullDescriptionBlock description={developer.description} />
        <div className="container">
          <div className="developers-button">
            <ButtonModal>
              {lang === "en"
                ? "Buy property from this developer now!"
                : lang === "de"
                  ? "Kaufen Sie jetzt eine Immobilie von diesem Entwickler!"
                  : lang === "pl"
                    ? "Kup teraz nieruchomość od tego dewelopera!"
                    : lang === "ru"
                      ? "Купите недвижимость у этого застройщика!"
                      : "Buy property from this developer now!"}
            </ButtonModal>
          </div>
        </div>
      </main>
      <Footer params={params} />
      <ModalBrochure lang={params.lang} formDocument={formDocument} />
      <WhatsAppButton lang={params.lang} />
    </>
  );
};

export default DeveloperPage;
