import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, manropeFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "./tokens.css";

/* Display — Fraunces: a high-contrast variable optical serif, more expressive
   than V1's Cormorant. latin-ext covers PL diacritics; no Cyrillic → RU falls
   through to Playfair Display per-glyph. */
const display = frauncesFontDisplay;

const displayCyr = playfairDisplayFontDisplayCyr;

const body = manropeFontBody;

export const metadata: Metadata = {
  title: "CVE — Redesign Sandbox V2",
  robots: { index: false, follow: false },
};

const noFlashTheme = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var s=localStorage.getItem('cve-redesign-theme-v2');var t=p||s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function SandboxV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${displayCyr.variable} ${body.variable}`}
    >
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
