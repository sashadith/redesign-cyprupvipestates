import React from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "@/app/components/RichText/RichText";
import { urlFor } from "@/sanity/sanity.client";
import type { TextContent, DoubleTextBlock, ContentChoice } from "@/types/blog";

/* Content — the homepage's main SEO body, rebuilt as ONE cohesive light
   editorial section. The design type system replaces the author's raw
   per-block colours; structure (two-column, text+image, callouts) is preserved
   via design tokens. All text + heading structure is kept (SEO untouched).
   Reuses the shared RichText PortableText renderer. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

// an author background that isn't white/transparent = a "callout" intent
const isCallout = (c?: string) => {
  if (!c) return false;
  const v = c.trim().toLowerCase();
  return v !== "" && v !== "transparent" && v !== "#fff" && v !== "#ffffff" && v !== "white";
};

function TextBlock({ block }: { block: TextContent }) {
  const callout = isCallout(block.backgroundColor) || isCallout(block.backgroundFull);
  return (
    <div className={`content__block ${callout ? "content__block--callout" : ""}`}>
      <PortableText value={block.content} components={RichText} />
    </div>
  );
}

function Side({ content }: { content?: ContentChoice }) {
  if (!content) return null;
  if (content.type === "text" && content.blockContent) {
    const callout = isCallout(content.blockContent.backgroundColor);
    return (
      <div className={`content__side ${callout ? "content__side--callout" : ""}`}>
        <PortableText value={content.blockContent.content} components={RichText} />
      </div>
    );
  }
  if (content.type === "image" && content.image) {
    const img = safeUrl(content.image);
    return (
      <div className="content__side content__side--img">
        {img && <img src={img} alt={content.image.alt || ""} />}
      </div>
    );
  }
  return null;
}

function DoubleBlock({ block }: { block: DoubleTextBlock }) {
  return (
    <div className="content__block content__block--wide">
      <div className="content__two">
        <Side content={block.leftContent} />
        <Side content={block.rightContent} />
      </div>
    </div>
  );
}

export default function Content({ blocks }: { blocks?: Array<TextContent | DoubleTextBlock> }) {
  if (!blocks?.length) return null;

  return (
    <section className="section is-light content">
      <div className="wrap">
        <div className="content__inner">
          {blocks.map((b) => {
            if (b._type === "textContent") return <TextBlock key={b._key} block={b as TextContent} />;
            if (b._type === "doubleTextBlock") return <DoubleBlock key={b._key} block={b as DoubleTextBlock} />;
            return null;
          })}
        </div>
      </div>
    </section>
  );
}
