import { urlFor } from "@/sanity/sanity.client";
import DeveloperSignMockup from "@/app/[lang]/developers/[slug]/DeveloperSignMockup";

// Bündel 3 Teil 2 (2026-08-02) — developer-profile hero, full "Journal" style
// (InsightsIndex.tsx's own hero, "The Journal" eyebrow on /blog): now taken
// over in its FULL build, including the light "paper" panel (.ins__hero
// is-light) and its built-in golden-clouds effect (.ins__hero::before/::after
// — comes for free with the class, not re-implemented here). The one
// deliberate swap: .ins__hero-art's phone mockup (bespoke, hardcoded site
// branding, not reusable) is replaced by DeveloperSignMockup — same slot,
// same desktop-only positioning treatment, but visible on mobile too (the
// logo is information, not decoration, unlike the phone mockup — see
// .dev-sign-slot in developer-catalog.css, NOT .ins__hero-art, which hides
// below 960px).
//
// Content comes exclusively from the existing Developer profile (content
// editor) — nothing new authored here: title = developer name, text =
// excerpt (short curated summary; the long-form description stays further
// down via FullDescriptionBlock), logo = the existing logo field.

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const EYEBROW: Record<string, string> = {
  en: "DEVELOPER",
  de: "BAUTRÄGER",
  pl: "DEWELOPER",
  ru: "ЗАСТРОЙЩИК",
};

export default function DeveloperJournalIntro({
  lang, title, excerpt, logo,
}: {
  lang: string;
  title: string;
  excerpt?: string;
  logo?: unknown;
}) {
  const logoUrl = safeUrl(logo);

  return (
    <header className="ins__hero is-light dev-hero">
      <div className="wrap ins__hero-grid">
        <div className="ins__hero-text">
          <p className="ins__eyebrow">{EYEBROW[lang] ?? EYEBROW.en}</p>
          <h1 className="ins__hero-title">{title}</h1>
          {excerpt && <p className="ins__hero-lead">{excerpt}</p>}
        </div>
        <div className="dev-sign-slot">
          <DeveloperSignMockup logoUrl={logoUrl} alt={title} />
        </div>
      </div>
    </header>
  );
}
