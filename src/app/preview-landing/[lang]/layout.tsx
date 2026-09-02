import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "../../preview-home/tokens.css";
import "../../preview-projects/projects.css";
import "../../preview-insights/insights.css";
import "../landing.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

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
