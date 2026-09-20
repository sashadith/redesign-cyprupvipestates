// src/app/[lang]/layout.tsx
import "@/app/globals.css";
import "@/app/design-tokens.css"; // shared design tokens (definitions only — see file header)
import "@/app/header-footer.css"; // global header + footer chrome (redesign) — see file header
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import type { Metadata } from "next";
import { Rubik, Fraunces, Mulish, Playfair_Display } from "next/font/google";
import { cookies, draftMode } from "next/headers";
import { GoogleTagManager } from "@next/third-parties/google";
import { ModalProvider } from "../context/ModalContext";
import MicrosoftClarity from "../components/MicrosoftClarity/MicrosoftClarity";
import CustomCookieConsent from "../components/CustomCookieConsent/CustomCookieConsent";
import GoogleAdsScript from "../components/GoogleAdsScript/GoogleAdsScript";
import FacebookPixel from "../components/FacebookPixel/FacebookPixel";
import LenisProvider from "../components/LenisProvider/LenisProvider";
import LinkedInPixel from "../components/LinkedInPixel/LinkedInPixel";
import AnalyticsTracker from "../components/AnalyticsTracker/AnalyticsTracker";
import SkipLink from "../components/SkipLink/SkipLink";
import NavHeroFlag from "../components/Header/NavHeroFlag";
import { MotionConfig } from "framer-motion";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isPublicLocale, localeDir, nonDefaultLocalePattern, type Locale } from "@/lib/locale";
import { frankRuhlLibre } from "@/app/fonts/hebrew";

// Localized label for the "skip to main content" accessibility link.
const SKIP_LINK_LABELS: Record<Locale, string> = {
  en: "Skip to main content",
  de: "Zum Hauptinhalt springen",
  pl: "Przejdź do treści głównej",
  ru: "Перейти к основному содержанию",
  he: "דלג לתוכן הראשי",
};

// Built from the same helper as isDarkHeroPath() in navShared.tsx so the two
// route tests cannot drift apart.
const NON_DEFAULT = nonDefaultLocalePattern();
const PREPAINT = `(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';if(/^\\/(${NON_DEFAULT})?$/.test(p)||/^(\\/(${NON_DEFAULT}))?\\/projects$/.test(p))document.documentElement.setAttribute('data-hero-dark','')}catch(e){}})()`;

// One Rubik load for every script on this layout: the same family also backs
// `--font-body-he` (consumed by rtl.css's `:lang(he)` rule), so the Hebrew body
// font is not fetched a second time via fonts/hebrew.ts here. The preview-*
// layouts keep `rubikHebrew` because their body font (Mulish) has no Hebrew glyphs.
const rubik = Rubik({ subsets: ["latin", "cyrillic", "hebrew"], variable: "--font-body-he" });

// Redesign chrome fonts — define the CSS vars the global header/footer use.
// Applied as `.variable` classes on <body> (they only DEFINE the vars; the body
// text itself stays Rubik). Config MUST match the blog listing (BlogInsights) so
// the same font files are reused. --font-display: Fraunces (incl. italic accents),
// --font-body: Mulish, --font-display-cyr: Playfair (Cyrillic display fallback).
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const mulish = Mulish({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const playfairCyr = Playfair_Display({
  subsets: ["cyrillic"],
  weight: ["400", "500"],
  variable: "--font-display-cyr",
  display: "swap",
});

// Third-party tracking master switch. Re-enabled 2026-06-23 (owner request, audit H3):
// Google Analytics 4, Microsoft Clarity, Facebook Pixel (+ FB domain-verification meta).
// Google Ads, GTM, LinkedIn and the first-party AnalyticsTracker were always on.
// All third-party tags except the first-party tracker remain gated behind analytics consent.
// Set back to `true` to disable GA4 / Clarity / Pixel again.
const DISABLE_TRACKING = false;

export const metadata: Metadata = {
  metadataBase: new URL("https://cyprusvipestates.com"),
  title: "Cyprus VIP Estates",
  description: "Cyprus VIP Estates - Luxury Real Estate in Cyprus",
  applicationName: "Cyprus VIP Estates",
  openGraph: {
    siteName: "Cyprus VIP Estates",
    type: "website",
    url: "https://cyprusvipestates.com",
    images: [{ url: DEFAULT_OG_IMAGE, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }],
  },
  twitter: {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE],
  },
  // Facebook domain-verification meta — suppressed while tracking is disabled.
  other: DISABLE_TRACKING
    ? undefined
    : {
        "facebook-domain-verification": "coiknnpjsr2rrcrbht6mvhjdbld3ul",
      },
};

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  // Every prefix the middleware matcher excludes (/api, /og, /admin, …) reaches
  // this layout with that prefix as `lang` when nothing more specific matched.
  // Reject it here so the whole `[lang]` tree 404s instead of 500ing downstream.
  if (!isPublicLocale(params.lang)) notFound();

  const cookieStore = cookies();
  const consentCookie = cookieStore.get("cookieConsent");
  let hasAnalytics = false;

  try {
    const consent = consentCookie?.value
      ? JSON.parse(consentCookie.value)
      : null;
    hasAnalytics = consent?.analytics === true;
  } catch {
    // ignore error
  }

  const isDraftPreview = draftMode().isEnabled;

  return (
    <html lang={params.lang} dir={localeDir(params.lang)} suppressHydrationWarning>
      <LenisProvider />
      <body className={`${rubik.className} ${rubik.variable} ${fraunces.variable} ${mulish.variable} ${playfairCyr.variable} ${frankRuhlLibre.variable}`}>
        {/* Pre-paint: mark dark-hero routes (home, /projects) so the global nav is
            transparent there from the first frame (no bar → transparent flash).
            Client-side navigation is handled by <NavHeroFlag>. Keep the route test
            in sync with isDarkHeroPath() in navShared.tsx. */}
        <script
          dangerouslySetInnerHTML={{ __html: PREPAINT }}
        />
        <NavHeroFlag />
        <SkipLink label={SKIP_LINK_LABELS[params.lang] ?? SKIP_LINK_LABELS.en} />
        {isDraftPreview && (
          <div style={{ position: "sticky", top: 0, zIndex: 9999, background: "#1B4B43", color: "#fff", textAlign: "center", fontSize: 13, padding: "6px 12px" }}>
            Draft preview — showing unpublished content.{" "}
            <a href="/api/preview/disable" style={{ textDecoration: "underline", fontWeight: 600 }}>Exit preview</a>
          </div>
        )}
        <script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              // LocalBusiness (not the RealEstateAgent subtype) still unlocks the
              // brand knowledge panel Google reserves for businesses — address,
              // phone, and hours — that a plain Organization never qualifies for.
              // RealEstateAgent was dropped 2026-09-10: we are not a licensed
              // Cyprus real-estate broker (see the Terms pages' own disclaimer,
              // "marketing and consulting agency, not a licensed brokerage") and
              // this structured claim contradicted that. Do not re-add it.
              "@type": "LocalBusiness",
              name: "Cyprus VIP Estates",
              alternateName: "Cyprus VIP Estates",
              url: "https://cyprusvipestates.com",
              logo: "https://cyprusvipestates.com/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png",
              image: "https://cyprusvipestates.com/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png",
              telephone: "+35799278285",
              email: "office@cyprusvipestates.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Palaion Patron Germanou 11",
                addressLocality: "Paphos",
                postalCode: "8011",
                addressCountry: "CY",
              },
              areaServed: [
                { "@type": "Country", name: "Cyprus" },
                { "@type": "City", name: "Paphos" },
                { "@type": "City", name: "Limassol" },
              ],
              sameAs: [
                "https://www.instagram.com/cyprusvipestates",
                "https://www.facebook.com/cyprusvipestates",
                "https://www.youtube.com/@cyprusvipestates",
                "https://www.tiktok.com/@cyprusvipestates",
              ],
            }),
          }}
        />
        <MotionConfig reducedMotion="user">
          <ModalProvider>{children}</ModalProvider>
        </MotionConfig>

        {/* First-party cookieless analytics — always on (no PII stored) */}
        <AnalyticsTracker locale={params.lang} />


        {hasAnalytics && (
          <>
            {!DISABLE_TRACKING && <MicrosoftClarity hasConsent={true} />}
            <GoogleTagManager gtmId="GTM-MQNF6L9V" />
            <GoogleAdsScript />
            {!DISABLE_TRACKING && <FacebookPixel />}
            <LinkedInPixel />
          </>
        )}

        {!hasAnalytics && !DISABLE_TRACKING && (
          <>
            {/* ВАЖНО: даже если нет согласия, мы можем проинициализировать Clarity в "no consent" режиме */}
            <MicrosoftClarity hasConsent={false} />
          </>
        )}

        {/* GA4 (G-WLD3B6GN9P) is managed exclusively through GTM (GTM-MQNF6L9V) — the direct
            gtag GoogleAnalyticsWrapper was removed to eliminate duplicate page_views. */}

        <CustomCookieConsent lang={params.lang as Locale} />
      </body>
    </html>
  );
}
