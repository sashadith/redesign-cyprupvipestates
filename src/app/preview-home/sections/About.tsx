import React, { FC } from "react";
import type { AboutBlock as AboutBlockType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";
import { localePrefix } from "@/lib/locale";
import { homeStrings } from "./homeI18n";

/* "This is Cyprus" — light ivory section, trimmed to a compact single row of
   3 value props (one line each); the full description + all bullets live at
   /about-us (see src/app/[lang]/about-us/page.tsx), which keeps this content's
   SEO home without lengthening the homepage. */

const MAX_HOME_BULLETS = 3;

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

// wrap the word "Cyprus" in the gold-italic accent
const renderTitle = (title: string) =>
  title.split(/(Only One)/i).map((part, i) =>
    part.toLowerCase() === "only one" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

type Props = { aboutBlock: AboutBlockType; lang?: string };

const About: FC<Props> = ({ aboutBlock, lang = "en" }) => {
  const { title, bullets } = aboutBlock;
  const t = homeStrings(lang);
  const compactBullets = bullets?.slice(0, MAX_HOME_BULLETS);

  return (
    <section className="section is-light about">
      <div className="wrap">
        {title && <h2 className="about__title">{renderTitle(title.replace(/This is Cyprus/i, "There is Only One Cyprus"))}</h2>}
        <hr className="shimmer about__stripe" />

        {compactBullets && compactBullets.length > 0 && (
          <ul className="about__bullets about__bullets--compact">
            {compactBullets.map((b) => {
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

        <a className="btn btn--ghost about__more" href={`${localePrefix(lang)}/about-us`}>
          {t.aboutMoreLabel}
        </a>
      </div>
    </section>
  );
};

export default About;
