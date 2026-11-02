import CustomCookieConsent from "@/app/components/CustomCookieConsent/CustomCookieConsent";
import AnalyticsTracker from "@/app/components/AnalyticsTracker/AnalyticsTracker";
import ConsentScripts from "@/app/components/ConsentScripts/ConsentScripts";
import { isLocale } from "@/lib/locale";

/* The consent banner plus everything it gates, for route trees with their own
   <html>/<body> (preview-about, preview-contacts, preview-legal, …). Those trees
   do not inherit src/app/[lang]/layout.tsx, so until 2026-11-02 the pages
   middleware rewrites onto them (/de/kontakt, /faq, /partners, …) had no
   banner, no tags and no first-party page views at all.

   Same set and order as the home-static layout; ConsentScripts picks the tags
   on the client, so it works on static pages too. Every public rewrite target
   in middleware.ts must render this — src/lib/__tests__/consentCoverage.test.ts
   checks it. */
export default function SiteConsent({ lang }: { lang: string }) {
  // Not every one of these layouts validates its [lang] segment (preview-faq,
  // preview-legal); the banner's copy table would be undefined for a stray one.
  const locale = isLocale(lang) ? lang : "en";
  return (
    <>
      {/* First-party cookieless analytics — always on (no PII stored) */}
      <AnalyticsTracker locale={locale} />
      <ConsentScripts disableTracking={false} />
      <CustomCookieConsent lang={locale} />
    </>
  );
}
