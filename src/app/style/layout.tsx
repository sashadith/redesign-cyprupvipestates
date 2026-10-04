import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "../preview-home/tokens.css";
import "../preview-projects/projects.css";
import "../preview-project/project.css";
import "./style.css";

/* /style — the Cyprus VIP Estates design system / CI reference. Reuses the exact
   fonts + tokens from /preview-home so the swatches and samples are authoritative.
   noindex; the i18n middleware ignores the "style" prefix. */

const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  title: "Cyprus VIP Estates — Design System / CI",
  robots: { index: false, follow: false },
};

export default function StyleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
