import React, { FC } from "react";
import type { Brochure as BrochureType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

/* Restyled "brochure" band — DARK card matching the original structure:
   content on the left, the image tilted -5deg behind it, anchored bottom-right.
   Same data; V5 presentation (Fraunces, gold accents, our dark green panel). */

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12.5l4.3 4.3L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

type Props = { brochure: BrochureType; cta?: React.ReactNode };

const Brochure: FC<Props> = ({ brochure, cta }) => {
  const { logo, title, subtitle, description, list, buttonLabel, image } = brochure;
  const logoUrl = safeUrl(logo);
  const imageUrl = safeUrl(image);

  return (
    <section className="brochure">
      <div className="wrap">
        <div className="brochure__card">
          <div className="brochure__content">
            <div className="brochure__start">
              {logoUrl && <img className="brochure__logo" src={logoUrl} alt="" />}
              <div className="brochure__start-text">
                <h2 className="brochure__title">{title}</h2>
                {subtitle && <p className="brochure__subtitle">{subtitle}</p>}
              </div>
            </div>

            {description && <p className="brochure__desc">{description}</p>}

            {list?.length > 0 && (
              <ul className="brochure__list">
                {list.map((item, i) => (
                  <li key={i}>
                    <Check />
                    <span>{item.listItem}</span>
                  </li>
                ))}
              </ul>
            )}

            {buttonLabel && (
              <div className="brochure__cta">
                {cta ?? <a className="btn btn--primary" href="#"><span>{buttonLabel}</span></a>}
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="brochure__image">
              <img className="brochure__media" src={imageUrl} alt={title} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Brochure;
