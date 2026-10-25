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

/* Start the page's JavaScript only after the first paint.

   Lighthouse's simulated LCP/FCP charge every request that STARTED before the observed paint to the metric,
   together with the CPU work of the scripts: on the homepage that was ~105 KB of chunks plus 0.9 s of script
   evaluation (PageSpeed mobile, 2026-10-20: observed LCP 0.31 s, simulated 4.2 s). Next emits the chunks as
   `<script src async>` tags that the preload scanner fetches at parse time; here they are lifted out and re-added
   by a tiny inline loader 100 ms after the browser reports a paint (or after 4 s, if no paint is ever reported).
   There is deliberately NO `load` trigger: when `load` fires before the first paint (lazy images and fonts can
   make the paint trail it by ~0.6 s, seen in ~30 % of local Lighthouse runs) a load-driven start put the
   script requests BEFORE the observed LCP, and the simulation charged them to it: PSI 87 → 73, LCP 3.3 → 6.0 s
   on an identical build (2026-10-20). 26 baseline runs: 8 with LCP > 3 s; with this loader 3 of 16, and none
   of those still has a script request ahead of the LCP.
   The page is fully rendered HTML either way; only interactivity (hydration) starts a few hundred ms later.
   The `noModule` polyfill tag and every inline script (flight data, JSON-LD) are left untouched; the webpack
   runtime's script preload hint is dropped together with its script. */

const SCRIPT_TAG_RE = /<script src="(\/_next\/static\/chunks\/[A-Za-z0-9_\/%.-]+\.js)" async=""><\/script>/g;

export function deferScripts(html: string): string {
  const srcs: string[] = [];
  let out = html.replace(SCRIPT_TAG_RE, (_tag, src: string) => {
    srcs.push(src);
    return "";
  });
  if (srcs.length === 0 || !out.includes("</body>")) return html;
  const set = new Set(srcs);
  out = out.replace(/<link rel="preload" as="script"[^>]*href="([^"]+)"[^>]*\/>/g, (tag, href: string) => (set.has(href) ? "" : tag));
  const loader =
    "<script data-cve-defer>(function(){var u=" +
    JSON.stringify(srcs) +
    ",d=0;function go(){if(d)return;d=1;for(var i=0;i<u.length;i++){var s=document.createElement('script');s.src=u[i];s.async=true;document.body.appendChild(s)}}" +
    "try{new PerformanceObserver(function(l,o){o.disconnect();setTimeout(go,100)}).observe({type:'paint',buffered:true})}catch(e){}" +
    "setTimeout(go,4000)})()</script>";
  return out.replace("</body>", loader + "</body>");
}
