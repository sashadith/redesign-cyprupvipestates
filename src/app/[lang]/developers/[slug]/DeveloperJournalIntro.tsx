import { urlFor } from "@/sanity/sanity.client";

// Bündel 3 Teil 2 (2026-08-01) — developer-profile intro, above the project
// list. Content comes exclusively from the existing Developer profile
// (content editor) — nothing new authored here: title = developer name,
// text = excerpt (the short curated summary; the long-form description stays
// where it already was, further down via FullDescriptionBlock), logo = the
// existing logo field.
//
// Styled after the Journal ("The Journal" eyebrow on /blog's own hero,
// InsightsIndex.tsx): reuses ONLY the grid mechanic (.ins__hero-grid) and
// typography (.ins__eyebrow/.ins__hero-title/.ins__hero-lead) from
// insights.css — NOT .ins__hero itself (that section is a light "paper"
// panel; this stays dark, matching the rest of this page, avoiding a second
// tone-flip right after the photo hero above it) and NOT .ins__hero-art
// (a bespoke phone-mockup illustration with hardcoded site branding, not a
// logo slot). The logo gets its own small treatment below.
//
// Mobile: unlike the blog hero's decorative art (hidden below 960px), the
// logo is information, not decoration — .ins__hero-grid already stacks to a
// single column below 960px, and DOM order (text, then logo) means it lands
// under the text automatically, never hidden.

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
    <section className="pp-wrap pp-section dev-journal" data-theme="dark">
      <div className="ins__hero-grid">
        <div>
          <p className="ins__eyebrow">{EYEBROW[lang] ?? EYEBROW.en}</p>
          <h1 className="ins__hero-title">{title}</h1>
          {excerpt && <p className="ins__hero-lead">{excerpt}</p>}
        </div>
        {logoUrl && (
          <div className="dev-journal__logo-wrap">
            <img className="dev-journal__logo" src={logoUrl} alt={title} />
          </div>
        )}
      </div>
    </section>
  );
}
