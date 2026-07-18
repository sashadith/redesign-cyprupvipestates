import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
import { SITE_URL } from "@/lib/seo";
import "../../preview-home/tokens.css";
import "../../preview-insights/insights.css";
import "../case-studies.css";
import LenisProvider from "../../preview-home/anim/LenisProvider";

/* Case Studies — redesigned. Reuses the homepage design tokens AND the
   Insights index's own stylesheet directly (not re-approximated values) —
   this page explicitly needs "header and hero like Cyprus Insights", so
   .ins__hero/.ins__hero-grid/.ins__device etc. are used verbatim; this file
   only adds the case-study-specific pieces (story blocks, stat strip). The
   live /case-studies Sanity-backed page (still serving /de, /pl, /ru until
   this page grows real locale support) is untouched.

   Isolated route tree, same as preview-home/preview-insights/preview-faq —
   NOT nested under src/app/[lang]/layout.tsx (that layout renders the live
   site's OWN header/footer chrome, a different design system entirely). The
   [lang] segment here is local to preview-case-studies only, purely to carry
   the locale for data-fetching + <html lang>; middleware.ts rewrites the
   public /case-studies, /de/case-studies, /pl/case-studies, /ru/case-studies
   (and their /slug children) straight to this tree, so "preview-case-studies"
   itself is never a URL a visitor sees or types. Still noindex/nofollow for
   now (unchanged from before this translation work — see the report given
   before implementing: the EN page went live noindexed and nothing here
   changes that indexing decision, it's out of scope for a translation task). */

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
  // Without this, any relative URL in this tree's generateMetadata (e.g. a
  // bare /uploads/... og:image) resolves against Next.js's fallback base
  // instead of the real domain — confirmed live (2026-07-18): the case study
  // detail page's og:image pointed at http://localhost:3000/uploads/... in
  // production because this isolated layout has its own root <html>/<body>
  // and doesn't inherit metadataBase from src/app/[lang]/layout.tsx.
  metadataBase: new URL(SITE_URL),
  title: "Case Studies — redesign preview",
  robots: { index: false, follow: false },
};

export default function CaseStudiesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <html lang={params.lang} data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <LenisProvider>{children}</LenisProvider>
      </body>
    </html>
  );
}
