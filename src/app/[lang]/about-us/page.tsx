import { Metadata } from "next";
import React from "react";
import { getHomePageByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { staticAlternates } from "@/lib/seo";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { Translation } from "@/types/homepage";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import "@/app/preview-home/tokens.css";

/* Full "Who We Are" content — the SEO home for the aboutBlock copy that the
   homepage now only shows a 3-item compact summary of (see preview-home/sections/About.tsx). */

type Props = { params: { lang: string } };

const metadataByLang: Record<string, { title: string; description: string }> = {
  en: {
    title: "About Us — Cyprus VIP Estates",
    description: "Who we are: a Cyprus-based luxury real estate agency guiding investors, expats and homeowners from first search to closing.",
  },
  de: {
    title: "Über uns — Cyprus VIP Estates",
    description: "Wer wir sind: eine auf Zypern ansässige Luxusimmobilienagentur, die Investoren und Auswanderer von der ersten Suche bis zum Abschluss begleitet.",
  },
  pl: {
    title: "O nas — Cyprus VIP Estates",
    description: "Kim jesteśmy: agencja nieruchomości premium z Cypru, która prowadzi inwestorów i emigrantów od pierwszych poszukiwań aż po finalizację zakupu.",
  },
  ru: {
    title: "О нас — Cyprus VIP Estates",
    description: "Кто мы: агентство элитной недвижимости на Кипре, сопровождающее инвесторов и эмигрантов от первого поиска до завершения сделки.",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = params;
  const meta = metadataByLang[lang] || metadataByLang.en;
  const { canonical, languages } = staticAlternates(lang, "about-us");

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical, languages },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
    },
  };
}

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const renderTitle = (title: string) =>
  title.split(/(Only One)/i).map((part, i) =>
    part.toLowerCase() === "only one" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export default async function AboutUsPage({ params }: Props) {
  const { lang } = params;
  const homePage = await getHomePageByLang(lang);
  const aboutBlock = homePage?.aboutBlock;

  const translations: Translation[] = i18n.languages
    .filter((l) => l.id !== lang)
    .map((l) => ({ language: l.id, path: localizedHref(l.id, "about-us") }));

  return (
    <>
      <Header params={params} translations={translations} />
      <main>
        <section className="section is-light about">
          <div className="wrap">
            {aboutBlock?.title && (
              <h1 className="about__title">
                {renderTitle(aboutBlock.title.replace(/This is Cyprus/i, "There is Only One Cyprus"))}
              </h1>
            )}
            <hr className="shimmer about__stripe" />

            {aboutBlock?.description && <p className="about__desc">{aboutBlock.description}</p>}

            {aboutBlock?.bullets?.length ? (
              <ul className="about__bullets">
                {aboutBlock.bullets.map((b) => {
                  const icon = safeUrl(b.image);
                  return (
                    <li className="about__bullet" key={b._key}>
                      <span className="about__medallion">{icon && <img src={icon} alt="" />}</span>
                      <span className="about__bullet-text">{b.description}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
        <WhatsAppButton lang={lang} />
      </main>
      <Footer params={params} />
    </>
  );
}
