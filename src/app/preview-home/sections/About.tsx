import React, { FC } from "react";
import type { AboutBlock as AboutBlockType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";
import { highlightAccents } from "./highlightAccents";

/* "This is Cyprus" — light ivory section. The brand icons sit inside gold
   medallions; "Cyprus" in the title gets the gold-italic ("quietly") accent. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

// DE/PL/RU (2026-09-07 fix): EN's title gets a code-side rewrite ("This is
// Cyprus" -> "There is Only One Cyprus") that DE/PL/RU never received —
// their titles are still the plain "This is Cyprus" translation, so there's
// no "only one"-equivalent phrase to highlight. Highlighting the country
// name instead, matching what's actually in the title today.
const ACCENTS_BY_LANG: Record<string, string[]> = {
  de: ["Zypern"],
  pl: ["Cyprze"],
  ru: ["Кипре"],
};

// wrap the word "Cyprus" in the gold-italic accent
const renderTitle = (title: string, lang: string) => {
  if (lang !== "en" && ACCENTS_BY_LANG[lang]) {
    return highlightAccents(title, ACCENTS_BY_LANG[lang]);
  }
  return title.split(/(Only One)/i).map((part, i) =>
    part.toLowerCase() === "only one" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

type Props = { aboutBlock: AboutBlockType; lang?: string };

const About: FC<Props> = ({ aboutBlock, lang = "en" }) => {
  const { title, description, bullets } = aboutBlock;

  return (
    <section className="section is-light about">
      <div className="wrap">
        {title && <h2 className="about__title">{renderTitle(title.replace(/This is Cyprus/i, "There is Only One Cyprus"), lang)}</h2>}
        <hr className="shimmer about__stripe" />

        {description && <p className="about__desc">{description}</p>}

        {bullets?.length > 0 && (
          <ul className="about__bullets">
            {bullets.map((b) => {
              const icon = safeUrl(b.image);
              return (
                <li className="about__bullet" key={b._key}>
                  <span className="about__medallion">
                    {icon && <img src={icon} alt="" />}
                  </span>
                  <span className="about__bullet-text">{b.description}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default About;
