import "@/app/fonts/vendored.css";
import { frankRuhlLibreFontDisplayHe, rubikFontBodyHe } from "@/app/fonts";
// src/app/fonts/hebrew.ts — Hebrew-capable faces, loaded once and exposed as
// CSS variables. Fraunces/Mulish/Playfair have no Hebrew glyphs; the
// font-family chains fall through to these when the text is Hebrew, exactly
// the way --font-display-cyr already backs Cyrillic.

export const frankRuhlLibre = frankRuhlLibreFontDisplayHe;

export const rubikHebrew = rubikFontBodyHe;
