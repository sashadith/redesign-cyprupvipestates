import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import "../preview-home/tokens.css";
import "./insights.css";
import LenisProvider from "../preview-home/anim/LenisProvider";

/* Cyprus Insights — redesigned blog, isolated preview. Reuses the homepage design
   tokens + fonts + smooth scroll. Hybrid theme: dark index/hero, light reading body.
   The live blog (/[lang]/blog) is untouched. noindex; "preview" prefix is already
   excluded from the i18n middleware. */

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
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
