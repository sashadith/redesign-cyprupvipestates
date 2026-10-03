import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "@/app/preview-home/tokens.css";
import "./[token]/booking.css";

// Same reasoning as src/app/c/layout.tsx: this route sits outside [lang], so
// it needs its own <html>/<body> — omitting one caused a real hydration
// crash there (see that file's comment), not a hypothetical concern.
const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    // Per-lead locale (incl. RTL) is applied on the page wrapper `<div lang dir>` — Phase 7.
    <html lang="en" dir="ltr" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
