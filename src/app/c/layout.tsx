import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/preview-project/project.css";
import "./[token]/presentation.css";

// This top-level route (like preview-home/preview-projects) sits outside
// [lang], so it needs its own <html>/<body> — the root layout.tsx is just a
// passthrough fragment. Missing this was the actual cause of the blank-page
// hydration crash: without an <html>/<body> anywhere in the tree, the browser
// parser auto-inserted its own around the streamed content, and React's
// hydration then collided with it (HierarchyRequestError: appendChild — only
// one element on document allowed).
const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ClientPresentationLayout({ children }: { children: React.ReactNode }) {
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
