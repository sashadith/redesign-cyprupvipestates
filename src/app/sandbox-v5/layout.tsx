import "@/app/fonts/vendored.css";
import { commissionerBE, cormorantGaramondFA, eBGaramondFC, forumFD, frauncesFB, manropeBA, mulishBB, onestBC, playfairDisplayFontDisplayCyr, spectralBD, tenorSansFE } from "@/app/fonts";
import type { Metadata } from "next";
import "./tokens.css";

/* ---- 5 display fonts ---- (sets 3-5 carry Cyrillic natively; 1-2 fall back to Playfair) */
const fA = cormorantGaramondFA; /* no real italic → faux-italic "quietly", matching V1 */
const fB = frauncesFB;
const fC = eBGaramondFC;
const fD = forumFD;
const fE = tenorSansFE;

/* dedicated Cyrillic fallback for the displays without it (sets 1 & 2) */
const cyr = playfairDisplayFontDisplayCyr;

/* ---- 5 body fonts ---- (all carry Cyrillic) */
const bA = manropeBA;
const bB = mulishBB;
const bC = onestBC;
const bD = spectralBD;
const bE = commissionerBE;

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
