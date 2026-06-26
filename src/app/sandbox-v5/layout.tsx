import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Fraunces,
  EB_Garamond,
  Forum,
  Tenor_Sans,
  Playfair_Display,
  Manrope,
  Mulish,
  Onest,
  Spectral,
  Commissioner,
} from "next/font/google";
import "./tokens.css";

/* ---- 5 display fonts ---- (sets 3-5 carry Cyrillic natively; 1-2 fall back to Playfair) */
const fA = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--f-a", display: "swap" }); /* no real italic → faux-italic "quietly", matching V1 */
const fB = Fraunces({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], style: ["normal", "italic"], variable: "--f-b", display: "swap" });
const fC = EB_Garamond({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--f-c", display: "swap" });
const fD = Forum({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400"], variable: "--f-d", display: "swap" });
const fE = Tenor_Sans({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400"], variable: "--f-e", display: "swap" });

/* dedicated Cyrillic fallback for the displays without it (sets 1 & 2) */
const cyr = Playfair_Display({ subsets: ["cyrillic"], weight: ["400", "500"], variable: "--font-display-cyr", display: "swap" });

/* ---- 5 body fonts ---- (all carry Cyrillic) */
const bA = Manrope({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["300", "400", "500", "600"], variable: "--b-a", display: "swap" });
const bB = Mulish({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["300", "400", "500", "600"], variable: "--b-b", display: "swap" });
const bC = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["300", "400", "500", "600"], variable: "--b-c", display: "swap" });
const bD = Spectral({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["300", "400", "500", "600"], variable: "--b-d", display: "swap" });
const bE = Commissioner({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["300", "400", "500", "600"], variable: "--b-e", display: "swap" });

const FONT_VARS = [fA, fB, fC, fD, fE, cyr, bA, bB, bC, bD, bE].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "CVE — Redesign Sandbox V5",
  robots: { index: false, follow: false },
};

const noFlash = `(function(){try{var q=new URLSearchParams(location.search),d=document.documentElement;d.setAttribute('data-theme',q.get('theme')||localStorage.getItem('cve-v5-theme')||'dark');d.setAttribute('data-palette',q.get('palette')||localStorage.getItem('cve-v5-palette')||'green');d.setAttribute('data-font',q.get('font')||localStorage.getItem('cve-v5-font')||'2');}catch(e){var d=document.documentElement;d.setAttribute('data-theme','dark');d.setAttribute('data-palette','green');d.setAttribute('data-font','2');}})();`;

export default function SandboxV5Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" data-palette="green" data-font="2" className={FONT_VARS}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
