// src/app/[lang]/layout.tsx
import "@/app/globals.css";
import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { cookies } from "next/headers";
import { GoogleTagManager } from "@next/third-parties/google";
import { ModalProvider } from "../context/ModalContext";
import GoogleAnalyticsWrapper from "../components/GoogleAnalyticsWrapper/GoogleAnalyticsWrapper";
import MicrosoftClarity from "../components/MicrosoftClarity/MicrosoftClarity";
import CustomCookieConsent from "../components/CustomCookieConsent/CustomCookieConsent";
import GoogleAdsScript from "../components/GoogleAdsScript/GoogleAdsScript";
import FacebookPixel from "../components/FacebookPixel/FacebookPixel";
import LenisProvider from "../components/LenisProvider/LenisProvider";
import LinkedInPixel from "../components/LinkedInPixel/LinkedInPixel";
import AnalyticsTracker from "../components/AnalyticsTracker/AnalyticsTracker";
import Script from "next/script";

const rubik = Rubik({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://cyprusvipestates.com"),
  title: "Cyprus VIP Estates",
  description: "Cyprus VIP Estates - Luxury Real Estate in Cyprus",
  applicationName: "Cyprus VIP Estates",
  openGraph: {
    siteName: "Cyprus VIP Estates",
    type: "website",
    url: "https://cyprusvipestates.com",
  },
  other: {
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

  return (
    <html lang={params.lang}>
      <LenisProvider />
      <body className={rubik.className}>
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
        <ModalProvider>{children}</ModalProvider>

        {/* First-party cookieless analytics — always on (no PII stored) */}
        <AnalyticsTracker locale={params.lang} />


        {hasAnalytics && (
          <>
            <MicrosoftClarity hasConsent={true} />
            <GoogleTagManager gtmId="GTM-MQNF6L9V" />
            <GoogleAdsScript />
            <FacebookPixel />
            <LinkedInPixel />
          </>
        )}

        {!hasAnalytics && (
          <>
            {/* ВАЖНО: даже если нет согласия, мы можем проинициализировать Clarity в "no consent" режиме */}
            <MicrosoftClarity hasConsent={false} />
          </>
        )}

        <GoogleAnalyticsWrapper />

        <CustomCookieConsent lang={params.lang as "en" | "de" | "pl" | "ru"} />
      </body>
    </html>
  );
}
