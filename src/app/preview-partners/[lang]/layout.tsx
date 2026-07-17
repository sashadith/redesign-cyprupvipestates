import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "../../preview-home/tokens.css";
import "../../preview-insights/insights.css";
import "../partners.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

/* Partners — redesigned. Isolated route tree, same as preview-case-studies/
   preview-faq/preview-home — NOT nested under src/app/[lang]/layout.tsx (that
   layout renders the live site's OWN header/footer chrome, a different design
   system). The [lang] segment here is local to preview-partners only, purely
   to carry the locale for data-fetching + <html lang>. The live /[lang]/partners
   Sanity-free hardcoded page is untouched — this is a separate, local-only
   preview pending review before any cutover. noindex/nofollow throughout. */

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
  title: "Partners — redesign preview",
  robots: { index: false, follow: false },
};

export default function PartnersLayout({
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
