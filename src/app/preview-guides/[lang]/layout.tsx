import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import { localeDir } from "@/lib/locale";
import { permanentRedirect } from "next/navigation";
import { frankRuhlLibre, rubikHebrew } from "@/app/fonts/hebrew";
import { SITE_URL } from "@/lib/seo";
import { isGuideLang } from "@/lib/guides/registry";
import "../../preview-home/tokens.css";
/* This tree has its own <html>/<body> and does NOT inherit src/app/[lang]/layout.tsx, so the global header
   styles, the article-form skin and the guide card styles are loaded here. */
import "@/app/header-footer.css";
import "../../preview-insights/insights.css";
import "../../preview-insights/articleForm.css";
import "@/app/components/GuideCta/guideCta.css";
import "../guides.css";
import "@/app/rtl.css"; // direction- and script-aware base rules shared by every localized root layout
import LenisProvider from "../../preview-home/anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";
import AttributionCapture from "@/app/components/AttributionCapture/AttributionCapture";

/* The free-guides page (/guides, /de/ratgeber, /pl/poradniki, /ru/gajdy). Isolated route tree like preview-about:
   middleware.ts rewrites the translated public URLs onto it, so "preview-guides" is never a URL a visitor sees. */
const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

export default function GuidesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  // Direct hits on /preview-guides/<anything that is not a guide language> (Hebrew included) go to the English page.
  if (!isGuideLang(params.lang)) permanentRedirect("/guides");
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
