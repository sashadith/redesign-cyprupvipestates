import React, { FC } from "react";
import type { FeaturedProjectsBlock } from "@/types/homepage";
import FeaturedSlider from "./FeaturedSlider";

/* Featured Real Estate Projects — dark section: title + description + an
   auto-playing carousel of restyled project cards. */

const renderTitle = (title: string) =>
  title.split(/(Real Estate|Projects)/i).map((part, i) => {
    const p = part.toLowerCase();
    return p === "real estate" || p === "projects" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });

type Props = { block: FeaturedProjectsBlock; lang: string };

const MAX_FEATURED = 6;

// Curated, deduplicated (by _id) and capped at MAX_FEATURED — the CMS list can
// carry more than the card design is meant to show; enforce the cap here so
// it can't silently drift back to a longer carousel.
const dedupedProjects = (projects: FeaturedProjectsBlock["projects"]) => {
  const seen = new Set<string>();
  const out: FeaturedProjectsBlock["projects"] = [];
  for (const p of projects ?? []) {
    if (!p?._id || seen.has(p._id)) continue;
    seen.add(p._id);
    out.push(p);
    if (out.length >= MAX_FEATURED) break;
  }
  return out;
};

const FeaturedProjects: FC<Props> = ({ block, lang }) => {
  const projects = dedupedProjects(block.projects);
  return (
    <section className="section featured">
      <div className="wrap">
        {block.title && <h2 className="featured__title">{renderTitle(block.title)}</h2>}
        <hr className="shimmer featured__stripe" />
        {block.description && <p className="featured__desc">{block.description}</p>}

        {projects.length > 0 && (
          <div className="featured__slider">
            <FeaturedSlider projects={projects} lang={lang} />
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedProjects;
