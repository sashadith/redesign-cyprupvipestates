import "@/app/fonts/vendored.css";
import { cormorantGaramondFontDisplay, manropeFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "./tokens.css";

/* Display — Cormorant Garamond (the V1 favourite), elegant in the new
   sapphire-glass skin. latin-ext for PL; RU → Playfair per-glyph. */
const display = cormorantGaramondFontDisplay;

const displayCyr = playfairDisplayFontDisplayCyr;

const body = manropeFontBody;

export const metadata: Metadata = {
  title: "CVE — Redesign Sandbox V4",
  robots: { index: false, follow: false },
};

const noFlashTheme = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var s=localStorage.getItem('cve-redesign-theme-v4');var t=p||s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function SandboxV4Layout({
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
