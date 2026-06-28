import React from "react";
import type { HowWeWorkBlock } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

/* How We Work — reuses the About layout (title + stripe + description + a row
   of gold medallions with text). Reuses the original data. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const renderTitle = (title: string) =>
  title.split(/(\bWe\b)/i).map((part, i) =>
    /^we$/i.test(part) ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export default function HowWeWork({ block }: { block: HowWeWorkBlock }) {
  if (!block || !block.steps?.length) return null;
  const { title, steps, description } = block;

  return (
    <section className="section is-light about howwork">
      <div className="wrap">
        {title && <h2 className="about__title">{renderTitle(title)}</h2>}
        <hr className="shimmer about__stripe" />

        {description && <p className="about__desc">{description}</p>}

        <ul className="about__bullets">
          {steps.map((s) => {
            const icon = safeUrl(s.icon);
            return (
              <li className="about__bullet" key={s._key}>
                <span className="about__medallion">{icon && <img src={icon} alt="" />}</span>
                {s.text && <span className="about__bullet-text">{s.text.replace(/\s*ceremoniously/i, "")}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
