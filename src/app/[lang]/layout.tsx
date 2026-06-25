// src/app/[lang]/layout.tsx
import "@/app/globals.css";
import type { Metadata } from "next";
import { Rubik } from "next/font/google";
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
import { MotionConfig } from "framer-motion";
import Script from "next/script";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

// Localized label for the "skip to main content" accessibility link.
const SKIP_LINK_LABELS: Record<string, string> = {
  en: "Skip to main content",
  de: "Zum Hauptinhalt springen",
  pl: "Przejdź do treści głównej",
  ru: "Перейти к основному содержанию",
};

const rubik = Rubik({ subsets: ["latin", "cyrillic"] });

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
    images: [{ url: DEFAULT_OG_IMAGE }],
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
    <html lang={params.lang}>
      <LenisProvider />
      <body className={rubik.className}>
        <SkipLink label={SKIP_LINK_LABELS[params.lang] ?? SKIP_LINK_LABELS.en} />
        {isDraftPreview && (
          <div style={{ position: "sticky", top: 0, zIndex: 9999, background: "#1B4B43", color: "#fff", textAlign: "center", fontSize: 13, padding: "6px 12px" }}>
            Draft preview — showing unpublished content.{" "}
            <a href="/api/preview/disable" style={{ textDecoration: "underline", fontWeight: 600 }}>Exit preview</a>
          </div>
        )}
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Cyprus VIP Estates",
              alternateName: "Cyprus VIP Estates",
              url: "https://cyprusvipestates.com",
              logo: "https://cyprusvipestates.com/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png",
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

        <CustomCookieConsent lang={params.lang as "en" | "de" | "pl" | "ru"} />
      </body>
    </html>
  );
}
