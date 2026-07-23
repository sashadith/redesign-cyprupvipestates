import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import { SITE_URL } from "@/lib/seo";
import "../../preview-home/tokens.css";
import "../../preview-insights/insights.css";
import "../partners.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

/* Partners — redesigned, now the LIVE /partners page (cutover decided during
   the canonical/hreflang audit, see docs/SITE-CHANGELOG.md). Isolated route
   tree, same as preview-case-studies/preview-faq/preview-home — NOT nested
   under src/app/[lang]/layout.tsx (that layout renders the OLD site's own
   header/footer chrome, a different design system). The [lang] segment here
   is local to preview-partners only, purely to carry the locale for
   data-fetching + <html lang>; middleware.ts unconditionally rewrites the
   public /partners, /de/partners, /pl/partners, /ru/partners to this tree, so
   "preview-partners" itself is never a URL a visitor sees or types. The old
   hardcoded /[lang]/partners/page.tsx (Sanity-free, dead code once this
   rewrite shipped) has been deleted — this tree is now the only implementation.
   Indexable: this page's own generateMetadata (see ./page.tsx) sets canonical
   + hreflang via staticAlternates(), same as every other indexable route. */

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
  title: "Partners — redesign preview",
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
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
