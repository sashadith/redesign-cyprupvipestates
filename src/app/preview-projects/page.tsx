import React from "react";
import {
  getFilteredProjects,
  getFilteredProjectsCount,
  getFilteredProjectLocationsByLang,
  getProjectDistancesByIds,
} from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import ProjectsExplorer, { type ProjectCardData, type MapMarker } from "./ProjectsExplorer";
import Nav from "../preview-home/sections/Nav";
import Footer from "../preview-home/sections/Footer";

/* Cyprus VIP Estates — Projects search (isolated redesign preview, EN).
   Map-centric explorer: URL-driven filters → server fetch → list + live map. The
   live /[lang]/projects page is untouched. */

export const dynamic = "force-dynamic";

const LANG = "en";
const PAGE_SIZE = 12;

type SP = Record<string, string | undefined>;

const num = (v?: string) => (v && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default async function ProjectsPreview({ searchParams }: { searchParams: SP }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  // Active site locale for UI strings like the map gesture hint (data still EN).
  // On the real [lang] route this comes from the route; the isolated preview
  // reads ?lang= so all four locales (en/de/pl/ru) are demonstrable.
  const locale = ["en", "de", "pl", "ru"].includes(searchParams.lang || "") ? (searchParams.lang as string) : "en";
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

  const [rows, total, markersRaw] = await Promise.all([
    getFilteredProjects(LANG, (page - 1) * PAGE_SIZE, PAGE_SIZE, filters),
    getFilteredProjectsCount(LANG, filters),
    getFilteredProjectLocationsByLang(LANG, filters),
  ]);

  // distances (minutes to beach/airport/…) for the visible cards + map markers
  const distIds = Array.from(new Set([...(rows ?? []).map((r: any) => r._id), ...(markersRaw ?? []).map((m: any) => m._id)]));
  const distMap = await getProjectDistancesByIds(distIds);

  const cards: ProjectCardData[] = (rows ?? []).map((p: any) => {
    const kf = p.keyFeatures ?? {};
    return {
      id: p._id,
      title: p.title,
      href: p._source === "development" ? `/en/preview-project/${p.slug?.current ?? ""}` : `/en/projects/${p.slug?.current ?? ""}`,
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
      distances: distMap[p._id] ?? null,
    };
  });

  const markers: MapMarker[] = (markersRaw ?? [])
    .filter((m: any) => m?.location?.lat != null && m?.location?.lng != null)
    .map((m: any) => ({
      id: m._id,
      title: m.title,
      href: m._source === "development" ? `/en/preview-project/${m.slug ?? ""}` : `/en/projects/${m.slug ?? ""}`,
      city: m.city ?? "",
      price: typeof m.price === "number" ? m.price : Number(m.price) || null,
      lat: m.location.lat,
      lng: m.location.lng,
      image: m.previewUrl,
      distances: distMap[m._id] ?? null,
    }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Nav />
      <main className="px">
        <ProjectsExplorer
          cards={cards}
          markers={markers}
          total={total}
          page={page}
          totalPages={totalPages}
          filters={filters}
          locale={locale}
        />
      </main>
      <Footer lang="en" />
    </>
  );
}
