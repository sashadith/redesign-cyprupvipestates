import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import type { DescriptionBlock } from "@/types/homepage";
import { RichText } from "@/app/components/RichText/RichText";

/* Description block — dark editorial section for the long-form SEO copy.
   Reuses the shared RichText PortableText renderer + the original data logic;
   only the layout/typography is restyled (no vertical side-stripes). */

const renderTitle = (title: string) =>
  title.split(/(Cyprus)/i).map((part, i) =>
    part.toLowerCase() === "cyprus" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

type Props = { block: DescriptionBlock };

const Description: FC<Props> = ({ block }) => {
  const { title, descriptionFields } = block;

  return (
    <section className="section descblock">
      <div className="wrap">
        {title && <h2 className="descblock__title">{renderTitle(title)}</h2>}
        <hr className="shimmer descblock__stripe" />

        <div className="descblock__grid">
          {descriptionFields?.map((field) => (
            <div className="descblock__field" key={field._key}>
              <PortableText value={field.descriptionField} components={RichText} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Description;
