import React from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "@/app/components/RichText/RichText";
import type { TextContent, DoubleTextBlock } from "@/types/blog";

/* Content — the homepage's main SEO body, redesigned as an editorial "guide":
   a sticky section header (generated title + stripe + lead) beside a single-column
   article that reads top-to-bottom. The article's own leading H2 is hidden via CSS
   (the section title replaces it). Reuses the shared RichText renderer + the
   original field data; copy is untouched. */

const TITLE = "Your Guide to Property in Cyprus";
const LEAD =
  "What to know before you buy — the regions, the property types, the process for international clients, and where the long-term value lies.";

const renderTitle = (title: string) =>
  title.split(/(Cyprus)/i).map((part, i) =>
    part.toLowerCase() === "cyprus" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

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

export default function Content({ blocks }: { blocks?: Array<TextContent | DoubleTextBlock> }) {
  if (!blocks?.length) return null;
  const fields = collectFields(blocks);
  if (!fields.length) return null;

  return (
    <section className="section is-light content">
      <div className="wrap">
        <div className="content__layout">
          <header className="content__head">
            <h2 className="content__title">{renderTitle(TITLE)}</h2>
            <hr className="shimmer content__stripe" />
            <p className="content__lead">{LEAD}</p>
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
