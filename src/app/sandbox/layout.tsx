import type { Metadata } from "next";
import { Cormorant_Garamond, Playfair_Display, Manrope } from "next/font/google";
import "./tokens.css";

/* Display — Cormorant Garamond. latin-ext covers PL diacritics (ł ą ę ż ź ć ń ó ś).
   It has NO Cyrillic, so RU display falls through to the Cyrillic serif below. */
const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
  display: "swap",
});

/* Cyrillic display fallback — Playfair Display (high-contrast editorial serif,
   native Cyrillic). Only RU headlines resolve to this, per-glyph. */
const displayCyr = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-display-cyr",
  display: "swap",
});

/* Body/UI — Manrope, with Cyrillic for RU. */
const body = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CVE — Redesign Sandbox",
  robots: { index: false, follow: false }, // never index the sandbox
};

const noFlashTheme = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var s=localStorage.getItem('cve-redesign-theme');var t=p||s||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function SandboxLayout({
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
