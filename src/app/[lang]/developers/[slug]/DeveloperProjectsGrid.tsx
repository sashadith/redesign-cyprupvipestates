"use client";

// Bündel 3 Teil 2 (2026-08-01) — the developer page's mixed catalog: legacy
// Sanity projects + this developer's linked Developments (getDeveloperCatalogByLang),
// already deduplicated and split server-side into available/sold-out. Renders
// the SAME <ProjectCard> the /projects listing and AlternativesBlock use —
// see AlternativesBlock.tsx for why (a second hand-built card drifts over
// time) — compact (4-per-row), same as the sold-out project's alternatives
// strip. "use client" for the same reason AlternativesBlock is: projectsStrings(lang)
// returns function-valued fields that can't cross the server->client boundary
// as props.
//
// Two SEPARATE sections (available, then sold-out below), never one list with
// sold-out sorted last — the headline stays neutral ("Projects of {developer}"),
// no aggregate/realized-count claim, no completion-implying wording.
import { ProjectCard, type ProjectCardData } from "@/app/preview-projects/ProjectCard";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";

export type DeveloperProjectCardData = ProjectCardData & {
  // Development rows only — already localized server-side. Rendered as a
  // small label above the card, OUTSIDE it (never inside ProjectCard itself,
  // so /projects' own card look is untouched). null for legacy Sanity rows,
  // which carry no construction-stage data at all.
  stageLabel: string | null;
};

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

// Toggle for the staging review (2026-08-01): flip to false if the stage
// label reads as "some cards have a data gap" rather than "two independent
// facts" once legacy (no stage data) and Development cards sit side by side
// on a mixed page — see Aristo Developers staging preview.
const SHOW_STAGE_LABEL = true;

function CardWithStage({ c, s, lang }: { c: DeveloperProjectCardData; s: ReturnType<typeof projectsStrings>; lang: string }) {
  return (
    <div className="dev-catalog__item">
      {SHOW_STAGE_LABEL && c.stageLabel && <span className="dev-catalog__stage">{c.stageLabel}</span>}
      <ProjectCard c={c} s={s} locale={lang} compact />
    </div>
  );
}

export default function DeveloperProjectsGrid({
  available, soldOut, lang, developerName,
}: {
  available: DeveloperProjectCardData[];
  soldOut: DeveloperProjectCardData[];
  lang: string;
  developerName: string;
}) {
  const s = projectsStrings(lang);
  const headline = (HEADLINE[lang] ?? HEADLINE.en)(developerName);
  const soldOutHeading = SOLD_OUT_HEADING[lang] ?? SOLD_OUT_HEADING.en;

  return (
    <section className="pp-wrap pp-section dev-catalog" data-theme="dark">
      <h2 className="pp-h2">{headline}</h2>
      {available.length === 0 && soldOut.length === 0 ? (
        <p className="dev-catalog__empty">{EMPTY[lang] ?? EMPTY.en}</p>
      ) : (
        <>
          {available.length > 0 && (
            <div className="pp-alts__grid">
              {available.map((c) => <CardWithStage key={c.id} c={c} s={s} lang={lang} />)}
            </div>
          )}
          {soldOut.length > 0 && (
            <>
              <h3 className="h3 dev-catalog__sold-heading">{soldOutHeading}</h3>
              <div className="pp-alts__grid">
                {soldOut.map((c) => <CardWithStage key={c.id} c={c} s={s} lang={lang} />)}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
