import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import { localeDir } from "@/lib/locale";
import { frankRuhlLibre, rubikHebrew } from "@/app/fonts/hebrew";
import { SITE_URL } from "@/lib/seo";
import "../../preview-home/tokens.css";
/* The new global header lives here. This tree has its own <html>/<body> and
   does NOT inherit src/app/[lang]/layout.tsx, so nothing else would load it. */
import "@/app/header-footer.css";
import "../faq.css";
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import LenisProvider from "../../preview-home/anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";
import AttributionCapture from "@/app/components/AttributionCapture/AttributionCapture";

/* FAQ — redesigned. Reuses the homepage design tokens + fonts + smooth scroll
   (same pattern as preview-insights/preview-projects). The live /faq page
   (Sanity singlepage) still serves any locale without a published faqPage
   SiteDocument row (see middleware.ts) — untouched.

   Isolated route tree, same as preview-case-studies/preview-home/preview-
   insights — NOT nested under src/app/[lang]/layout.tsx (that layout renders
   the live site's OWN header/footer chrome, a different design system). The
   [lang] segment here is local to preview-faq only, purely to carry the
   locale for data-fetching + <html lang>; "preview-faq" itself is never a URL
   a visitor sees or types.

   noindex removed 2026-08-11 (GSC audit — this had the exact same leftover-
   preview-flag pattern /partners carried before its July fix): the page-level
   generateMetadata in ./page.tsx already builds a correct, complete
   title/description/canonical/hreflang/OG for the PUBLIC /faq path (not this
   preview-faq path) — it was only ever the layout's own robots field and the
   hardcoded <meta> tag below blocking it. Both removed together; leaving
   either one in place alone would still noindex the page. */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  // See the identical note in preview-case-studies/[lang]/layout.tsx — this
  // isolated tree doesn't inherit metadataBase from src/app/[lang]/layout.tsx,
  // so any relative image URL in generateMetadata would otherwise resolve
  // against Next.js's localhost fallback instead of the real domain.
  metadataBase: new URL(SITE_URL),
  title: "FAQ | Cyprus VIP Estates",
};

export default function FaqLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang} dir={localeDir(params.lang)} data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable} ${frankRuhlLibre.variable} ${rubikHebrew.variable}`}>
      <body>
        <AttributionCapture />
        <ModalProvider>
          <LenisProvider>{children}</LenisProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
