import { Metadata } from "next";
import React from "react";
import { abs, localizedPath } from "@/lib/seo";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { getTranslations } from "next-intl/server";
import { Translation } from "@/types/homepage";
import { getFormStandardDocumentByLang } from "@/sanity/sanity.utils";
import { FormStandardDocument } from "@/types/formStandardDocument";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import PartnersHero from "@/app/components/PartnersPage/PartnersHero/PartnersHero";
import ModalBrochure from "@/app/components/ModalBrochure/ModalBrochure";
import PartnersBenefits from "@/app/components/PartnersPage/PartnersBenefits/PartnersBenefits";
import PartnersCta from "@/app/components/PartnersPage/PartnersCta/PartnersCta";
import PartnersStars from "@/app/components/PartnersPage/PartnersStars/PartnersStars";
import PartnersCount from "@/app/components/PartnersPage/PartnersCount/PartnersCount";
import PartnersContact from "@/app/components/PartnersPage/PartnersContact/PartnersContact";
import ModalPartners from "@/app/components/ModalPartners/ModalPartners";

type Props = {
  params: { lang: string };
};

const metadataByLang = {
  de: {
    title:
      "Partnerprogramm für Immobilien-Tippgeber & Berater – Cyprus VIP Estates",
    description:
      "Werden Sie Partner von Cyprus VIP Estates. Wir bieten attraktive Erfolgshonorare für Tippgeber, Berater und Vermittler im Bereich Zypern-Immobilien. Jetzt anmelden und Marketing-Partner werden!",
  },
  en: {
    title:
      "Partner Program for Property Consultants & Marketers – Cyprus VIP Estates",
    description:
      "Become a partner of Cyprus VIP Estates – earn up to 50% referral fee by promoting luxury properties in Cyprus.",
  },
  pl: {
    title:
      "Program partnerski dla doradców ds. nieruchomości – Cyprus VIP Estates",
    description:
      "Zostań partnerem Cyprus VIP Estates – zarabiaj do 50% wynagrodzenia, promując luksusowe nieruchomości na Cyprze.",
  },
  ru: {
    title:
      "Партнёрская программа для консультантов по недвижимости – Cyprus VIP Estates",
    description:
      "Станьте партнёром Cyprus VIP Estates — зарабатывайте до 50% вознаграждения, продвигая элитную недвижимость на Кипре.",
  },
};

// Dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = params;

  const fallback = metadataByLang.de;
  const meta = metadataByLang[lang as keyof typeof metadataByLang] || fallback;

  const canonical = abs(localizedPath(lang, ["partners"]));

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        de: abs(localizedPath("de", ["partners"])),
        en: abs(localizedPath("en", ["partners"])),
        pl: abs(localizedPath("pl", ["partners"])),
        ru: abs(localizedPath("ru", ["partners"])),
        "x-default": abs(localizedPath("en", ["partners"])),
      },
    },
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

const PartnersPage = async ({ params }: Props) => {
  const { lang } = params;

  const formDocument: FormStandardDocument =
    await getFormStandardDocumentByLang(lang);

  // const t = await getTranslations({ locale: lang, namespace: "partners" });

  const translations: Translation[] = i18n.languages
    .filter((l) => l.id !== lang)
    .map((l) => ({
      language: l.id,
      path: `/${l.id}/partners`,
    }));

  return (
    <>
      <Header params={params} translations={translations} />
      <main className="main-partners">
        <div className="partners-wrapper">
          <PartnersHero lang={lang} />
          <PartnersBenefits lang={lang} />
          <PartnersCta lang={lang} />
          <PartnersStars lang={lang} />
          <PartnersCount lang={lang} />
          <PartnersContact lang={lang} form={formDocument} />
        </div>
        <ModalPartners lang={params.lang} formDocument={formDocument} />
      </main>

      <Footer params={params} />
    </>
  );
};

export default PartnersPage;
