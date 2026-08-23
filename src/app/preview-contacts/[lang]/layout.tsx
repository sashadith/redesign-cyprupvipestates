import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import { SITE_URL } from "@/lib/seo";
import "../../preview-home/tokens.css";
import "../../preview-insights/insights.css";
import "../contacts.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

/* Contacts — redesigned. Isolated route tree, same as preview-partners /
   preview-faq / preview-case-studies — deliberately NOT nested under
   src/app/[lang]/layout.tsx, which renders the OLD site's header/footer
   chrome from a different design system. The [lang] segment here is local to
   this tree, purely to carry the locale for data-fetching and <html lang>;
   middleware.ts rewrites the real /contacts, /de/kontakt, /pl/kontakty,
   /ru/kontakty onto it, so "preview-contacts" is never a URL a visitor sees.

   Unlike /partners, this page's slug is TRANSLATED per locale — canonical and
   hreflang therefore come from languageAlternates() over CORPORATE_SLUGS
   (src/lib/corporatePageSlugs.ts), not staticAlternates(). */

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
  // This isolated tree doesn't inherit metadataBase from src/app/[lang]/layout.tsx,
  // so relative image URLs in generateMetadata would otherwise resolve against
  // Next.js's localhost fallback instead of the real domain.
  metadataBase: new URL(SITE_URL),
};

export default function ContactsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang} data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
