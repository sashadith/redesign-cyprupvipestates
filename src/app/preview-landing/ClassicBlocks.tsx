import React from "react";
import { renderInsightsBlock } from "@/app/preview-insights/insightsBlocks";
import type { Locale } from "@/lib/locale";
import Form from "@/app/preview-home/sections/Form";
import HowWeWorkSection from "@/app/preview-home/sections/HowWeWork";
import FaqSection from "@/app/preview-home/sections/Faq";
import LandingProjectsGrid from "./LandingProjectsGrid";
import FaqAccordion, { type FaqItem } from "@/app/preview-insights/FaqAccordion";
import { insightsComponents } from "@/app/preview-insights/insightsBlocks";
import { PortableText } from "@portabletext/react";
import PropertyMap from "@/app/preview-project/PropertyMap";
import { BULLETS_ICONS, BULLETS_TEXT, STEPS_ICONS, STEPS_TEXT, FAQ_TITLE } from "./blockCopy";
import OffPlanSnapshot from "./OffPlanSnapshot";

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
    "villaNavigatorBlock",
    "offPlanSnapshotBlock",
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
      // lang is what selects the localized gold accent in HowWeWork's title —
      // without it the section defaults to "en" and every non-English landing
      // page renders its H2 with no highlight at all (WP3 Pass B #7).
      return <HowWeWorkSection block={asStepsBlock(block.title, BULLETS_ICONS, BULLETS_TEXT[lang as Locale] ?? BULLETS_TEXT.en) as any} variant="facts" lang={lang} />;

    case "howWeWorkBlock":
      return <HowWeWorkSection block={asStepsBlock(block.title, STEPS_ICONS, STEPS_TEXT[lang as Locale] ?? STEPS_TEXT.en) as any} lang={lang} />;

    case "buttonBlock":
      return block.buttonText ? (
        <div className="pl-btnrow">
          <a className="btn btn--glass" href={ctaHref}>{block.buttonText}</a>
        </div>
      ) : null;

    // The "Market Snapshot" panel (.pl-snap) — until now wired only into
    // LandingBody for the three off-plan pages. Reused as-is (same component,
    // same CSS) so a classic page can carry a proof-panel of real figures
    // (live inventory counts, or cited market data) near the top of the
    // page, instead of the only alternative being an FAQ item buried at the
    // bottom. First use: RU villa-cluster pages, added 2026-09-14.
    case "offPlanSnapshotBlock":
      return <OffPlanSnapshot block={block} ctaHref={ctaHref} />;

    // A card grid of editor-authored links to sibling pages, each with its
    // own one-line teaser — richer than the site-wide "Related Landing
    // Pages" pill list (relatedLandingPages/SectionLinks), which carries no
    // per-item copy. Used so far only to cross-link the RU villa cluster
    // (villy-na-kipre -> its 5 segment pages), added 2026-09-14.
    case "villaNavigatorBlock": {
      const items = Array.isArray(block.items) ? block.items : [];
      if (!items.length) return null;
      return (
        <>
          {block.title && <h2 className="pl__h2">{block.title}</h2>}
          <div className="pl-nav">
            {items.map((it: any, i: number) => (
              <a className="pl-nav__card" href={it.href} key={it.href ?? i}>
                <span className="pl-nav__title">{it.title}</span>
                {it.teaser && <span className="pl-nav__teaser">{it.teaser}</span>}
                <span className="pl-nav__arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </>
      );
    }

    case "formMinimalBlock": {
      // The homepage's own contact section — its own background and styling.
      // Checked against all 104 live instances (2026-09-13): 103 of them are
      // exactly one of these internal editor labels, never shown to a
      // visitor — the assumption this comment used to state as fact. The
      // 104th (immobilien-auf-zypern's 3 forms) is genuine customer-facing
      // copy ("Interesse an einer Villa oder einem Haus?" etc.), silently
      // dropped by this case before this fix, always falling back to Form's
      // own generic default heading. Form already accepts an optional
      // `title` prop with that same fallback (see Form.tsx) — passing
      // through anything outside this denylist costs nothing on the 103
      // pages that never had real copy here, and fixes the one that does.
      const INTERNAL_LABELS = new Set([
        "form", "form minimal", "form final", "form bottom", "form investment", "финальная форма",
      ]);
      const isRealTitle = block.title && !INTERNAL_LABELS.has(String(block.title).trim().toLowerCase());
      return <Form lang={lang} title={isRealTitle ? block.title : undefined} />;
    }

    case "faqBlock":
    case "accordionBlock":
    case "landingFaqBlock": {
      // The homepage's FAQ section, which brings its own surface and emits the
      // FAQPage schema. Its prop is nested one level deeper than the CMS block.
      const items = block?.faq?.items ?? block?.items ?? [];
      if (!items.length) return null;
      // titleOverride is the heading lifted out of the prose block above; the
      // block's own title is empty on nearly every one of these pages.
      const faqTitle = titleOverride || block.title || FAQ_TITLE[lang as Locale] || FAQ_TITLE.en;
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
