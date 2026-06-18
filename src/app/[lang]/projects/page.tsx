import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getFilteredProjects,
  getFilteredProjectsCount,
  getProjectsPageByLang,
  getAllProjectsLocationsByLang,
  getFilteredProjectLocationsByLang,
} from "@/sanity/sanity.utils";
import { i18n } from "@/i18n.config";
import { Translation } from "@/types/homepage";
import ProjectLink from "@/app/components/ProjectLink/ProjectLink";
import NoProjects from "@/app/components/NoProjects/NoProjects";
import StyledProjectFilters from "@/app/components/StyledProjectFilters/StyledProjectFilters";
import Header from "@/app/components/Header/Header";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import { Metadata } from "next";
import Footer from "@/app/components/Footer/Footer";
import WhatsAppButton from "@/app/components/WhatsAppButton/WhatsAppButton";
import FormStatic from "@/app/components/FormStatic/FormStatic";
import ProjectLinkAll from "@/app/components/ProjectLinkAll/ProjectLinkAll";

const PAGE_SIZE = 12;

type SearchParams = {
  page?: string;
  city?: string;
  priceFrom?: string;
  priceTo?: string;
  propertyType?: string;
  sort?: string;
  q?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

type ProjectsPageProps = {
  params: { lang: string };
  searchParams: SearchParams;
};

type MetaDataProps = {
  params: { lang: string };
};

// Dynamic metadata for SEO
export async function generateMetadata({
  params,
}: MetaDataProps): Promise<Metadata> {
  const data = await getProjectsPageByLang(params.lang);

  return {
    title: data?.seo.metaTitle,
    description: data?.seo.metaDescription,
  };
}

const ProjectsMapAll = dynamic(
  () => import("@/app/components/ProjectsMapAll/ProjectsMapAll"),
  { ssr: false },
);

// pagination
function buildPagination(current: number, total: number, neighbors = 2) {
  if (total <= 1) return [] as (number | "...")[];

  // Если страниц немного — показываем все без эллипсисов
  if (total <= 2 * neighbors + 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  const start = Math.max(2, current - neighbors);
  const end = Math.min(total - 1, current + neighbors);

  pages.push(1);

  if (start > 2) {
    pages.push("...");
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < total - 1) {
    pages.push("...");
  }

  pages.push(total);

  return pages;
}
// pagination end

export default async function ProjectsPage({
  params,
  searchParams,
}: ProjectsPageProps) {
  const { lang } = params;

  // Получаем переводы для страницы проектов (например, propertiesPage документ из Sanity)
  const projectsPage = await getProjectsPageByLang(lang);

  const propertyPageTranslationSlugs: {
    [key: string]: { current: string };
  }[] = projectsPage?._translations.map((item) => {
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
            path: `/${lang.id}/projects`,
          },
        ]
      : acc;
  }, []);

  const currentPage = Number(searchParams.page) || 1;
  const city = searchParams.city || "";
  const priceFrom = searchParams.priceFrom
    ? Number(searchParams.priceFrom)
    : null;
  const priceTo = searchParams.priceTo ? Number(searchParams.priceTo) : null;
  const propertyType = searchParams.propertyType || "";
  const skip = (currentPage - 1) * PAGE_SIZE;
  const sort = searchParams.sort || "recommended";
  const q = searchParams.q || "";
  const north = searchParams.north ? Number(searchParams.north) : null;
  const south = searchParams.south ? Number(searchParams.south) : null;
  const east = searchParams.east ? Number(searchParams.east) : null;
  const west = searchParams.west ? Number(searchParams.west) : null;

  const projects = await getFilteredProjects(lang, skip, PAGE_SIZE, {
    city,
    priceFrom,
    priceTo,
    propertyType,
    sort,
    q,
    north,
    south,
    east,
    west,
  });
  const totalProjects = await getFilteredProjectsCount(lang, {
    city,
    priceFrom,
    priceTo,
    propertyType,
    q,
    north,
    south,
    east,
    west,
  });
  const totalPages = Math.ceil(totalProjects / PAGE_SIZE);

  // получаем ВСЕ проекты с координатами (статично, без фильтров/пагинации)
  const allMarkers = await getAllProjectsLocationsByLang(lang);

  // ⟵ ВАЖНО: теперь берём маркеры по тем же фильтрам (без пагинации)
  const filteredMarkers = await getFilteredProjectLocationsByLang(lang, {
    city,
    priceFrom,
    priceTo,
    propertyType,
    q,
    north,
    south,
    east,
    west,
  });

  return (
    <>
      {/* Рендерим Header с переводами аналогично странице проекта */}
      {/* <div style={{ backgroundColor: "#212121", height: "62px" }}>
        <HeaderWrapper> */}
      <Header params={params} translations={translations} />
      {/* </HeaderWrapper>
      </div> */}

      <main style={{ paddingTop: "2rem" }}>
        <StyledProjectFilters
          lang={lang}
          city={city}
          priceFrom={priceFrom}
          priceTo={priceTo}
          propertyType={propertyType}
          sort={sort}
          q={q}
        />
        <section className="projects-map">
          <div className="projects-map__wrapper">
            <div className="projects-map__projects">
              {projects.length === 0 ? (
                <NoProjects lang={lang} />
              ) : (
                <div className="projects-map__projects-list">
                  {projects.map((project: any) => {
                    const projectUrl =
                      project.slug && project.slug.current
                        ? `/${lang}/projects/${project.slug.current}`
                        : "#";
                    return (
                      <ProjectLinkAll
                        key={project._id}
                        url={projectUrl}
                        previewImage={project.previewImage}
                        title={project.title}
                        price={project.keyFeatures?.price ?? 0}
                        bedrooms={project.keyFeatures?.bedrooms ?? 0}
                        coveredArea={project.keyFeatures?.coveredArea ?? 0}
                        plotSize={project.keyFeatures?.plotSize ?? 0}
                        lang={lang}
                        isSold={project.isSold}
                        videoId={project.videoId}
                        isNew={project.isNew}
                        images={project.images}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
        {/* <div className="container">
          {projects.length === 0 ? (
            <NoProjects lang={lang} />
          ) : (
            <div className="projects">
              {projects.map((project: any) => {
                const projectUrl =
                  project.slug && project.slug.current
                    ? lang === defaultLocale
                      ? `/projects/${project.slug.current}`
                      : `/${lang}/projects/${project.slug.current}`
                    : "#";
                return (
                  <ProjectLink
                    key={project._id}
                    url={projectUrl}
                    previewImage={project.previewImage}
                    title={project.title}
                    price={project.keyFeatures?.price ?? 0}
                    bedrooms={project.keyFeatures?.bedrooms ?? 0}
                    coveredArea={project.keyFeatures?.coveredArea ?? 0}
                    plotSize={project.keyFeatures?.plotSize ?? 0}
                    lang={lang}
                    isSold={project.isSold}
                  />
                );
              })}
            </div>
          )}
        </div> */}
        <div className="pagination-links" style={{ marginTop: "2rem" }}>
          {totalPages > 1 && (
            <div
              className="pagination-links"
              style={{
                marginTop: "2rem",
                marginBottom: "1rem",
                display: "flex",
                gap: ".5rem",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* helper для сборки href с текущими фильтрами */}
              {(() => {
                const makeHref = (page: number) => {
                  const paramsObj: Record<string, string> = {};

                  if (page > 1) paramsObj.page = String(page);
                  if (city) paramsObj.city = city;
                  if (priceFrom != null)
                    paramsObj.priceFrom = String(priceFrom);
                  if (priceTo != null) paramsObj.priceTo = String(priceTo);
                  if (propertyType) paramsObj.propertyType = propertyType;
                  if (sort) paramsObj.sort = sort;
                  if (q) paramsObj.q = q;

                  // 👇 добавляем bbox ТОЛЬКО если он реально установлен
                  if (north != null) paramsObj.north = String(north);
                  if (south != null) paramsObj.south = String(south);
                  if (east != null) paramsObj.east = String(east);
                  if (west != null) paramsObj.west = String(west);

                  return `?${new URLSearchParams(paramsObj).toString()}`;
                };

                return (
                  <>
                    {/* Prev */}
                    {currentPage > 1 && (
                      <Link
                        href={makeHref(currentPage - 1)}
                        className="pagination-link"
                        aria-label="Previous"
                      >
                        ‹
                      </Link>
                    )}

                    {/* Страницы с многоточиями */}
                    {buildPagination(currentPage, totalPages, 2).map(
                      (item, idx) => {
                        if (item === "...") {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              className="pagination-ellipsis"
                              aria-hidden="true"
                              style={{ padding: "0 .5rem" }}
                            >
                              …
                            </span>
                          );
                        }

                        const pageNum = item as number;
                        const href = makeHref(pageNum);

                        return pageNum === currentPage ? (
                          <button
                            key={pageNum}
                            disabled
                            className="pagination-link pagination-link-active"
                            aria-current="page"
                          >
                            {pageNum}
                          </button>
                        ) : (
                          <Link
                            key={pageNum}
                            href={href}
                            className="pagination-link"
                          >
                            {pageNum}
                          </Link>
                        );
                      },
                    )}

                    {/* Next */}
                    {currentPage < totalPages && (
                      <Link
                        href={makeHref(currentPage + 1)}
                        className="pagination-link"
                        aria-label="Next"
                      >
                        ›
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="projects-map__map">
          <div
            className="map-sticky"
            // style={{
            //   marginTop: "2rem",
            //   width: "100%",
            //   height: "500px",
            //   position: "relative",
            //   overflow: "hidden",
            // }}
          >
            <ProjectsMapAll lang={lang} markers={filteredMarkers} />
          </div>
        </div>

        {/* === СТАБИЛЬНАЯ СТАТИЧНАЯ КАРТА СО ВСЕМИ ПРОЕКТАМИ === */}
        {/* <div
          style={{
            marginTop: "2rem",
            width: "100%",
            height: "500px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ProjectsMapAll lang={lang} markers={filteredMarkers} />
        </div> */}
        <FormStatic lang={params.lang} />
        <WhatsAppButton lang={params.lang} />
      </main>
      <Footer params={params} />
    </>
  );
}
