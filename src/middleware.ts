import { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/i18n.config";

export default async function middleware(request: NextRequest) {
  const handleI18nRouting = createIntlMiddleware({
    locales,
    defaultLocale,
    localePrefix: "always",
    localeDetection: false,
  });

  return handleI18nRouting(request);
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, local uploads, and other non-localized paths.
  matcher: [
    "/((?!api|_next/static|_next/image|admin|structure|robots|sitemap|uploads|favicon.ico).*)",
  ],
};
