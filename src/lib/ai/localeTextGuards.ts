import { LOCALES, type Locale } from "@/lib/locale";

export type LocaleText = Record<Locale, string>;

export const HEBREW_RE = /[֐-׿]/;
export const CYRILLIC_RE = /[Ѐ-ӿ]/;

export function hasHebrew(s: string): boolean {
  return HEBREW_RE.test(s);
}

/** Locales whose text is empty after trim. */
export function emptyLocales(out: Partial<LocaleText>): Locale[] {
  return LOCALES.filter((l) => !(out[l] ?? "").trim());
}

/** Script leaks: he without Hebrew; any non-he with Hebrew; en/de/pl/he with Cyrillic. Returns human-readable problems (empty = clean). */
export function scriptLeaks(out: Partial<LocaleText>): string[] {
  const problems: string[] = [];
  for (const l of LOCALES) {
    const t = out[l] ?? "";
    if (!t.trim()) continue;
    if (l === "he" && !HEBREW_RE.test(t)) problems.push("he: no Hebrew script");
    if (l !== "he" && HEBREW_RE.test(t)) problems.push(`${l}: contains Hebrew script`);
    if (l !== "ru" && CYRILLIC_RE.test(t)) problems.push(`${l}: contains Cyrillic`);
  }
  return problems;
}
