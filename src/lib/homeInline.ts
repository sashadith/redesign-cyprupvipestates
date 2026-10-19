/* Inline the render-blocking stylesheets of a prerendered page into its HTML.

   Why: PageSpeed 2026-10-19 — the homepage waits for 9 external stylesheets (HTTP/1.1, ~270 KB raw / 45 KB gz)
   before its first paint. Same page, same bytes, but with the CSS inlined into the document, mobile
   Lighthouse went from 66 to 95–98 (FCP 3.1 -> 1.3 s, LCP 6.7 -> 1.6 s) in a controlled A/B. Next 14.2 has no
   built-in way to inline CSS, so src/app/home-inline/[lang]/route.ts does it on the prerendered HTML.

   Only `<link rel="stylesheet" href="/_next/static/css/NAME.css" data-precedence="next"/>` tags are touched;
   anything unexpected leaves the tag as it was (the page still works, just slower). React still inserts its
   own copy of the link after hydration (it does not adopt `<style>` for a link resource) — the same rules in
   the same relative order, so the cascade is unchanged. */

const LINK_RE = /<link rel="stylesheet" href="(\/_next\/static\/css\/[A-Za-z0-9._-]+\.css)"[^>]*\/>/g;

export function inlineStylesheets(html: string, readCss: (href: string) => string | null | undefined): string {
  return html.replace(LINK_RE, (tag, href: string) => {
    const css = readCss(href);
    if (!css || /<\/style/i.test(css)) return tag;
    return `<style data-href="${href}" data-precedence="next">${css}</style>`;
  });
}
