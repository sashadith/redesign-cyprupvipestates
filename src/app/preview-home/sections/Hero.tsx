import React, { FC } from "react";
import type { HeroBlock } from "@/types/homepage";
import HeroVideoSection from "@/app/components/HeroVideoSection/HeroVideoSection";
import { homeStrings } from "./homeI18n";

/* Restyled homepage hero (preview). Same data + media as the live hero; only the
   presentation changes. Structure preserved: one <h1> with the brand line + title.
   Hero stays dark in both themes. `consultCta` lets production inject the brochure
   modal button; the preview falls back to a plain link. */

type Props = { heroBlock: HeroBlock; lang?: string; consultCta?: React.ReactNode };

const Hero: FC<Props> = ({ heroBlock, lang = "en", consultCta }) => {
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
  const t = homeStrings(lang);

  const projectsLabel = (type === "link" ? linkLabel : buttonLabel) || t.viewAllProjects;
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
          <span className="hero__headline">{t.heroLine1}<span className="it">{t.heroAccent}</span>{t.heroLine2}</span>
        </h1>

        <hr className="shimmer hero__stripe" />

        {heroDescription && <p className="hero__desc">{heroDescription}</p>}

        <div className="hero__cta">
          <a className="btn btn--glass" href={projectsHref || "#"}>
            <span>{projectsLabel}</span>
          </a>
          {consultCta ?? (
            <a className="btn btn--glass" href="#">
              <span>{t.getConsultation}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
