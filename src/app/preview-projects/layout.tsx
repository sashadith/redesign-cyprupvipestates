import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "../preview-home/tokens.css";
/* Staging preview with its own <html>/<body>; nothing else pulls in the
   global header stylesheet here. */
import "@/app/header-footer.css";
import "./projects.css";
import { ModalProvider } from "@/app/context/ModalContext";

/* Cyprus VIP Estates — Projects search, isolated redesign preview. Reuses the
   homepage design tokens + fonts. Dark, map-centric explorer. The live
   /[lang]/projects page is untouched. noindex; "preview" prefix is already
   excluded from the i18n middleware. No Lenis here — smooth-scroll would fight
   the map's wheel-zoom. */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  title: "Projects — redesign preview",
  robots: { index: false, follow: false },
};

export default function ProjectsPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <ModalProvider>{children}</ModalProvider>
      </body>
    </html>
  );
}
