import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";
import "@/app/[lang]/developers/developer-catalog.css";

import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  getFormStandardDocumentByLang,
  getDeveloperByLang,
  getDeveloperCatalogByLang,
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
import DeveloperProjectsGrid, { type DeveloperProjectCardData } from "@/app/[lang]/developers/[slug]/DeveloperProjectsGrid";
import DeveloperSchemaMarkup from "@/app/components/DeveloperSchemaMarkup/DeveloperSchemaMarkup";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import { abs, localizedPath, languageAlternates, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { localizedHref } from "@/lib/locale";
import { resolveCompletionYear } from "@/lib/text";

type Props = {
  params: { lang: string; slug: string };
};

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = params;
  const data = await getDeveloperByLang(lang, slug);

  const ogImage = data?.logo?.asset?._ref
    ? urlFor(data.logo).width(1200).height(630).url()
    : DEFAULT_OG_IMAGE;

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
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: data?.seo.metaTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      images: [ogImage],
    },
  };
}

const DeveloperPage = async ({ params }: Props) => {
  const { lang, slug } = params;
  const developer = await getDeveloperByLang(lang, slug);

  if (!developer) {
    notFound();
  }

  const catalog = await getDeveloperCatalogByLang(lang, developer._id);
  const toCardData = (items: typeof catalog.available): DeveloperProjectCardData[] =>
    items.map((p) => {
      const kf = p.keyFeatures ?? {};
      const cardSlug = p.slug?.current ?? "";
      return {
        id: p._id,
        title: p.title,
        href: cardSlug ? localizedHref(lang, ["projects", cardSlug]) : "#",
        image: p._source === "development" ? (p.previewImage as string | undefined) : safeUrl(p.previewImage),
        city: kf.city ?? "",
        price: typeof kf.price === "number" ? kf.price : Number(kf.price) || null,
        bedrooms: kf.bedrooms ?? "",
        area: kf.coveredArea ?? "",
        type: kf.propertyType ?? "",
        energy: kf.energyEfficiency ?? "",
        completion: resolveCompletionYear(kf.completionDate),
        isNew: !!p.isNew,
        isFeatured: !!p.isFeatured,
        distances: p.distances ?? null,
        vatApplies: p._source === "development" ? (kf.vatApplies ?? null) : undefined,
        unitsAvailable: p.unitsAvailable,
        unitsTotal: p.unitsTotal,
        stageLabel: p.stageLabel,
      };
    });
  const availableCards = toCardData(catalog.available);
  const soldOutCards = toCardData(catalog.soldOut);

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
        <DeveloperProjectsGrid
          available={availableCards}
          soldOut={soldOutCards}
          lang={lang}
          developerName={developer.title}
        />
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
