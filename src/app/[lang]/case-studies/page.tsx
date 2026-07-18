// app/[lang]/case-studies/page.tsx

import React from "react";
import { Metadata } from "next";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import {
  staticAlternates,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
} from "@/lib/seo";

import {
  getCaseStudiesPageByLang,
  getCaseStudiesByLang,
  getFormStandardDocumentByLang,
  getCaseStudiesByLangWithPagination,
  getTotalCaseStudiesByLang,
} from "@/sanity/sanity.utils";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import FormStatic from "@/app/components/FormStatic/FormStatic";

import { FormStandardDocument } from "@/types/formStandardDocument";
import { Translation } from "@/types/homepage";
import BlogPostsAll from "@/app/components/BlogPostsAll/BlogPostsAll";
import BlogPageContent from "@/app/components/BlogPageContent/BlogPageContent";
import CaseStudiesAll from "@/app/components/CaseStudiesAll/CaseStudiesAll";

// import CaseStudiesAll from "@/app/components/CaseStudiesAll/CaseStudiesAll";
// import CaseStudiesPageContent from "@/app/components/CaseStudiesPageContent/CaseStudiesPageContent";

type Props = {
  params: {
    lang: string;
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getCaseStudiesPageByLang(params.lang);
  const { canonical, languages } = staticAlternates(params.lang, "case-studies");

  return {
    title: data?.metaTitle,
    description: data?.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: data?.metaTitle,
      description: data?.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.metaTitle,
      description: data?.metaDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

const CaseStudiesPage = async ({ params }: Props) => {
  const { lang } = params;
  const initialPosts = await getCaseStudiesByLangWithPagination(lang, 12, 0);
  const totalPosts = await getTotalCaseStudiesByLang(lang);

  const caseStudies = await getCaseStudiesByLang(lang);

  const caseStudiesPage = await getCaseStudiesPageByLang(lang);

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(lang);

  const translationSlugs =
    caseStudiesPage?._translations?.map((item) => {
      const result: { [key: string]: { current: string } } = {};

      for (const key in item.slug) {
        if (key !== "_type") {
          result[key] = {
            current: item.slug[key].current,
          };
        }
      }

      return result;
    }) || [];

  const translations = i18n.languages.reduce<Translation[]>(
    (acc, currentLang) => {
      const translationSlug = translationSlugs
        ?.reduce(
          (values: string[], slug: { [key: string]: { current: string } }) => {
            const current = slug[currentLang.id]?.current;

            if (current) {
              values.push(current);
            }

            return values;
          },
          [],
        )
        .join(" ");

      return translationSlug
        ? [
            ...acc,
            {
              language: currentLang.id,
              path: localizedHref(currentLang.id, ["case-studies", translationSlug]),
            },
          ]
        : acc;
    },
    [],
  );

  return (
    <>
      <Header params={params} translations={translations} />

      <main>
        <CaseStudiesAll
          title={caseStudiesPage.title}
          caseStudies={initialPosts}
          lang={params.lang}
        />

        <FormStatic lang={lang} />

        <BlogPageContent content={caseStudiesPage.content} lang={params.lang} />
      </main>

      <Footer params={params} />

      <ModalBrochure lang={lang} formDocument={formDocument} />

      <WhatsAppButton lang={lang} />
    </>
  );
};

export default CaseStudiesPage;
