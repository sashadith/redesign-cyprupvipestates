// Shared slug generator — client- and server-safe (pure JS, no Node-only APIs).
// Transliterates Cyrillic (ru) and Latin diacritics (de/pl) to ASCII before the
// usual lowercase/hyphenate/strip-invalid-characters pass, so titles in any of
// this site's locales (en/de/pl/ru) produce a sane slug instead of losing
// non-Latin characters outright.
const TRANSLITERATION: Record<string, string> = {
  // Russian Cyrillic
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  // Polish
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
  // German
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
};

export function slugify(input: string): string {
  const lower = (input ?? "").toLowerCase();
  let transliterated = "";
  for (const ch of lower) transliterated += TRANSLITERATION[ch] ?? ch;
  return transliterated
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining combining diacritics (e.g. from é, à)
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
