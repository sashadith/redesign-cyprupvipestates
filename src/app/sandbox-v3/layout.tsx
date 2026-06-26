import type { Metadata } from "next";
import { Bodoni_Moda, Playfair_Display, Manrope } from "next/font/google";
import "./tokens.css";

/* Display — Bodoni Moda: a high-contrast modern Didone (fashion-luxury).
   latin-ext for PL; no Cyrillic → RU falls through to Playfair per-glyph. */
const display = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const displayCyr = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display-cyr",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CVE — Redesign Sandbox V3",
  robots: { index: false, follow: false },
};

const noFlashTheme = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var s=localStorage.getItem('cve-redesign-theme-v3');var t=p||s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function SandboxV3Layout({
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
