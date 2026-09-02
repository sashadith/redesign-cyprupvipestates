import React from "react";
import { renderInsightsBlock } from "@/app/preview-insights/insightsBlocks";
import FormMinimalBlockComponent from "@/app/components/FormMinimalBlockComponent/FormMinimalBlockComponent";
import LandingProjectsGrid from "./LandingProjectsGrid";
import FaqAccordion, { type FaqItem } from "@/app/preview-insights/FaqAccordion";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";
import { PortableText } from "@portabletext/react";
import PropertyMap from "@/app/preview-project/PropertyMap";
import { BULLETS_ICONS, BULLETS_TEXT, STEPS_ICONS, STEPS_TEXT } from "./blockCopy";

/* Renderers for the block set the remaining 45 pages are built from.

   Four of the seven types the audit found — textContent, doubleTextBlock,
   faqBlock and tableBlock — already have redesigned renderers in
   preview-insights, written for the article body. They are delegated to rather
   than rewritten, so a change to the article's typography reaches these pages
   too. What is implemented here is what the redesign had no equivalent for.

   Everything is a plain function of the block, mirroring renderInsightsBlock:
   the body decides section rhythm and background, a renderer only draws its
   own content. */

const DELEGATED = new Set(["textContent", "doubleTextBlock", "faqBlock", "accordionBlock", "tableBlock", "imageFullBlock"]);

/** Every type this module can draw. A page qualifies for the redesigned body
    only when all of its blocks are in here — same rule as the landing family. */
export const CLASSIC_RENDERED = new Set(
  // Array.from rather than a spread: the build targets a version where
  // iterating a Set directly needs downlevelIteration.
  Array.from(DELEGATED).concat([
    "projectsSectionBlock",
    "formMinimalBlock",
    "bulletsBlock",
    "howWeWorkBlock",
    "buttonBlock",
    "landingFaqBlock",
    "locationBlock",
  ]),
);

export function isClassicPage(blocks: any[]): boolean {
  const types = (Array.isArray(blocks) ? blocks : []).map((b) => String(b?._type ?? "")).filter(Boolean);
  if (!types.length) return false;
  return types.every((t) => CLASSIC_RENDERED.has(t));
}

/* The six-item "why Cyprus" grid. Its items are not in the CMS — the block
   carries a title and nothing else — so the copy comes from blockCopy, the
   same source the old component now reads. */
function Bullets({ block, lang }: { block: any; lang: string }) {
  const items = BULLETS_TEXT[lang] ?? BULLETS_TEXT.en;
  return (
    <>
      {block.title && <h2 className="pl__h2 pl__h2--center">{block.title}</h2>}
      <ul className="pl-bullets">
        {items.map((text, i) => (
          <li className="pl-bullets__item" key={i}>
            {BULLETS_ICONS[i] && <img className="pl-bullets__icon" src={BULLETS_ICONS[i]} alt="" loading="lazy" />}
            <span className="pl-bullets__text">{text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* The process. Unlike the bullets, order carries meaning here — these are
   consecutive steps — so they are numbered, and the number is the marker
   rather than a decorative counter. */
function HowWeWork({ block, lang }: { block: any; lang: string }) {
  const items = STEPS_TEXT[lang] ?? STEPS_TEXT.en;
  return (
    <>
      {block.title && <h2 className="pl__h2 pl__h2--center">{block.title}</h2>}
      <ol className="pl-steps">
        {items.map((text, i) => (
          <li className="pl-steps__item" key={i}>
            <span className="pl-steps__n" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            {STEPS_ICONS[i] && <img className="pl-steps__icon" src={STEPS_ICONS[i]} alt="" loading="lazy" />}
            <span className="pl-steps__text">{text}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function renderClassicBlock(block: any, lang: string, ctaHref: string): React.ReactNode {
  const type = String(block?._type ?? "");

  if (DELEGATED.has(type)) return renderInsightsBlock(block);

  switch (type) {
    case "projectsSectionBlock": {
      // Same precedence the live block uses: a pinned list wins over the query.
      const manual = Array.isArray(block.projects) ? block.projects : [];
      const filtered = Array.isArray(block.filteredProjects) ? block.filteredProjects : [];
      const projects = manual.length > 0 ? manual : filtered;
      if (!projects.length) return null;
      return (
        <>
          {block.title && <h2 className="pl__h2 pl__h2--center">{block.title}</h2>}
          <LandingProjectsGrid projects={projects} lang={lang} />
        </>
      );
    }

    case "bulletsBlock":
      return <Bullets block={block} lang={lang} />;

    case "howWeWorkBlock":
      return <HowWeWork block={block} lang={lang} />;

    case "buttonBlock":
      return block.buttonText ? (
        <div className="pl-btnrow">
          <a className="btn btn--glass" href={ctaHref}>{block.buttonText}</a>
        </div>
      ) : null;

    case "formMinimalBlock":
      // The real lead form, reused rather than rebuilt — it posts to the CRM,
      // and the blog already embeds this same component inside the redesign.
      return (
        <>
          {block.title && <h2 className="pl__h2 pl__h2--center">{block.title}</h2>}
          <FormMinimalBlockComponent form={block.form} lang={lang} offerButtonCustomText={block.buttonText} />
        </>
      );

    case "landingFaqBlock": {
      // Same accordion as the landing family's FAQ, and the same shape —
      // { faq: { items: [{ question, answer }] } } with answer as Portable Text.
      const items: FaqItem[] = (block?.faq?.items ?? []).map((it: any, i: number) => ({
        key: it?._key ?? `faq-${i}`,
        question: it?.question ?? "",
        answer: Array.isArray(it?.answer)
          ? <PortableText value={it.answer} components={insightsComponents as any} />
          : <p className="pl-prose">{it?.answer ?? ""}</p>,
      }));
      if (!items.length) return null;
      return (
        <>
          {block.title && <h2 className="pl__h2">{block.title}</h2>}
          <FaqAccordion items={items} />
        </>
      );
    }

    case "locationBlock": {
      // The redesigned MapLibre map, the same one the project pages use —
      // not the old raster map this block used to render.
      const lat = block?.location?.lat;
      const lng = block?.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return (
        <>
          {block.title && <h2 className="pl__h2 pl__h2--center">{block.title}</h2>}
          <div className="pl-map">
            <PropertyMap lat={lat} lng={lng} locale={lang} />
          </div>
        </>
      );
    }

    default:
      return null;
  }
}

/** True when the block wants the light reading surface rather than the dark one. */
export function wantsLight(type: string): boolean {
  return type === "faqBlock" || type === "accordionBlock" || type === "landingFaqBlock" || type === "formMinimalBlock";
}
