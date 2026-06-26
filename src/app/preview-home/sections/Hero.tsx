import React, { FC } from "react";
import type { HeroBlock } from "@/types/homepage";
import HeroVideoSection from "@/app/components/HeroVideoSection/HeroVideoSection";

/* Restyled homepage hero (preview). Same data + media as the live hero; only the
   presentation changes. Structure preserved: one <h1> with the brand line + title.
   Hero stays dark in both themes. */

type Props = { heroBlock: HeroBlock };

const Hero: FC<Props> = ({ heroBlock }) => {
  const {
    video,
    posterImage,
    heroTitle,
    heroDescription,
    type,
    linkLabel,
    linkDestination,
    buttonLabel,
  } = heroBlock;

  const projectsLabel = (type === "link" ? linkLabel : buttonLabel) || "View All Projects";
  const projectsHref = type === "link" ? linkDestination : undefined;

  return (
    <section className="hero">
      <div className="hero__media">
        <HeroVideoSection
          video={video}
          posterImage={posterImage}
          heroTitle={heroTitle}
        />
      </div>
      <div className="hero__scrim" aria-hidden />

      <div className="hero__inner wrap">
        <h1 className="hero__title">
          <span className="hero__brand">Cyprus VIP Estates</span>
          Cyprus <span className="it">Property</span> Experts
        </h1>

        <hr className="shimmer hero__stripe" />

        {heroDescription && <p className="hero__desc">{heroDescription}</p>}

        <div className="hero__cta">
          <a className="btn btn--glass" href={projectsHref || "#"}>
            <span>{projectsLabel}</span>
          </a>
          <a className="btn btn--glass" href="#">
            <span>Get Consultation</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
