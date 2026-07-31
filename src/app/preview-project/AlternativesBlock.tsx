import { ProjectCard, type ProjectCardData } from "@/app/preview-projects/ProjectCard";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";

// Shared "similar projects" grid — prominent (under the sold-out banner) or
// quiet (further down an available project's page), same component and same
// ranking result either way, just a different heading/placement/CSS modifier
// from the caller. See developmentAlternatives.ts for the ranking logic.
//
// Renders the SAME <ProjectCard> component as the /projects listing (2026-07-31
// correction — an earlier version hand-built a second card here, which would
// have drifted from the listing card's look/hover behaviour over time). The
// only deliberate deviation is distances, dropped upstream in
// getAlternativeDevelopments — this component doesn't know or care why.
export default function AlternativesBlock({
  cards, lang, heading, prominent,
}: {
  cards: ProjectCardData[];
  lang: string;
  heading: string;
  prominent: boolean;
}) {
  if (!cards.length) return null;
  const s = projectsStrings(lang);
  return (
    <section className={`pp-wrap pp-section pp-alts${prominent ? " pp-alts--prominent" : " pp-alts--quiet"}`}>
      {!prominent && <h2 className="pp-h2">{heading}</h2>}
      <div className="px__grid">
        {cards.map((c) => (
          <ProjectCard key={c.id} c={c} active={false} onHover={() => {}} s={s} locale={lang} />
        ))}
      </div>
    </section>
  );
}
