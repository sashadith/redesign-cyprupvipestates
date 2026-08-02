import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";

// Bündel 3 Teil 2 (2026-08-02) — restyled to "the current state of the page":
// reuses the blog article's own PortableText component map (insightsComponents,
// insightsBlocks.tsx) rather than a second typography system — same .iart__h2/
// .iart__h3/.iart__p classes, same drop-cap on the first paragraph
// (.iart__rich wrapper), single reading column, no table of contents (this
// content runs ~6-7 h2 over 3.4k-6.3k characters — too short to justify one).
// Content is untouched, never truncated: full portable text, every developer.
type Props = {
  description: any;
};

const FullDescriptionBlock: FC<Props> = ({ description }) => {
  if (!description) return null;
  return (
    <section className="pp-wrap pp-section dev-catalog__seo" data-theme="dark">
      <div className="iart__rich dev-catalog__seo-col">
        <PortableText value={description} components={insightsComponents as any} />
      </div>
    </section>
  );
};

export default FullDescriptionBlock;
