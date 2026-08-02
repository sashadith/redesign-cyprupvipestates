import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";
import "@/app/preview-insights/insights.css";
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
import { urlFor } from "@/sanity/sanity.client";
import FullDescriptionBlock from "@/app/components/FullDescriptionBlock/FullDescriptionBlock";
import SchemaMarkup from "@/app/components/SchemaMarkup/SchemaMarkup";
import PropertyDescription from "@/app/components/PropertyDescription/PropertyDescription";
import DeveloperJournalIntro from "@/app/[lang]/developers/[slug]/DeveloperJournalIntro";
import DevAtmosphere from "@/app/[lang]/developers/[slug]/DevAtmosphere";
import DeveloperProjectsGrid, { type DeveloperProjectCardData } from "@/app/[lang]/developers/[slug]/DeveloperProjectsGrid";
import type { MapMarker } from "@/app/preview-projects/ProjectsExplorer";
import Form from "@/app/preview-home/sections/Form";
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

// Kontaktformular copy, right under the project list (2026-08-01, headline
// gold-word + DE/RU wording corrected 2026-08-02) — reuses the existing Form
// component (preview-home/sections/Form.tsx), never a new form.
const FORM_COPY: Record<string, { title: React.ReactNode; subtitle: string }> = {
  en: {
    title: <>Before <span className="it">you decide</span>, talk to us.</>,
    subtitle:
      "We know this developer's projects in detail — and everyone else's. What really separates one apartment from another isn't in the brochure. We'll tell you, and our guidance costs you nothing extra.",
  },
  de: {
    title: <>Bevor <span className="it">Sie entscheiden</span>, sprechen Sie mit uns.</>,
    subtitle:
      "Wir kennen die Projekte dieses Bauträgers genau — und die der anderen. Was die eine Wohnung wirklich von der anderen unterscheidet, sehen Sie im Prospekt nicht. Wir sagen es Ihnen, und unsere Begleitung kostet Sie nichts extra.",
  },
  ru: {
    title: <>Прежде чем <span className="it">принимать решение</span>, поговорите с нами.</>,
    subtitle:
      "Мы детально знаем проекты этого застройщика — и проекты всех остальных. То, что действительно отличает одну квартиру от другой, в буклете не написано. Мы вам об этом расскажем, а наше сопровождение не будет стоить вам ничего дополнительно.",
  },
  pl: {
    title: <>Zanim <span className="it">zdecydujesz</span>, porozmawiaj z nami.</>,
    subtitle:
      "Znamy projekty tego dewelopera w szczegółach — i projekty wszystkich pozostałych. To, co naprawdę odróżnia jedno mieszkanie od drugiego, nie jest napisane w folderze. Powiemy Ci to, a nasze wsparcie nic dodatkowo nie kosztuje.",
  },
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
      };
    });
  const availableCards = toCardData(catalog.available);
  const soldOutCards = toCardData(catalog.soldOut);

  // Map markers: available projects only — a sold-out pin is a dead end (same
  // principle /projects itself already applies, see getFilteredProjectLocationsByLang).
  const markers: MapMarker[] = catalog.available
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => {
      const kf = p.keyFeatures ?? {};
      const cardSlug = p.slug?.current ?? "";
      return {
        id: p._id,
        title: p.title,
        href: cardSlug ? localizedHref(lang, ["projects", cardSlug]) : "#",
        city: kf.city ?? "",
        price: typeof kf.price === "number" ? kf.price : Number(kf.price) || null,
        lat: p.latitude as number,
        lng: p.longitude as number,
        image: p._source === "development" ? (p.previewImage as string | undefined) : safeUrl(p.previewImage),
        distances: p.distances ?? null,
      };
    });

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

  const formCopy = FORM_COPY[lang] ?? FORM_COPY.en;

  return (
    <>
      {/* <SchemaMarkup project={developer} /> */}
      <DeveloperSchemaMarkup developer={developer} pageUrl={pageUrl} />
      <Header params={params} translations={translations} />
      <main className="dev-atmos-root">
        {/* Golden clouds live on ONE shared page-background layer (2026-08-02g),
            not per-section pseudo-elements — those got hard-clipped by
            whichever container's overflow:hidden happened to be nearest,
            since the clouds' own visible radius routinely exceeds a single
            section's edge distance. Same architecture as .pp-atmos (the
            project detail page's own page-wide clouds, project.css): one
            absolutely-positioned layer behind everything, sized to this
            page's full content height, clipped only at the page's own
            edges — never close enough to a cloud's visible portion to cut
            it. Positions/sizes are generated client-side (DevAtmosphere,
            2026-08-02h) since they depend on this page's actual rendered
            height, which varies hugely by developer. */}
        <DevAtmosphere />
        <DeveloperJournalIntro
          lang={lang}
          title={developer.title}
          excerpt={developer.excerpt}
          logo={developer.logo}
        />
        <DeveloperProjectsGrid
          available={availableCards}
          soldOut={soldOutCards}
          markers={markers}
          lang={lang}
          developerName={developer.title}
          formSlot={<Form lang={lang} title={formCopy.title} subtitle={formCopy.subtitle} />}
        />
        <FullDescriptionBlock description={developer.description} />
      </main>
      <Footer params={params} />
      <ModalBrochure lang={params.lang} formDocument={formDocument} />
      <WhatsAppButton lang={params.lang} />
    </>
  );
};

export default DeveloperPage;
