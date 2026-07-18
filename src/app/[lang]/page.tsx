// Home Page — migrated to the approved staging redesign (deep-green + champagne,
// Fraunces/Mulish). Keeps LIVE production data, SEO, JSON-LD (Organization, in
// layout), ISR/static params, global Header/Footer, forms, CRM and multilingual
// content; only the visual layer is the staging design. Section CSS + tokens are
// imported here so they load on the home route; fonts are already global.
import "@/app/preview-home/tokens.css";

import { Metadata } from "next";
import {
  getFormStandardDocumentByLang,
  getHomePageByLang,
  ALL_LOCALES,
} from "../../sanity/sanity.utils";
import { i18n } from "@/i18n.config";
import {
  abs,
  localizedPath,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
} from "@/lib/seo";
import { Translation } from "@/types/homepage";
import { FormStandardDocument } from "@/types/formStandardDocument";
import type { TextContent, DoubleTextBlock } from "@/types/blog";

// Global chrome (production)
import Header from "../components/Header/Header";
import Footer from "../components/Footer/Footer";
import WhatsAppButton from "../components/WhatsAppButton/WhatsAppButton";
import ModalBrochure from "../components/ModalBrochure/ModalBrochure";

// Staging redesign sections
import PreviewMotion from "@/app/preview-home/anim/PreviewMotion";
import Hero from "@/app/preview-home/sections/Hero";
import Brochure from "@/app/preview-home/sections/Brochure";
import About from "@/app/preview-home/sections/About";
import FeaturedProjects from "@/app/preview-home/sections/FeaturedProjects";
import Cities from "@/app/preview-home/sections/Cities";
import Description from "@/app/preview-home/sections/Description";
import LatestDevelopments from "@/app/preview-home/sections/LatestDevelopments";
import Benefits from "@/app/preview-home/sections/Benefits";
import HowWeWork from "@/app/preview-home/sections/HowWeWork";
import CaseStudies from "@/app/preview-home/sections/CaseStudies";
import Content from "@/app/preview-home/sections/Content";
import Faq from "@/app/preview-home/sections/Faq";
import ParallaxBand from "@/app/preview-home/sections/ParallaxBand";
import Form from "@/app/preview-home/sections/Form";
import ConsultButton from "@/app/preview-home/sections/ConsultButton";
import { homeStrings } from "@/app/preview-home/sections/homeI18n";

export const revalidate = 1800;
export function generateStaticParams() {
  return ALL_LOCALES.map((lang) => ({ lang }));
}

type Props = { params: { lang: string; slug: string } };

// SEO — unchanged from production (title/desc/canonical/hreflang/OG).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = params;
  const homePage = await getHomePageByLang(lang);

  const canonical = abs(localizedPath(lang));
  const languages: Record<string, string> = {};
  for (const l of ALL_LOCALES) languages[l] = abs(localizedPath(l));
  languages["x-default"] = languages["en"] ?? canonical;

  return {
    title: homePage?.seo?.metaTitle,
    description: homePage?.seo?.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: homePage?.seo?.metaTitle,
      description: homePage?.seo?.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: "Cyprus VIP Estates — Luxury Real Estate in Cyprus",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: homePage?.seo?.metaTitle,
      description: homePage?.seo?.metaDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function Home({ params }: Props) {
  const { lang } = params;
  const homePage = await getHomePageByLang(lang);
  const formDocument: FormStandardDocument = await getFormStandardDocumentByLang(lang);
  const t = homeStrings(lang);

  // Language-switcher translations (same logic as production).
  const homePageTranslationSlugs: { [key: string]: { current: string } }[] =
    homePage?._translations.map((item) => {
      const newItem: { [key: string]: { current: string } } = {};
      for (const key in item.slug) if (key !== "_type") newItem[key] = { current: item.slug[key].current };
      return newItem;
    });

  const translations = i18n.languages.reduce<Translation[]>((acc, l) => {
    const translationSlug = homePageTranslationSlugs
      ?.reduce((a: string[], slug: { [key: string]: { current: string } }) => {
        const current = slug[l.id]?.current;
        if (current) a.push(current);
        return a;
      }, [])
      .join(" ");
    return translationSlug ? [...acc, { language: l.id, path: localizedPath(l.id) }] : acc;
  }, []);

  return (
    <>
      <Header params={params} translations={translations} />
      <PreviewMotion />
      <main>
        <Hero
          heroBlock={homePage.heroBlock}
          lang={lang}
          consultCta={<ConsultButton className="btn btn--glass"><span>{t.getConsultation}</span></ConsultButton>}
        />
        <Brochure
          brochure={homePage.brochureBlock}
          cta={
            homePage.brochureBlock?.buttonLabel ? (
              <ConsultButton className="btn btn--primary"><span>{homePage.brochureBlock.buttonLabel}</span></ConsultButton>
            ) : undefined
          }
        />
        <About aboutBlock={homePage.aboutBlock} />
        <FeaturedProjects block={homePage.featuredProjectsBlock} lang={lang} />
        {homePage.citiesBlock && <Cities block={homePage.citiesBlock} lang={lang} />}
        {homePage.descriptionBlock && <Description block={homePage.descriptionBlock} />}
        <LatestDevelopments lang={lang} />
        {homePage.benefitsBlock && <Benefits block={homePage.benefitsBlock} />}
        {homePage.howWeWorkBlock && <HowWeWork block={homePage.howWeWorkBlock} />}
        {homePage.featuredCaseStudiesBlock && (
          <CaseStudies block={homePage.featuredCaseStudiesBlock} lang={lang} />
        )}
        {homePage.contentBlocks?.length ? (
          <Content blocks={homePage.contentBlocks as Array<TextContent | DoubleTextBlock>} lang={lang} />
        ) : null}
        {homePage.faqSection && <Faq section={homePage.faqSection} lang={lang} />}
        <ParallaxBand image={homePage.parallaxImage} videoSrc="/uploads/sunset.mp4" />
        <Form lang={lang} />
      </main>
      <Footer params={params} />
      <ModalBrochure lang={lang} formDocument={formDocument} />
      <WhatsAppButton lang={lang} />
    </>
  );
}
