import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "../preview-home/tokens.css";
/* Staging preview with its own <html>/<body>; nothing else pulls in the
   global header stylesheet here. */
import "@/app/header-footer.css";
import "./insights.css";
import LenisProvider from "../preview-home/anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";
import AttributionCapture from "@/app/components/AttributionCapture/AttributionCapture";

/* Cyprus Insights — redesigned blog, isolated preview. Reuses the homepage design
   tokens + fonts + smooth scroll. Hybrid theme: dark index/hero, light reading body.
   The live blog (/[lang]/blog) is untouched. noindex; "preview" prefix is already
   excluded from the i18n middleware. */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  title: "Cyprus Insights — redesign preview",
  robots: { index: false, follow: false },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <AttributionCapture />
        <ModalProvider>
          <LenisProvider>{children}</LenisProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
