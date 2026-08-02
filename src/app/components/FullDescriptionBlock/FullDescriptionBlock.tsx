import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";

// Bündel 3 Teil 2 (2026-08-02) — restyled to "the current state of the page":
// reuses the blog article's own PortableText component map (insightsComponents,
// insightsBlocks.tsx) rather than a second typography system — same .iart__h2/
// .iart__h3/.iart__p classes, same drop-cap on the first paragraph
// (.iart__content > .iart__rich, matching the blog article's own nesting),
// two-column layout (.dev-catalog__seo-col, developer-catalog.css) — a single
// ~68ch column left most of this wide dark section empty. Content is
// untouched, never truncated: full portable text, every developer.
//
// Every developer's description carries dozens of manually-authored BLANK
// paragraph blocks as spacers between headings/paragraphs/lists (2026-08-02
// analysis: ~63% of all "paragraph" blocks across all 22 developers are
// empty — e.g. Aristo Developers has 43, only 15 with actual text). Each one
// still got .iart__p's own margin, so real content was spaced TWICE over.
// Dropped before rendering — real content is completely unaffected, only the
// redundant blank blocks are gone.
const hasVisibleText = (block: any): boolean => {
  if (block?._type !== "block") return true; // non-text blocks (images) always kept
  const children = Array.isArray(block.children) ? block.children : [];
  return children.some((c: any) => typeof c?.text === "string" && c.text.trim().length > 0);
};

type Props = {
  description: any;
};

const FullDescriptionBlock: FC<Props> = ({ description }) => {
  if (!description) return null;
  const blocks = Array.isArray(description) ? description.filter(hasVisibleText) : description;
  return (
    <section className="pp-wrap pp-section dev-catalog__seo" data-theme="dark">
      <div className="iart__content dev-catalog__seo-col">
        <div className="iart__rich">
          <PortableText value={blocks} components={insightsComponents as any} />
        </div>
      </div>
    </section>
  );
};

export default FullDescriptionBlock;
