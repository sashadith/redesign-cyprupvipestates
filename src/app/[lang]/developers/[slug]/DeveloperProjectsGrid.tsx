"use client";

// Bündel 3 Teil 2 (2026-08-02) — the developer page's mixed catalog: legacy
// Sanity projects + this developer's linked Developments
// (getDeveloperCatalogByLang), already deduplicated and split server-side
// into available/sold-out. Renders the SAME <ProjectCard> AND the SAME
// <ProjectsMap> the /projects listing uses — see AlternativesBlock.tsx for
// why a second hand-built card/map drifts over time. 3-per-row (matching
// /projects' own card size, not the 4-per-row compact "alternatives" strip).
//
// Order: map (all available projects, clickable pins — sold-out gets no pin,
// same dead-end-avoidance rule /projects itself already applies) -> available
// grid -> sold-out grid -> contact form. Sold-out is its OWN .pp-section
// (not a heading with a guessed margin-top) specifically so its spacing
// matches every other section boundary on the page via the same
// .pp-section padding-block every section already uses — never a bespoke
// value.
//
// "use client" for the same reason AlternativesBlock is: projectsStrings(lang)
// returns function-valued fields that can't cross the server->client boundary
// as props. The map is dynamically imported (ssr:false) exactly like
// ProjectsExplorer does, and shares this component's hoveredId state with the
// grid so hovering a card highlights its pin and vice versa — same coupling
// as ProjectsExplorer, just without the filter bar/pagination around it.
import { useState } from "react";
import dynamic from "next/dynamic";
import { ProjectCard, type ProjectCardData } from "@/app/preview-projects/ProjectCard";
import type { MapMarker } from "@/app/preview-projects/ProjectsExplorer";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";

const ProjectsMap = dynamic(() => import("@/app/preview-projects/ProjectsMap"), {
  ssr: false,
  loading: () => <div className="px-map__loading">Loading map…</div>,
});

export type DeveloperProjectCardData = ProjectCardData;

const HEADLINE: Record<string, (name: string) => string> = {
  en: (name) => `Projects of ${name}`,
  de: (name) => `Projekte des Entwicklers ${name}`,
  pl: (name) => `Projekty dewelopera ${name}`,
  ru: (name) => `Проекты застройщика ${name}`,
};
const SOLD_OUT_HEADING: Record<string, string> = {
  en: "Sold out",
  de: "Ausverkauft",
  pl: "Wyprzedane",
  ru: "Продано",
};
const EMPTY: Record<string, string> = {
  en: "No projects available for this developer.",
  de: "Keine Projekte für diesen Entwickler verfügbar.",
  pl: "Brak projektów dostępnych dla tego dewelopera.",
  ru: "Нет доступных проектов для этого застройщика.",
};

export default function DeveloperProjectsGrid({
  available, soldOut, markers, lang, developerName, formSlot,
}: {
  available: DeveloperProjectCardData[];
  soldOut: DeveloperProjectCardData[];
  markers: MapMarker[];
  lang: string;
  developerName: string;
  formSlot: React.ReactNode;
}) {
  const s = projectsStrings(lang);
  const headline = (HEADLINE[lang] ?? HEADLINE.en)(developerName);
  const soldOutHeading = SOLD_OUT_HEADING[lang] ?? SOLD_OUT_HEADING.en;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <>
      {markers.length > 0 && (
        <section className="pp-mapsection dev-map-section" data-theme="dark">
          <div className="dev-catalog__mapwrap">
            <ProjectsMap
              markers={markers} hoveredId={hoveredId} onHover={setHoveredId} locale={lang} strings={s}
              syncBoundsToUrl={false} className="pp-map" tileStyle="layered"
            />
          </div>
        </section>
      )}

      <section className="pp-wrap pp-section dev-catalog" data-theme="dark">
        <h2 className="pp-h2">{headline}</h2>
        {available.length === 0 && soldOut.length === 0 ? (
          <p className="dev-catalog__empty">{EMPTY[lang] ?? EMPTY.en}</p>
        ) : (
          <div className="dev-catalog__grid">
            {available.map((c) => (
              <ProjectCard key={c.id} c={c} s={s} locale={lang} active={c.id === hoveredId} onHover={setHoveredId} />
            ))}
          </div>
        )}
      </section>

      {soldOut.length > 0 && (
        <section className="pp-wrap pp-section dev-catalog" data-theme="dark">
          <h3 className="pp-h2 dev-catalog__sold-heading">{soldOutHeading}</h3>
          <div className="dev-catalog__grid">
            {soldOut.map((c) => <ProjectCard key={c.id} c={c} s={s} locale={lang} />)}
          </div>
        </section>
      )}

      {formSlot}
    </>
  );
}
