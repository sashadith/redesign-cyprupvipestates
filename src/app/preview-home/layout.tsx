import "@/app/fonts/vendored.css";
import { frauncesFontDisplay, mulishFontBody, playfairDisplayFontDisplayCyr } from "@/app/fonts";
import type { Metadata } from "next";
import "./tokens.css";
/* Staging preview with its own <html>/<body>; nothing else pulls in the
   global header stylesheet here. */
import "@/app/header-footer.css";
import LenisProvider from "./anim/LenisProvider";
import { ModalProvider } from "@/app/context/ModalContext";

/* Locked set 2 — Fraunces (display) · Mulish (body); Playfair = Cyrillic fallback. */
const display = frauncesFontDisplay;
const body = mulishFontBody;
const cyr = playfairDisplayFontDisplayCyr;

export const metadata: Metadata = {
  title: "CVE — Homepage redesign preview",
  robots: { index: false, follow: false },
};

export default function PreviewHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${body.variable} ${cyr.variable}`}
    >
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <ModalProvider>
          <LenisProvider>{children}</LenisProvider>
        </ModalProvider>
      </body>
    </html>
  );
}
