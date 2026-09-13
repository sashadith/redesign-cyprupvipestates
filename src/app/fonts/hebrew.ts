// src/app/fonts/hebrew.ts — Hebrew-capable faces, loaded once and exposed as
// CSS variables. Fraunces/Mulish/Playfair have no Hebrew glyphs; the
// font-family chains fall through to these when the text is Hebrew, exactly
// the way --font-display-cyr already backs Cyrillic.
import { Frank_Ruhl_Libre, Rubik } from "next/font/google";

export const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display-he",
  display: "swap",
});

export const rubikHebrew = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body-he",
  display: "swap",
});
