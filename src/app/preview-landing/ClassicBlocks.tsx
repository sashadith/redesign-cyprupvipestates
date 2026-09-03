import React from "react";
import { renderInsightsBlock } from "@/app/preview-insights/insightsBlocks";
import Form from "@/app/preview-home/sections/Form";
import HowWeWorkSection from "@/app/preview-home/sections/HowWeWork";
import FaqSection from "@/app/preview-home/sections/Faq";
import LandingProjectsGrid from "./LandingProjectsGrid";
import FaqAccordion, { type FaqItem } from "@/app/preview-insights/FaqAccordion";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";
import { PortableText } from "@portabletext/react";
import PropertyMap from "@/app/preview-project/PropertyMap";
import { BULLETS_ICONS, BULLETS_TEXT, STEPS_ICONS, STEPS_TEXT, FAQ_TITLE } from "./blockCopy";

/* Renderers for the block set the remaining 45 pages are built from.

   Four of the seven types the audit found — textContent, doubleTextBlock,
   faqBlock and tableBlock — already have redesigned renderers in
   preview-insights, written for the article body. They are delegated to rather
   than rewritten, so a change to the article's typography reaches these pages
   too. What is implemented here is what the redesign had no equivalent for.

   Everything is a plain function of the block, mirroring renderInsightsBlock:
   the body decides section rhythm and background, a renderer only draws its
   own content. */

const DELEGATED = new Set(["textContent", "doubleTextBlock", "tableBlock", "imageFullBlock"]);

/** Every type this module can draw. A page qualifies for the redesigned body
    only when all of its blocks are in here — same rule as the landing family. */
export const CLASSIC_RENDERED = new Set(
  // Array.from rather than a spread: the build targets a version where
  // iterating a Set directly needs downlevelIteration.
  Array.from(DELEGATED).concat([
    "faqBlock",
    "accordionBlock",
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

/* Both fixed-content blocks map onto the homepage's HowWeWork section — the
   gold medallion row — because that is exactly their shape: an icon and a line
   of text, six times. Their items are not in the CMS (the block carries only a
   title), so the copy comes from blockCopy, and the section is handed the same
   structure the homepage gives it. */
function asStepsBlock(title: string, icons: string[], texts: string[]) {
  return {
    _key: "steps",
    _type: "howWeWorkBlock" as const,
    title,
    description: "",
    steps: texts.map((text, i) => ({ _key: String(i), _type: "steps" as const, icon: icons[i] as any, text })),
  };
}

export function renderClassicBlock(block: any, lang: string, ctaHref: string, titleOverride?: string): React.ReactNode {
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
      return <HowWeWorkSection block={asStepsBlock(block.title, BULLETS_ICONS, BULLETS_TEXT[lang] ?? BULLETS_TEXT.en) as any} variant="facts" />;

    case "howWeWorkBlock":
      return <HowWeWorkSection block={asStepsBlock(block.title, STEPS_ICONS, STEPS_TEXT[lang] ?? STEPS_TEXT.en) as any} />;

    case "buttonBlock":
      return block.buttonText ? (
        <div className="pl-btnrow">
          <a className="btn btn--glass" href={ctaHref}>{block.buttonText}</a>
        </div>
      ) : null;

    case "formMinimalBlock":
      // The homepage's own contact section — its own background, heading and
      // styling. The block's title is the editor's internal label ("Form
      // Minimal", "Form Final"), never customer copy, so nothing from the CMS
      // is passed through.
      return <Form lang={lang} />;

    case "faqBlock":
    case "accordionBlock":
    case "landingFaqBlock": {
      // The homepage's FAQ section, which brings its own surface and emits the
      // FAQPage schema. Its prop is nested one level deeper than the CMS block.
      const items = block?.faq?.items ?? block?.items ?? [];
      if (!items.length) return null;
      // titleOverride is the heading lifted out of the prose block above; the
      // block's own title is empty on nearly every one of these pages.
      const faqTitle = titleOverride || block.title || FAQ_TITLE[lang] || FAQ_TITLE.en;
      return <FaqSection section={{ faqTitle, faq: { faq: { items } } } as any} lang={lang} />;
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

/* Blocks rendered by a homepage section, which emits its own <section> with
   its own background. They must not be wrapped again — the body passes them
   through untouched. */
const SELF_CONTAINED = new Set(["faqBlock", "accordionBlock", "landingFaqBlock", "formMinimalBlock", "bulletsBlock", "howWeWorkBlock"]);
export const isSelfContained = (type: string): boolean => SELF_CONTAINED.has(type);

/* The text of a prose block that is nothing but a heading.

   These pages mostly left the FAQ block's own title empty and authored its
   heading as a separate text block just above it — which rendered as a lone
   line in its own dark section, disconnected from the FAQ it belongs to. When
   such a block sits directly before the FAQ, the body lifts it into the
   section instead of rendering it as prose. Returns null for anything else, so
   a real paragraph is never swallowed. */
export function headingOnlyText(block: any): string | null {
  if (String(block?._type ?? "") !== "textContent") return null;
  const nodes = Array.isArray(block.content) ? block.content : [];
  if (!nodes.length) return null;
  if (!nodes.every((n: any) => n?._type === "block" && /^h[23]$/.test(String(n?.style ?? "")))) return null;
  const text = nodes
    .flatMap((n: any) => (Array.isArray(n.children) ? n.children : []))
    .map((c: any) => String(c?.text ?? ""))
    .join("")
    .trim();
  return text || null;
}

/* Blocks that are running text rather than a feature of their own. Consecutive
   ones share a single section: giving each its own full-height section turned a
   twelve-block page into twelve stacked panels with a cloud on each, which read
   as an accordion of empty space instead of an article. */
const FLOW = new Set(["textContent", "doubleTextBlock", "buttonBlock", "tableBlock", "imageFullBlock"]);
export const isFlow = (type: string): boolean => FLOW.has(type);
