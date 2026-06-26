import React, { FC } from "react";
import type { CitiesBlock } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

/* "Properties by Location" — light ivory section: a grid of city tiles
   (image + name), each linking to that location. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const ACCENT_PHRASE = "Properties for Sale in Cyprus";

/* Highlight the "Properties for Sale in Cyprus" phrase with the gold accent.
   Falls back to highlighting just "Cyprus" if the phrase isn't present
   (e.g. translated headings). */
const renderTitle = (title: string) => {
  const idx = title.toLowerCase().indexOf(ACCENT_PHRASE.toLowerCase());
  if (idx === -1) {
    return title.split(/(Cyprus)/i).map((part, i) =>
      part.toLowerCase() === "cyprus" ? (
        <span key={i} className="it">{part}</span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  }
  return (
    <>
      {title.slice(0, idx)}
      <span className="it">{title.slice(idx, idx + ACCENT_PHRASE.length)}</span>
      {title.slice(idx + ACCENT_PHRASE.length)}
    </>
  );
};

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Props = { block: CitiesBlock };

const Cities: FC<Props> = ({ block }) => {
  const { title, cities } = block;

  return (
    <section className="section is-light cities">
      <div className="wrap">
        {title && <h2 className="cities__title">{renderTitle(title)}</h2>}
        <hr className="shimmer cities__stripe" />

        {cities?.length > 0 && (
          <div className="cities__grid">
            {cities.map((c) => {
              const img = safeUrl(c.image);
              return (
                <a key={c._key} className="ccard" href={c.link || "#"}>
                  <div className="ccard__media">{img && <img src={img} alt={c.image?.alt || c.city} />}</div>
                  <div className="ccard__shade" />
                  <div className="ccard__label">
                    <h3 className="ccard__name">{c.city}</h3>
                    <span className="ccard__arrow"><Arrow /></span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default Cities;
