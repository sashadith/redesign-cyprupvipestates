import { Metadata } from "next";
import Link from "next/link";
import {
  getFormStandardDocumentByLang,
  getHomePageByLang,
  ALL_LOCALES,
} from "../../sanity/sanity.utils";
import { i18n } from "@/i18n.config";
import { abs, localizedPath } from "@/lib/seo";

export const revalidate = 1800;
export function generateStaticParams() {
  return ALL_LOCALES.map((lang) => ({ lang }));
}
import { Translation } from "@/types/homepage";
import Header from "../components/Header/Header";
import Hero from "../components/Hero/Hero";
import ModalBrochure from "../components/ModalBrochure/ModalBrochure";
import BrochureBlock from "../components/BrochureBlock/BrochureBlock";
import AboutBlock from "../components/AboutBlock/AboutBlock";
import Footer from "../components/Footer/Footer";
import ProjectsBlock from "../components/ProjectsBlock/ProjectsBlock";
import HeaderWrapper from "../components/HeaderWrapper/HeaderWrapper";
import { FormStandardDocument } from "@/types/formStandardDocument";
import ParallaxImage from "../components/ParallaxImage/ParallaxImage";
import DescriptionBlock from "../components/DescriptionBlock/DescriptionBlock";
import NewListnigs from "../components/NewListnigs/NewListnigs";
import Reviews from "../components/Reviews/Reviews";
import FormStatic from "../components/FormStatic/FormStatic";
import LogosCarousel from "../components/LogosCarousel/LogosCarousel";
import DevelopersLogos from "../components/DevelopersLogos/DevelopersLogos";
import BenefitsBlock from "../components/BenefitsBlock/BenefitsBlock";
import HowWeWorkBlock from "../components/HowWeWorkBlock/HowWeWorkBlock";
import ReviewsFullBlockComponent from "../components/ReviewsFullBlockComponent/ReviewsFullBlockComponent";
import WhatsAppButton from "../components/WhatsAppButton/WhatsAppButton";
import HomepageHero from "../components/HomepageHero/HomepageHero";
import FeaturedProjectsHomepage from "../components/FeaturedProjectsHomepage/FeaturedProjectsHomepage";
import FaqHomepage from "../components/FaqHomepage/FaqHomepage";
import { DoubleTextBlock, TextContent } from "@/types/blog";
import TextContentComponent from "../components/TextContentComponent/TextContentComponent";
import DoubleTextBlockComponent from "../components/DoubleTextBlockComponent/DoubleTextBlockComponent";
import CitiesHomepage from "../components/CitiesHomepage/CitiesHomepage";
import FeaturedCaseStudies from "../components/FeaturedCaseStudies/FeaturedCaseStudies";

type Props = {
  params: { lang: string; slug: string };
};

// Dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = params;
  const homePage = await getHomePageByLang(lang);

  // The homepage lives at `/{lang}` in every locale.
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
    },
  };
}

export default async function Home({ params }: Props) {
  const homePage = await getHomePageByLang(params.lang);

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(params.lang);

  // console.log("homePage", homePage);
  // console.log("formDocument", formDocument);

  const homePageTranslationSlugs: { [key: string]: { current: string } }[] =
    homePage?._translations.map((item) => {
      const newItem: { [key: string]: { current: string } } = {};

      for (const key in item.slug) {
        if (key !== "_type") {
          newItem[key] = { current: item.slug[key].current };
        }
      }
      return newItem;
    });

  const renderContentBlock = (block: TextContent | DoubleTextBlock) => {
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

      default:
        return null;
    }
  };

  const translations = i18n.languages.reduce<Translation[]>((acc, lang) => {
    const translationSlug = homePageTranslationSlugs
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
            path: `/${lang.id}`,
          },
        ]
      : acc;
  }, []);

  return (
    <>
      <Header params={params} translations={translations} />
      <main>
        {/* <Hero slides={homePage.sliderMain} /> */}
        <HomepageHero heroBlock={homePage.heroBlock} />
        <BrochureBlock brochure={homePage.brochureBlock} />
        <AboutBlock aboutBlock={homePage.aboutBlock} />
        <FeaturedProjectsHomepage
          featuredProjectsBlock={homePage.featuredProjectsBlock}
          lang={params.lang}
        />
        {homePage.citiesBlock && (
          <CitiesHomepage citiesBlock={homePage.citiesBlock} />
        )}
        <DescriptionBlock descriptionBlock={homePage.descriptionBlock} />
        <NewListnigs lang={params.lang} />
        <BenefitsBlock benefitsBlock={homePage.benefitsBlock} />
        <HowWeWorkBlock work={homePage.howWeWorkBlock} />
        {homePage.contentBlocks?.length ? (
          <div className="contentBlocks">
            {homePage.contentBlocks.map(renderContentBlock)}
          </div>
        ) : null}
        {homePage.featuredCaseStudiesBlock && (
          <FeaturedCaseStudies
            block={homePage.featuredCaseStudiesBlock}
            lang={params.lang}
          />
        )}
        {homePage.faqSection && (
          <FaqHomepage faqSection={homePage.faqSection} />
        )}
        {/* <DevelopersLogos
          logos={homePage.logosBlock?.logos}
          lang={params.lang}
        /> */}
        <ParallaxImage image={homePage.parallaxImage} />
        <ReviewsFullBlockComponent
          block={homePage.reviewsFullBlock}
          lang={params.lang}
        />
        {/* <Reviews reviews={homePage.reviewsBlock} /> */}
        <FormStatic lang={params.lang} />
        <ModalBrochure lang={params.lang} formDocument={formDocument} />
        <WhatsAppButton lang={params.lang} />
      </main>
      <Footer params={params} />
    </>
  );
}
