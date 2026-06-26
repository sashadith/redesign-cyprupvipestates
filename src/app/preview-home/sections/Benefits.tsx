import React from "react";
import type { BenefitsBlock } from "@/types/homepage";
import CountNumber from "@/app/components/CountNumber/CountNumber";

/* Benefits — dark "stats band": animated count-up numbers + label + note.
   Reuses the existing CountNumber counter and the original data. */

const renderTitle = (title: string) =>
  title.split(/(Cyprus)/i).map((part, i) =>
    part.toLowerCase() === "cyprus" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

export default function Benefits({ block }: { block: BenefitsBlock }) {
  if (!block || !block.benefits?.length) return null;
  const { title, benefits } = block;

  return (
    <section className="section benefits">
      <div className="wrap">
        {title && (
          <>
            <h2 className="benefits__title">{renderTitle(title)}</h2>
            <hr className="shimmer benefits__stripe" />
          </>
        )}

        <div className="benefits__grid">
          {benefits.map((b) => (
            <div className="bstat" key={b._key}>
              <p className="bstat__num">
                <CountNumber>{b.counting?.conuntNumber ?? 0}</CountNumber>
                {b.counting?.sign && <span className="bstat__sign">{b.counting.sign}</span>}
              </p>
              {b.title && <p className="bstat__title">{b.title}</p>}
              {b.description && <p className="bstat__desc">{b.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
