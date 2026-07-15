import type { Metadata } from "next";
import { Fraunces, Mulish, Playfair_Display } from "next/font/google";
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
  robots: { index: false, follow: false },
};

export default function ClientPresentationLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${cyr.variable}`}>
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  );
}
