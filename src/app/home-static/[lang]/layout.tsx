// src/app/home-static/[lang]/layout.tsx — STATIC/ISR twin of src/app/[lang]/layout.tsx for the homepage only.
// Keep the shared chrome (fonts, CSS, schema, header flags) in sync with that file. The ONLY differences:
// no cookies()/draftMode() (they force every [lang] page dynamic: TTFB 1.6 s, `revalidate = 1800` ignored),
// the analytics tags are chosen on the client from the consent cookie (ConsentScripts), and there is no draft banner.
import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr, rubikFontBodyHe } from "@/app/fonts";
import "@/app/globals.css";
import "@/app/design-tokens.css"; // shared design tokens (definitions only — see file header)
import "@/app/header-footer.css"; // global header + footer chrome (redesign) — see file header
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import type { Metadata } from "next";
import { ModalProvider } from "@/app/context/ModalContext";
import CustomCookieConsent from "@/app/components/CustomCookieConsent/CustomCookieConsent";
import LenisProvider from "@/app/components/LenisProvider/LenisProvider";
import AnalyticsTracker from "@/app/components/AnalyticsTracker/AnalyticsTracker";
import ConsentScripts from "@/app/components/ConsentScripts/ConsentScripts";
import SkipLink from "@/app/components/SkipLink/SkipLink";
import NavHeroFlag from "@/app/components/Header/NavHeroFlag";
import { MotionConfig } from "framer-motion";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "@/lib/seo";
import { notFound } from "next/navigation";
import { PUBLIC_LOCALES, isPublicLocale, localeDir, nonDefaultLocalePattern, type Locale } from "@/lib/locale";
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
const PREPAINT = `(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';var d=document.documentElement;if(/^\\/(${NON_DEFAULT})?$/.test(p)||/^(\\/(${NON_DEFAULT}))?\\/projects$/.test(p))d.setAttribute('data-hero-dark','');else if(/^(\\/(${NON_DEFAULT}))?\\/(projects|blog)\\/[^/]+$/.test(p))d.setAttribute('data-hero-scrim','')}catch(e){}})()`;

// One Rubik load for every script on this layout: the same family also backs
// `--font-body-he` (consumed by rtl.css's `:lang(he)` rule), so the Hebrew body
// font is not fetched a second time via fonts/hebrew.ts here. The preview-*
// layouts keep `rubikHebrew` because their body font (Mulish) has no Hebrew glyphs.
const rubik = rubikFontBodyHe;

// Redesign chrome fonts — define the CSS vars the global header/footer use.
// Applied as `.variable` classes on <body> (they only DEFINE the vars; the body
// text itself stays Rubik). Config MUST match the blog listing (BlogInsights) so
// the same font files are reused. --font-display: Fraunces (incl. italic accents),
// --font-body: Mulish, --font-display-cyr: Playfair (Cyrillic display fallback).
const fraunces = frauncesFontDisplay;
const mulish = mulishFontBody;
const playfairCyr = playfairDisplayFontDisplayCyr;

// Third-party tracking master switch. Re-enabled 2026-06-23 (owner request, audit H3):
// Google Analytics 4, Microsoft Clarity, Facebook Pixel (+ FB domain-verification meta).
// Google Ads, GTM, LinkedIn and the first-party AnalyticsTracker were always on.
// All third-party tags except the first-party tracker remain gated behind analytics consent.
// Set back to `true` to disable GA4 / Clarity / Pixel again.
// Every live locale is served by this static tree (same set as the dynamic route).
const HOME_LANGS: readonly string[] = PUBLIC_LOCALES;

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

export function generateStaticParams() {
  return HOME_LANGS.map((lang) => ({ lang }));
}

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


        <ConsentScripts disableTracking={DISABLE_TRACKING} />

        {/* GA4 (G-WLD3B6GN9P) is managed exclusively through GTM (GTM-MQNF6L9V) — the direct
            gtag GoogleAnalyticsWrapper was removed to eliminate duplicate page_views. */}

        <CustomCookieConsent lang={params.lang as Locale} />
      </body>
    </html>
  );
}
