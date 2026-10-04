import { createElement } from "react";

/* Next.js's built-in `generateMetadata().alternates.languages` mechanism, and
   even a hand-authored JSX `<link hrefLang="..." />` element, both render as
   `<link rel="alternate" hrefLang="..." href="...">` in the final HTML — the
   JSX-prop (DOM IDL property) casing, not the lowercase HTML5 attribute name
   `hreflang`. Confirmed this holds for BOTH paths (generateMetadata AND a
   plain JSX element placed directly in the page tree) — Next's App Router
   hoists every <link>/<meta>/<title> found anywhere in the render tree into
   <head> through the same mechanism, so JSX-authored tags get the same
   camelCase treatment as metadata-API ones.

   Per the HTML5 spec, attribute names are ASCII case-insensitive, so this
   is NOT a functional bug for real browsers or standards-compliant crawlers
   (Google, Bing) — `hrefLang` and `hreflang` parse identically. But it can
   trip up naive text-matching audits/tools and possibly some lightweight
   scraper-style crawlers that don't do full HTML parsing.

   The one way that reliably produces genuinely lowercase output: bypass
   JSX's camelCase convention and pass the literal lowercase prop name via
   `createElement` directly. React only rewrites prop names it specifically
   recognizes as the "known" DOM property (`hrefLang`); an unrecognized-but
   otherwise-valid-looking name like plain `hreflang` passes straight through
   as a literal HTML attribute. TypeScript's `LinkHTMLAttributes` type only
   knows `hrefLang`, hence the one targeted `as any` below — kept in this one
   spot rather than sprinkled through call sites.

   Usage: render this INSTEAD of passing `languages` into
   `generateMetadata()`'s `alternates` field (keep `canonical` there, drop
   `languages`) — otherwise both mechanisms would emit a redundant, duplicate
   set of hreflang tags for the same page. */
export default function HreflangLinks({ languages }: { languages: Record<string, string> }) {
  return (
    <>
      {Object.entries(languages).map(([lang, href]) =>
        createElement("link", { key: lang, rel: "alternate", hreflang: lang, href } as any)
      )}
    </>
  );
}
