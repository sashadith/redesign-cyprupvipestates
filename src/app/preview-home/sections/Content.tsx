import React from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "@/app/components/RichText/RichText";
import type { TextContent, DoubleTextBlock } from "@/types/blog";

/* Content — the homepage's main SEO body. Understated light editorial section
   (placed after Case Studies): a simple 2-column grid of long-form text fields
   that mirrors the Description block's field grid — odd-last field spans the
   full width as a normal single-column block. Text-first for readability and
   expertise/trust; this is not a feature, so the doubleTextBlock images are
   intentionally not shown here. Reuses the shared RichText renderer + data. */

type Field = { key: string; content: unknown };

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
        <div className="content__grid">
          {fields.map((f) => (
            <div className="content__field" key={f.key}>
              <PortableText value={f.content} components={RichText} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
