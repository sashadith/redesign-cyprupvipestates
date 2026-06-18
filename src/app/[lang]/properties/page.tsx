import React from "react";
import { Metadata } from "next";
import { i18n } from "@/i18n.config";
import {
  getAllProperties,
  getFormStandardDocumentByLang,
  getPropertiesPageByLang,
} from "@/sanity/sanity.utils";
import Link from "next/link";
import { Property } from "@/types/property"; // Импортируйте тип Property
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import PropertiesList from "@/app/components/PropertiesList/PropertiesList";
import PropertyCard from "@/app/components/PropertyCard/PropertyCard";
import Footer from "@/app/components/Footer/Footer";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { Translation } from "@/types/homepage";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import Header from "@/app/components/Header/Header";
import PropertiesPageIntro from "@/app/components/PropertiesPageIntro/PropertiesPageIntro";

type Props = {
  params: { lang: string };
};

// Dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPropertiesPageByLang(params.lang);

  return {
    title: data?.metaTitle,
    description: data?.metaDescription,
  };
}

const PropertiesPage = async ({ params }: Props) => {
  const { lang } = params;

  const propertiesPage = await getPropertiesPageByLang(lang);

  // Получаем список объектов недвижимости
  const properties: Property[] = await getAllProperties(lang);

  if (!properties || properties.length === 0) {
    return <div>No properties found.</div>;
  }

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(params.lang);

  const propertiesPageTranslationSlugs: {
    [key: string]: { current: string };
  }[] = propertiesPage?._translations.map((item) => {
    const newItem: { [key: string]: { current: string } } = {};

    for (const key in item.slug) {
      if (key !== "_type") {
        newItem[key] = { current: item.slug[key].current };
      }
    }
    return newItem;
  });

  const translations = i18n.languages.reduce<Translation[]>((acc, lang) => {
    const translationSlug = propertiesPageTranslationSlugs
      ?.reduce(
        (acc: string[], slug: { [key: string]: { current: string } }) => {
          const current = slug[lang.id]?.current;
          if (current) {
            acc.push(current);
          }
          return acc;
        },
        []
      )
      .join(" ");

    return translationSlug
      ? [
          ...acc,
          {
            language: lang.id,
            path: `/${lang.id}`,
          },
        ]
      : acc;
  }, []);

  return (
    <>
      <HeaderWrapper>
        <Header params={params} translations={translations} />
      </HeaderWrapper>
      <div>
        <PropertiesPageIntro title={propertiesPage.title} />
        <PropertiesList>
          {properties.map((property: Property) => (
            <PropertyCard key={property._id} property={property} lang={lang} />
          ))}
        </PropertiesList>
      </div>
      <Footer params={params} />
      <ModalBrochure lang={params.lang} formDocument={formDocument} />
    </>
  );
};

export default PropertiesPage;
