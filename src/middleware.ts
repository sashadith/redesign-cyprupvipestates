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

  // FAQ redesign — English (default, prefixless) locale ONLY, still. /de/faq,
  // /pl/faq, /ru/faq are untouched and keep hitting the old Sanity-backed
  // implementation; preview-faq itself has no DE/PL/RU content yet (a bigger
  // build — new CMS-backed structure — tracked separately from this rewrite).
  if (request.nextUrl.pathname === "/faq") {
    const url = request.nextUrl.clone();
    url.pathname = "/preview-faq";
    return NextResponse.rewrite(url);
  }

  // Case Studies redesign — now locale-aware for all 4 languages (previously
  // English/prefixless only, matching the FAQ block above; case-studies grew
  // real de/pl/ru support first because the underlying data was already fully
  // translated in the DB, unlike FAQ's static English-only content).
  // /case-studies, /de/case-studies, /pl/case-studies, /ru/case-studies (and
  // their /slug children) all rewrite to preview-case-studies/[lang]/... —
  // the visible URL never changes, only what's rendered behind it.
  const caseStudiesMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?case-studies(?:\/([^/]+))?$/);
  if (caseStudiesMatch) {
    const [, localeSeg, slug] = caseStudiesMatch;
    const lang = localeSeg || "en";
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/preview-case-studies/${lang}/${slug}` : `/preview-case-studies/${lang}`;
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
  matcher: [
    "/((?!api|_next/static|_next/image|admin|structure|robots|sitemap|uploads|favicon.ico|sandbox|preview-assets|preview-case-studies|preview-faq|preview-home|preview-insights|preview-projects|style|c/).*)",
  ],
};
