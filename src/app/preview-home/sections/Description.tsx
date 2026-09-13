import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import type { DescriptionBlock } from "@/types/homepage";
import { RichText } from "@/app/components/RichText/RichText";
import { highlightAccents } from "./highlightAccents";
import type { Locale } from "@/lib/locale";

/* Description block — dark editorial section for the long-form SEO copy.
   Reuses the shared RichText PortableText renderer + the original data logic;
   only the layout/typography is restyled (no vertical side-stripes). */

// DE/PL/RU (2026-09-07 fix): see highlightAccents.tsx — the split() below
// only ever matched the literal English word "We", so translated titles
// rendered with no highlight at all.
const ACCENTS_BY_LANG: Partial<Record<Locale, string[]>> = {
  de: ["wir"],
  pl: ["nas"],
  ru: ["нас"],
  // WP3 Pass B #4: the bound pronoun `בנו` alone is a 3-letter fragment in
  // gold italics (and, being 3 letters, a substring-collision risk) — the
  // verb+pronoun pair carries the statement.
  he: ["בוחרים בנו"], // REVIEW(he); Hebrew H2: "למה רוכשים מישראל בוחרים בנו"
};

const renderTitle = (title: string, lang: string) => {
  if (lang !== "en" && ACCENTS_BY_LANG[lang as Locale]) {
    return highlightAccents(title, ACCENTS_BY_LANG[lang as Locale]!);
  }
  return title.split(/(\bWe\b)/i).map((part, i) =>
    /^we$/i.test(part) ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

type Props = { block: DescriptionBlock; lang?: string };

const Description: FC<Props> = ({ block, lang = "en" }) => {
  const { title, descriptionFields } = block;

  return (
    <section className="section descblock">
      <div className="wrap">
        {title && <h2 className="descblock__title">{renderTitle(title.replace(/Who We Are/i, "Who we are"), lang)}</h2>}
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
