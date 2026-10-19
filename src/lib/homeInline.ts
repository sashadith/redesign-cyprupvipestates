/* Inline the render-blocking stylesheets of a prerendered page into its HTML.

   Why: PageSpeed 2026-10-19 — the homepage waits for 9 external stylesheets (HTTP/1.1, ~270 KB raw / 45 KB gz)
   before its first paint. Same page, same bytes, but with the CSS inlined into the document, mobile
   Lighthouse went from 66 to 95–98 (FCP 3.1 -> 1.3 s, LCP 6.7 -> 1.6 s) in a controlled A/B. Next 14.2 has no
   built-in way to inline CSS, so src/app/home-inline/[lang]/route.ts does it on the prerendered HTML.

   Only `<link rel="stylesheet" href="/_next/static/css/NAME.css" data-precedence="next"/>` tags are touched;
   anything unexpected leaves the tag as it was (the page still works, just slower).

   The inline <style> is followed by the ORIGINAL link, switched off with media="print". React's stylesheet
   resource looks for `link[rel=stylesheet][href]` at hydration; with no link it inserts its own and the browser
   applies the same 265 KB of rules a second time (a second full style recalculation: PageSpeed 2026-10-19 showed
   desktop TBT 30 -> 380 ms and 717 ms of style/layout after the first inlining release). With an inert link
   present React adopts it, inserts nothing, and nothing is applied twice. The page's styling comes from the
   inline <style>, which stays in <head> across client-side navigations. */

const LINK_RE = /<link rel="stylesheet" href="(\/_next\/static\/css\/[A-Za-z0-9._-]+\.css)"[^>]*\/>/g;

export function inlineStylesheets(html: string, readCss: (href: string) => string | null | undefined): string {
  return html.replace(LINK_RE, (tag, href: string) => {
    const css = readCss(href);
    if (!css || /<\/style/i.test(css)) return tag;
    return `<style data-href="${href}" data-precedence="next">${css}</style><link rel="stylesheet" href="${href}" data-precedence="next" media="print"/>`;
  });
}
