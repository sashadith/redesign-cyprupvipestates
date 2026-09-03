import React from "react";
import { localizedHref } from "@/lib/locale";
import { HEADINGS } from "@/app/components/SectionLinks/SectionLinks";
import { renderClassicBlock, isSelfContained, isFlow, isClassicPage, headingOnlyText } from "./ClassicBlocks";
import { urlFor } from "@/sanity/sanity.client";
import ParallaxBand from "@/app/preview-home/sections/ParallaxBand";
import { getHomePageByLang } from "@/sanity/sanity.utils";

export { isClassicPage };

/* The body for the pages built from the classic block set — the 45 that the
   landing family's rebuild did not cover.

   Unlike the landing family, these pages have no shared block sequence: 45
   pages, 45 different orders. So there is no fixed layout to write. The body
   walks the blocks the CMS gives it, wraps each in the same section rhythm,
   and lets the block decide whether it wants the dark ground or the light
   reading surface. The clouds keep alternating across the dark sections, as
   they do on the landing pages. */
export default async function ClassicBody({
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
  /* The homepage's parallax band closes the page above the footer, exactly as
     it does there: same video under /uploads, same CMS image as its poster.
     getHomePageByLang is wrapped in React cache(), so this is deduplicated
     rather than a second query per render. */
  const home = await getHomePageByLang(lang).catch(() => null as any);
  const heroImage = (() => {
    const img = page.previewImage;
    if (!img) return null;
    if (typeof img === "string") return img;
    try { return urlFor(img).url(); } catch { return null; }
  })();

  // Counted over the dark sections only, so a light block in the middle does
  // not consume a turn and leave two clouds on the same side around it.
  let darkIndex = 0;

  return (
    <main className="pl" data-theme="dark">
      {/* No hero block exists in this set, so the page title carries the top.
          It is the h1 either way — the old renderer put it in PropertyIntro. */}
      {/* The same hero the landing family uses — full-bleed cover behind a
          scrim, title on it. Every one of these pages has a previewImage; the
          first version of this body ignored it and opened on a bare line of
          text. */}
      <header className={`iart__hero${heroImage ? " iart__hero--image" : ""}`}>
        {heroImage && (
          <div className="iart__hero-bg" aria-hidden="true">
            <img src={heroImage} alt="" fetchPriority="high" />
            <span className="iart__hero-scrim" />
          </div>
        )}
        <div className="wrap iart__hero-inner">
          <h1 className="iart__title">{page.title}</h1>
          {/* The site's own gold stripe with the light that sweeps along it
              every few seconds (.shimmer, from the home tokens) — the same
              divider the homepage sets under its section titles. */}
          <hr className="shimmer pl-hero__stripe" />
          {page.excerpt && <p className="pl-hero__lead">{page.excerpt}</p>}
        </div>
      </header>

      {(() => {
        /* Group the blocks before rendering. Consecutive running-text blocks
           become one section; a feature block (listings, facts, process, map)
           gets its own; FAQ and the form get the light surface. Rendering each
           block in its own full-height section — which is what this did first —
           turned a twelve-block page into twelve stacked panels, each with its
           own cloud, and read as an accordion of empty space. */
        type Group = { kind: "flow" | "feature" | "raw"; blocks: any[]; key: string; title?: string };
        const groups: Group[] = [];
        for (const block of blocks) {
          const type = String(block?._type ?? "");
          const key = block?._key ?? `${type}-${groups.length}`;
          const kind: Group["kind"] = isSelfContained(type) ? "raw" : isFlow(type) ? "flow" : "feature";
          const last = groups[groups.length - 1];

          /* A FAQ whose heading was authored as the prose block right above it
             (26 of these 45 pages did that, because the block's own title field
             was left empty). The heading is taken out of the prose and handed to
             the FAQ, so it sits above the section's stripe where it belongs
             instead of floating alone in its own dark band. */
          if (["faqBlock", "accordionBlock", "landingFaqBlock"].includes(type) && last?.kind === "flow") {
            const lifted = headingOnlyText(last.blocks[last.blocks.length - 1]);
            if (lifted) {
              last.blocks.pop();
              if (!last.blocks.length) groups.pop();
              groups.push({ kind, blocks: [block], key, title: lifted });
              continue;
            }
          }

          if (kind === "flow" && last && last.kind === "flow") last.blocks.push(block);
          else groups.push({ kind, blocks: [block], key });
        }

        // Counted over the dark groups only, so a light one in the middle does
        // not consume a turn and leave two clouds on the same side around it.
        let darkIndex = 0;

        return groups.map((g) => {
          // Rendered once and then tested — calling the renderer a second time
          // just to ask whether it produced anything would build every block
          // twice, the form component included.
          const rendered = g.blocks.map((b) => ({ key: b?._key ?? String(b?._type), node: renderClassicBlock(b, lang, ctaHref, g.title) }));
          if (rendered.every((r) => !r.node)) return null;
          const content = rendered.map((r) => <React.Fragment key={r.key}>{r.node}</React.Fragment>);

          // A homepage section brings its own <section> and background —
          // wrapping it again would nest a surface inside a surface.
          if (g.kind === "raw") return <React.Fragment key={g.key}>{content}</React.Fragment>;

          /* Only the FAQ paints clouds of its own (.faq::before / ::after, top-left
             and bottom-right); the borrowed form and medallion sections do not.
             So the cloud is dropped on the one dark section that runs into it,
             where two golden clouds otherwise stacked on the same corner. */
          const next = groups[groups.indexOf(g) + 1];
          const nextPaintsItsOwn = (next?.blocks ?? []).some((b: any) =>
            ["faqBlock", "accordionBlock", "landingFaqBlock"].includes(String(b?._type ?? "")),
          );
          const side = darkIndex++ % 2 === 0 ? "pl-atmos--left" : "pl-atmos--right";
          return (
            <section className={`pl__sec${g.kind === "flow" ? " pl__sec--flow" : ""}${nextPaintsItsOwn ? "" : ` pl-atmos ${side}`}`} key={g.key}>
              <div className={`pl__wrap${g.kind === "flow" ? " pl-flow" : ""}`}>{content}</div>
            </section>
          );
        });
      })()}

      {/* Order matches the homepage: FAQ, band, a light block, footer. */}
      <ParallaxBand image={home?.parallaxImage} videoSrc="/uploads/sunset.mp4" />

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
