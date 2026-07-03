import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "../preview-home/tokens.css";
import "./projects.css";

/* Cyprus VIP Estates — Projects search, isolated redesign preview. Reuses the
   homepage design tokens + fonts. Dark, map-centric explorer. The live
   /[lang]/projects page is untouched. noindex; "preview" prefix is already
   excluded from the i18n middleware. No Lenis here — smooth-scroll would fight
   the map's wheel-zoom. */

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
  title: "Projects — redesign preview",
  robots: { index: false, follow: false },
};

export default function ProjectsPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
