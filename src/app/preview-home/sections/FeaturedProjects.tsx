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

const FeaturedProjects: FC<Props> = ({ block, lang }) => {
  return (
    <section className="section featured">
      <div className="wrap">
        {block.title && <h2 className="featured__title">{renderTitle(block.title)}</h2>}
        <hr className="shimmer featured__stripe" />
        {block.description && <p className="featured__desc">{block.description}</p>}

        {block.projects?.length > 0 && (
          <div className="featured__slider">
            <FeaturedSlider projects={block.projects} lang={lang} />
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedProjects;
