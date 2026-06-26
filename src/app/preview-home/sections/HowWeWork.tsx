import React from "react";
import type { HowWeWorkBlock } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";

/* How We Work — light "process" section: an ordered list of numbered steps,
   each with its own icon in a gold medallion. Reuses the original data. */

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
    <section className="section is-light howwork">
      <div className="wrap">
        {title && <h2 className="howwork__title">{renderTitle(title)}</h2>}
        <hr className="shimmer howwork__stripe" />

        <ol className="wsteps">
          {steps.map((s, i) => {
            const icon = safeUrl(s.icon);
            return (
              <li className="wstep" key={s._key}>
                <span className="wstep__num">{String(i + 1).padStart(2, "0")}</span>
                <div className="wstep__medallion">{icon && <img src={icon} alt="" />}</div>
                {s.text && <p className="wstep__text">{s.text}</p>}
              </li>
            );
          })}
        </ol>

        {description && <p className="howwork__desc">{description}</p>}
      </div>
    </section>
  );
}
