import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/i18n.config";
import nestedPageRedirects from "@/lib/nestedPageRedirects.json";

// Reserved first segments that are their own route, not singlepages — never canonicalised here.
const RESERVED = new Set(["projects", "blog", "developers", "case-studies", "files", "partners"]);
const ALL_LOCALES = ["en", "de", "pl", "ru"];

export default async function middleware(request: NextRequest) {
  // The "Properties" section is hidden pre-launch — the live inventory is under
  // "Projects" (audit H3). Redirect any /properties[/...] to the localized projects
  // listing with a real HTTP redirect (page-level redirect() is swallowed by the i18n rewrite).
  const propMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?properties(?:\/.*)?$/);
  if (propMatch) {
    const url = request.nextUrl.clone();
    url.pathname = propMatch[1] ? `/${propMatch[1]}/projects` : "/projects";
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  // FAQ redesign — now locale-aware for all 4 languages, same shape as the
  // Case Studies block below (both were English/prefixless-only until their
  // respective translation work). /faq, /de/faq, /pl/faq, /ru/faq all rewrite
  // to preview-faq/[lang] — the visible URL never changes. Content per
  // language lives in the faqPage SiteDocument; a language with no row yet
  // would 404 via the page's own notFound() rather than silently falling
  // back, so this only ships once every language actually has content (see
  // scripts/seed-faq-translations.mjs).
  const faqMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?faq$/);
  if (faqMatch) {
    const lang = faqMatch[1] || "en";
    const url = request.nextUrl.clone();
    url.pathname = `/preview-faq/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Case Studies redesign — locale-aware for all 4 languages. /case-studies,
  // /de/case-studies, /pl/case-studies, /ru/case-studies (and their /slug
  // children) all rewrite to preview-case-studies/[lang]/... — the visible
  // URL never changes, only what's rendered behind it.
  const caseStudiesMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?case-studies(?:\/([^/]+))?$/);
  if (caseStudiesMatch) {
    const [, localeSeg, slug] = caseStudiesMatch;
    const lang = localeSeg || "en";
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/preview-case-studies/${lang}/${slug}` : `/preview-case-studies/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Partners redesign — LOCAL PREVIEW ONLY, not deployed. Rewrites the real
  // /partners, /de/partners, /pl/partners, /ru/partners to the new
  // preview-partners/[lang] design so the page (and its lead-capture form,
  // gated by /api/email's PARTNERS_PATH_RE on the exact /partners path) can
  // be verified end-to-end at the real URL before any cutover decision. The
  // live hardcoded /[lang]/partners/page.tsx is untouched on disk; remove
  // this block to fall straight back to it.
  const partnersMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?partners$/);
  if (partnersMatch) {
    const lang = partnersMatch[1] || "en";
    const url = request.nextUrl.clone();
    url.pathname = `/preview-partners/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Singlepage canonicalisation. The catch-all singlepage route matches a page by its leaf slug
  // alone, so a nested page (parent/child) also resolves at a flat "/leaf" or wrong-parent URL —
  // duplicate content. Map each nested leaf to its canonical path and 308-redirect anything else.
  // (Same reason as above: this must be a middleware redirect, not a page-level one.)
  const segs = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segs.length) {
    const lang = ALL_LOCALES.includes(segs[0]) ? segs[0] : "en";
    const rest = ALL_LOCALES.includes(segs[0]) ? segs.slice(1) : segs;
    if (rest.length && !RESERVED.has(rest[0])) {
      const canonical = (nestedPageRedirects as Record<string, Record<string, string>>)[lang]?.[rest[rest.length - 1]];
      if (canonical && canonical !== rest.join("/")) {
        const url = request.nextUrl.clone();
        url.pathname = lang === "en" ? `/${canonical}` : `/${lang}/${canonical}`;
        url.search = "";
        return NextResponse.redirect(url, 308);
      }
    }
  }

  const handleI18nRouting = createIntlMiddleware({
    locales,
    defaultLocale,
    // Default locale (English) is served without a URL prefix; de/pl/ru keep
    // their prefix. next-intl also redirects `/en/...` → `/...` automatically.
    localePrefix: "as-needed",
    localeDetection: false,
  });

  return handleI18nRouting(request);
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, local uploads, and other non-localized paths.
  // "c/" = client presentations (src/app/c/[token]), a route outside the [lang]
  // tree; without this exclusion next-intl's i18n middleware rewrites
  // /c/<token> to /en/c/<token>, which doesn't exist → 404 on every
  // presentation link.
  //
  // The preview-* exclusions must be the exact top-level route names, NOT a
  // bare "preview" prefix: src/app/[lang]/preview-project/[slug] IS under the
  // [lang] tree and NEEDS the i18n middleware to inject the locale segment.
  // A bare "preview" also matches "preview-project" (prefix match), which
  // excluded that route from ever getting its [lang] segment injected — every
  // /preview-project/<slug> request then had only 2 URL segments where the
  // route needs 3 ([lang]/preview-project/[slug]), failed to match, and fell
  // through to the [lang]/[...slug] singlepage catch-all (which then 500'd
  // trying to use "preview-project" as a Prisma `language` value).
  //
  // preview-assets (public/preview-assets/*, e.g. sunset.mp4, faq-hero-2.webp)
  // was missing from this list — every request to it got rewritten to
  // /en/preview-assets/*, a path with no matching static file or route, 404ing
  // in production. Confirmed live (2026-07-17): both preview-home's hero video
  // and the FAQ hero illustration were silently broken by this gap.
  //
  // "og" (public/og/*, the branded OG/social-preview images) hit the identical
  // gap (2026-07-18): /og/home-1200x630.jpg rewritten to /en/og/home-1200x630.jpg
  // and 404ing, which would have made every og:image/twitter:image tag point at
  // a broken URL in production.
  matcher: [
    "/((?!api|_next/static|_next/image|admin|structure|robots|sitemap|uploads|favicon.ico|sandbox|og|preview-assets|preview-case-studies|preview-faq|preview-home|preview-insights|preview-partners|preview-projects|style|c/).*)",
  ],
};
