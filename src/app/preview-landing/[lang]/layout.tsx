import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import { localeDir } from "@/lib/locale";
import { frankRuhlLibre, rubikHebrew } from "@/app/fonts/hebrew";
import "../../preview-home/tokens.css";
/* The new global header lives here. This tree has its own <html>/<body> and
   does NOT inherit src/app/[lang]/layout.tsx, so nothing else would load it. */
import "@/app/header-footer.css";
import "../../preview-projects/projects.css";
import "../../preview-insights/insights.css";
import "../landing.css";
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import LenisProvider from "../../preview-home/anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";

/* The redesigned landing family, served under a "preview" prefix while the
   live pages (/[lang]/[...slug], block-rendered) stay untouched.

   This layout sits one level below the tree root so it receives params.lang:
   the document language has to be the page's own, and a layout above the
   [lang] segment never sees it — preview-insights hardcodes lang="en" for
   exactly that reason. It owns its own
   <html>/<body> and font wiring exactly as preview-insights does — without
   them Next raises "Missing required html tags" and every --font-* variable
   resolves to nothing, dropping the page onto the browser's default faces.

   noindex for the same reason preview-insights is: the real landing pages
   rank, and two indexable copies of the same content would compete. Cutting
   over later is a middleware rewrite, as corporatePageSlugs.ts already does
   for About/Contacts/Privacy/Terms — the public URL never changes, so nothing
   that ranks moves. */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  title: "Landing pages — redesign preview",
  robots: { index: false, follow: false },
};

export default function PreviewLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang} dir={localeDir(params.lang)} data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable} ${frankRuhlLibre.variable} ${rubikHebrew.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <ModalProvider>
          <LenisProvider>{children}</LenisProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
