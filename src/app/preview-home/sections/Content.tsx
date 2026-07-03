import React from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "@/app/components/RichText/RichText";
import type { TextContent, DoubleTextBlock } from "@/types/blog";
import { homeStrings } from "./homeI18n";

/* Content — the homepage's main SEO body, redesigned as an editorial "guide":
   a sticky section header (generated title + stripe + lead) beside a single-column
   article that reads top-to-bottom. The article's own leading H2 is hidden via CSS
   (the section title replaces it). Reuses the shared RichText renderer + the
   original field data; copy is untouched. */

// Gold-accent the last word of the (localized) title.
const renderTitle = (title: string) => {
  const words = title.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const lead = words.join(" ");
  return (
    <>
      {lead ? `${lead} ` : ""}
      <span className="it">{last}</span>
    </>
  );
};

type Field = { key: string; content: any };

function collectFields(blocks: Array<TextContent | DoubleTextBlock>): Field[] {
  const fields: Field[] = [];
  for (const b of blocks) {
    if (b._type === "textContent" && (b as TextContent).content) {
      fields.push({ key: b._key, content: (b as TextContent).content });
    } else if (b._type === "doubleTextBlock") {
      const d = b as DoubleTextBlock;
      [d.leftContent, d.rightContent].forEach((c, i) => {
        if (c?.type === "text" && c.blockContent?.content) {
          fields.push({ key: `${b._key}-${i}`, content: c.blockContent.content });
        }
      });
    }
  }
  return fields;
}

export default function Content({ blocks, lang = "en" }: { blocks?: Array<TextContent | DoubleTextBlock>; lang?: string }) {
  if (!blocks?.length) return null;
  const fields = collectFields(blocks);
  if (!fields.length) return null;
  const t = homeStrings(lang);

  return (
    <section className="section is-light content">
      <div className="wrap">
        <div className="content__layout">
          <header className="content__head">
            <h2 className="content__title">{renderTitle(t.contentTitle)}</h2>
            <hr className="shimmer content__stripe" />
            <p className="content__lead">{t.contentLead}</p>
          </header>

          <div className="content__body">
            {fields.map((f) => (
              <div className="content__field" key={f.key}>
                <PortableText value={f.content} components={RichText} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
