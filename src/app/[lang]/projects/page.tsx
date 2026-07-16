// Live projects listing (/[lang]/projects) — migrated to the approved staging
// redesign (/preview-projects): a dark, map-centric explorer (filter bar → server
// fetch → card grid + live Leaflet map with POIs). Keeps LIVE production data,
// SEO (title/description/canonical/hreflang/OG via generateMetadata), the global
// redesign Header/Footer, the language switcher, CRM lead form and WhatsApp
// button, and full multilingual support (en/de/pl/ru). Only the visual layer is
// the staging design; the filter / search / sort / map-bbox query logic is the
// same production data layer the old page used. Design tokens + section CSS are
// imported here so they load on the projects route; fonts are already global.
import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";

import React from "react";
import { Metadata } from "next";
import {
  getFilteredProjects,
  getFilteredProjectsCount,
  getFilteredProjectLocationsByLang,
  getProjectDistancesByIds,
  getProjectsPageByLang,
} from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { staticAlternates, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { Translation } from "@/types/homepage";

import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import Form from "@/app/preview-home/sections/Form";

import ProjectsExplorer, { type ProjectCardData, type MapMarker } from "@/app/preview-projects/ProjectsExplorer";

// Filters change per request (URL-driven) — always render fresh, like the preview.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type SearchParams = {
  page?: string;
  city?: string;
  priceFrom?: string;
  priceTo?: string;
  propertyType?: string;
  bedrooms?: string;
  sort?: string;
  q?: string;
  north?: string;
  south?: string;
  east?: string;
  west?: string;
};

type Props = {
  params: { lang: string };
  searchParams: SearchParams;
};

const num = (v?: string) => (v && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

// Dynamic metadata for SEO — unchanged from the previous production page
// (title/description/canonical/hreflang/OG all preserved).
export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const data = await getProjectsPageByLang(params.lang);
  const { canonical, languages } = staticAlternates(params.lang, "projects");

  return {
    title: data?.seo.metaTitle,
    description: data?.seo.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: data?.seo.metaTitle,
      description: data?.seo.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function ProjectsPage({ params, searchParams }: Props) {
  const { lang } = params;

  const page = Math.max(1, Number(searchParams.page) || 1);
  const filters = {
    city: searchParams.city || "",
    propertyType: searchParams.propertyType || "",
    priceFrom: num(searchParams.priceFrom),
    priceTo: num(searchParams.priceTo),
    bedrooms: searchParams.bedrooms || "",
    q: searchParams.q || "",
    sort: searchParams.sort || "recommended",
    north: num(searchParams.north),
    south: num(searchParams.south),
    east: num(searchParams.east),
    west: num(searchParams.west),
  };

  const [rows, total, markersRaw, projectsPage] = await Promise.all([
    getFilteredProjects(lang, (page - 1) * PAGE_SIZE, PAGE_SIZE, filters),
    getFilteredProjectsCount(lang, filters),
    getFilteredProjectLocationsByLang(lang, filters),
    getProjectsPageByLang(lang),
  ]);

  // distances (minutes to beach/airport/…) for the visible cards + map markers
  const distIds = Array.from(
    new Set([...(rows ?? []).map((r: any) => r._id), ...(markersRaw ?? []).map((m: any) => m._id)]),
  );
  const distMap = await getProjectDistancesByIds(distIds);

  const cards: ProjectCardData[] = (rows ?? []).map((p: any) => {
    const kf = p.keyFeatures ?? {};
    const slug = p.slug?.current ?? "";
    return {
      id: p._id,
      title: p.title,
      href: slug ? localizedHref(lang, [p._source === "development" ? "preview-project" : "projects", slug]) : "#",
      image: p._source === "development" ? (p.previewImage as string | undefined) : safeUrl(p.previewImage),
      city: kf.city ?? "",
      price: typeof kf.price === "number" ? kf.price : Number(kf.price) || null,
      bedrooms: kf.bedrooms ?? "",
      area: kf.coveredArea ?? "",
      type: kf.propertyType ?? "",
      energy: kf.energyEfficiency ?? "",
      completion: kf.completionDate ?? "",
      isNew: !!p.isNew,
      isFeatured: !!p.isFeatured,
      distances: p._source === "development" ? (p.distances ?? null) : (distMap[p._id] ?? null),
      vatApplies: p._source === "development" ? (kf.vatApplies ?? null) : undefined,
      unitsAvailable: p.unitsAvailable,
      unitsTotal: p.unitsTotal,
    };
  });

  const markers: MapMarker[] = (markersRaw ?? [])
    .filter((m: any) => m?.location?.lat != null && m?.location?.lng != null)
    .map((m: any) => ({
      id: m._id,
      title: m.title,
      href: m.slug ? localizedHref(lang, [m._source === "development" ? "preview-project" : "projects", m.slug]) : "#",
      city: m.city ?? "",
      price: typeof m.price === "number" ? m.price : Number(m.price) || null,
      lat: m.location.lat,
      lng: m.location.lng,
      image: m.previewUrl,
      distances: distMap[m._id] ?? null,
    }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Language switcher — same logic the previous production page used: derive the
  // per-locale projects slugs from the CMS document's _translations.
  const propertyPageTranslationSlugs: { [key: string]: { current: string } }[] | undefined =
    projectsPage?._translations?.map((item: any) => {
      const newItem: { [key: string]: { current: string } } = {};
      for (const key in item.slug) {
        if (key !== "_type") newItem[key] = { current: item.slug[key].current };
      }
      return newItem;
    });

  const translations = i18n.languages.reduce<Translation[]>((acc, l) => {
    const translationSlug = propertyPageTranslationSlugs
      ?.reduce((a: string[], slug: { [key: string]: { current: string } }) => {
        const current = slug[l.id]?.current;
        if (current) a.push(current);
        return a;
      }, [])
      .join(" ");

    return translationSlug
      ? [...acc, { language: l.id, path: localizedHref(l.id, "projects") }]
      : acc;
  }, []);

  return (
    <>
      <Header params={params} translations={translations} />
      <main className="px" data-theme="dark">
        <ProjectsExplorer
          cards={cards}
          markers={markers}
          total={total}
          page={page}
          totalPages={totalPages}
          filters={filters}
          locale={lang}
        />
        {/* Lead form (CRM) — redesign form, preserving production lead capture */}
        <Form lang={lang} />
      </main>
      <Footer params={params} />
      <WhatsAppButton lang={lang} />
    </>
  );
}
