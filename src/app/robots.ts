import { MetadataRoute } from "next";

// 2026-08-11 GSC audit ("Blocked by robots.txt": 649 URLs) — two changes from
// what this used to disallow:
//   - "/_next" removed: was blocking /_next/static/css, /_next/static/chunks
//     (JS), /_next/static/media (fonts), and /_next/image — i.e. Google's
//     renderer couldn't fetch the page's own CSS/JS/images to evaluate it.
//     Nothing under /_next is private; there's no reason to hide it.
//   - The tracking-parameter disallows (?utm/?gclid/?gbraid/?from/?gtm/
//     ?matchtype=) removed: every canonical on this site is
//     built from lang+slug/route segments only (src/lib/seo.ts's
//     languageAlternates/staticAlternates), never from the request URL, so a
//     UTM/gclid-tagged URL still emits a clean, query-string-free
//     self-referencing rel=canonical — verified live, a real page fetched
//     with ?utm_source=... still rendered
//     <link rel="canonical" href=".../buying-property-cyprus-remotely"/>.
//     Disallowing these meant Google could never fetch the page to see that
//     canonical in the first place, which is how a URL ends up "Indexed,
//     though blocked by robots.txt" with an empty snippet instead of
//     cleanly consolidating. Letting Google crawl and canonicalize is the
//     correct handling for links we control (LinkedIn/X/Facebook UTM posts).
//     ?gtm specifically: nothing on this site generates a ?gtm-tagged URL
//     (grepped — GTM here is only the container script + dataLayer events,
//     never a URL param); the only plausible source is someone landing via a
//     shared GTM preview link, which the same canonical mechanism handles
//     identically to the others, so it's removed for consistency rather than
//     kept as a special case with no real usage to justify it. ?matchtype=
//     (Google Ads match-type reporting param) removed for the same reason —
//     same clean-canonical mechanism applies regardless of which param name
//     shows up on the URL.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/c/", // token-protected client presentation pages — also carry their own noindex meta + X-Robots-Tag
          "/_assets",
          "/_static",
        ],
      },
    ],
    // "host" removed 2026-08-11 — Google never supported the field and
    // Yandex dropped it in 2021; the sitemap directive is what both actually
    // use to discover crawl scope.
    sitemap: "https://cyprusvipestates.com/sitemap.xml",
  };
}
