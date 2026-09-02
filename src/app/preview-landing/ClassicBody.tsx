import React from "react";
import { localizedHref } from "@/lib/locale";
import { HEADINGS } from "@/app/components/SectionLinks/SectionLinks";
import { renderClassicBlock, wantsLight, isClassicPage } from "./ClassicBlocks";

export { isClassicPage };

/* The body for the pages built from the classic block set — the 45 that the
   landing family's rebuild did not cover.

   Unlike the landing family, these pages have no shared block sequence: 45
   pages, 45 different orders. So there is no fixed layout to write. The body
   walks the blocks the CMS gives it, wraps each in the same section rhythm,
   and lets the block decide whether it wants the dark ground or the light
   reading surface. The clouds keep alternating across the dark sections, as
   they do on the landing pages. */
export default function ClassicBody({
  page,
  lang,
  relatedLinks = [],
}: {
  page: any;
  lang: string;
  relatedLinks?: { title: string; href: string }[];
}) {
  const blocks: any[] = Array.isArray(page.contentBlocks) ? page.contentBlocks : [];
  const ctaHref = `${localizedHref(lang)}/contacts`;

  // Counted over the dark sections only, so a light block in the middle does
  // not consume a turn and leave two clouds on the same side around it.
  let darkIndex = 0;

  return (
    <main className="pl" data-theme="dark">
      {/* No hero block exists in this set, so the page title carries the top.
          It is the h1 either way — the old renderer put it in PropertyIntro. */}
      <header className="pl__wrap pl-title">
        <h1 className="pl-title__h">{page.title}</h1>
        {page.excerpt && <p className="pl-hero__lead">{page.excerpt}</p>}
      </header>

      {blocks.map((block) => {
        const type = String(block?._type ?? "");
        const content = renderClassicBlock(block, lang, ctaHref);
        if (!content) return null;

        if (wantsLight(type)) {
          return (
            <div className="section is-light" key={block._key ?? type}>
              <div className="pl__wrap">{content}</div>
            </div>
          );
        }

        const side = darkIndex++ % 2 === 0 ? "pl-atmos--left" : "pl-atmos--right";
        return (
          <section className={`pl__sec pl-atmos ${side}`} key={block._key ?? type}>
            <div className="pl__wrap">{content}</div>
          </section>
        );
      })}

      {relatedLinks.length > 0 && (
        <div className="section is-light">
          <div className="pl__wrap pl-links">
            <h2 className="pl__h2">{HEADINGS.related?.[lang] ?? HEADINGS.related.en}</h2>
            <ul className="pl-links__list">
              {relatedLinks.map((l) => (
                <li key={l.href}>
                  <a className="pl-links__item" href={l.href}>{l.title}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
