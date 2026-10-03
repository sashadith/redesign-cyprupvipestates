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
import "../../preview-insights/insights.css";
/* The closing block reuses the Contacts page's channel cards (shared
   ContactChannels component), whose styles live in that page's stylesheet —
   same arrangement as Partners importing preview-insights/insights.css. */
import "../../preview-contacts/contacts.css";
import "../about.css";
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import LenisProvider from "../../preview-home/anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";
import AttributionCapture from "@/app/components/AttributionCapture/AttributionCapture";

/* About — redesigned. Isolated route tree, same as preview-partners /
   preview-faq / preview-case-studies — deliberately NOT nested under
   src/app/[lang]/layout.tsx, which renders the OLD site's header/footer
   chrome from a different design system. The [lang] segment here is local to
   this tree, purely to carry the locale for data-fetching and <html lang>;
   middleware.ts rewrites the real /about-us, /de/ueber-uns, /pl/o-nas,
   /ru/o-nas onto it, so "preview-about" is never a URL a visitor sees.

   Unlike /partners, this page's slug is TRANSLATED per locale — canonical and
   hreflang therefore come from languageAlternates() over CORPORATE_SLUGS
   (src/lib/corporatePageSlugs.ts), not staticAlternates(). */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  // This isolated tree doesn't inherit metadataBase from src/app/[lang]/layout.tsx,
  // so relative image URLs in generateMetadata would otherwise resolve against
  // Next.js's localhost fallback instead of the real domain.
  metadataBase: new URL(SITE_URL),
};

export default function AboutLayout({
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
