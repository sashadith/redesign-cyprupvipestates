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

  // FAQ / Case Studies redesign — English (default, prefixless) locale ONLY.
  // /de/faq, /pl/case-studies, etc. are untouched and keep hitting the old
  // Sanity-backed implementations exactly as before; only the three exact
  // prefixless paths below get rewritten (not redirected — URL stays as-is
  // for the visitor) to the already-reviewed preview-faq/preview-case-studies
  // implementation. No existing route file is modified by this.
  if (request.nextUrl.pathname === "/faq") {
    const url = request.nextUrl.clone();
    url.pathname = "/preview-faq";
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname === "/case-studies") {
    const url = request.nextUrl.clone();
    url.pathname = "/preview-case-studies";
    return NextResponse.rewrite(url);
  }
  const caseStudySlugMatch = request.nextUrl.pathname.match(/^\/case-studies\/([^/]+)$/);
  if (caseStudySlugMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/preview-case-studies/${caseStudySlugMatch[1]}`;
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
  matcher: [
    "/((?!api|_next/static|_next/image|admin|structure|robots|sitemap|uploads|favicon.ico|sandbox|preview|style).*)",
  ],
};
