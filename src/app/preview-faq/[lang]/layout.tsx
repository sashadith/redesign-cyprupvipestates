import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import { SITE_URL } from "@/lib/seo";
import "../../preview-home/tokens.css";
import "../faq.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

/* FAQ — redesigned. Reuses the homepage design tokens + fonts + smooth scroll
   (same pattern as preview-insights/preview-projects). The live /faq page
   (Sanity singlepage) still serves any locale without a published faqPage
   SiteDocument row (see middleware.ts) — untouched.

   Isolated route tree, same as preview-case-studies/preview-home/preview-
   insights — NOT nested under src/app/[lang]/layout.tsx (that layout renders
   the live site's OWN header/footer chrome, a different design system). The
   [lang] segment here is local to preview-faq only, purely to carry the
   locale for data-fetching + <html lang>; "preview-faq" itself is never a URL
   a visitor sees or types. Still noindex/nofollow — unchanged by this
   translation work, out of scope for it (see the report given before
   implementing). */

const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Mulish({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const cyr = Playfair_Display({
  subsets: ["cyrillic"],
  weight: ["400", "500"],
  variable: "--font-display-cyr",
  display: "swap",
});

export const metadata: Metadata = {
  // See the identical note in preview-case-studies/[lang]/layout.tsx — this
  // isolated tree doesn't inherit metadataBase from src/app/[lang]/layout.tsx,
  // so any relative image URL in generateMetadata would otherwise resolve
  // against Next.js's localhost fallback instead of the real domain.
  metadataBase: new URL(SITE_URL),
  title: "FAQ — redesign preview",
  robots: { index: false, follow: false },
};

export default function FaqLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang} data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
