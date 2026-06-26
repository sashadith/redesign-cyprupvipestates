import React, { FC } from "react";
import type { AboutBlock as AboutBlockType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

/* "This is Cyprus" — light ivory section. The brand icons sit inside gold
   medallions; "Cyprus" in the title gets the gold-italic ("quietly") accent. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

// wrap the word "Cyprus" in the gold-italic accent
const renderTitle = (title: string) =>
  title.split(/(Cyprus)/i).map((part, i) =>
    part.toLowerCase() === "cyprus" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

type Props = { aboutBlock: AboutBlockType };

const About: FC<Props> = ({ aboutBlock }) => {
  const { title, description, bullets } = aboutBlock;

  return (
    <section className="section is-light about">
      <div className="wrap">
        {title && <h2 className="about__title">{renderTitle(title)}</h2>}
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
