import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "../preview-home/tokens.css";
import "../preview-insights/insights.css";
import "./case-studies.css";
import LenisProvider from "../preview-home/anim/LenisProvider";

/* Case Studies — redesigned, isolated preview. Reuses the homepage design
   tokens AND the Insights index's own stylesheet directly (not re-approximated
   values) — this page explicitly needs "header and hero like Cyprus Insights",
   so .ins__hero/.ins__hero-grid/.ins__device etc. are used verbatim; this file
   only adds the case-study-specific pieces (story blocks, stat strip). The
   live /case-studies Sanity-backed page is untouched. noindex; "preview"
   prefix is excluded from the i18n middleware. */

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
  title: "Case Studies — redesign preview",
  robots: { index: false, follow: false },
};

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
