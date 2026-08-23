/* Normalising the team's spoken-language strings.

   The stored value is a free-text, lower-case, native-name list per member
   ("deutsch, english, русский" / "english, deutsch, eλληνικά, русский, dutch,
   francais" / "english, русский, қазақша, oʻzbekcha"). To filter by language
   it has to be mapped onto stable keys first — the raw strings can't be
   compared across members (native name, spelling and casing all vary, and one
   entry even uses a Greek epsilon in "eλληνικά" instead of a Latin "e").

   Anything unrecognised is NOT dropped — it falls through as its own key with
   the stored text as its label, so a newly added language still appears as a
   filter chip instead of silently vanishing. */

export type LanguageKey = string;

const ALIASES: Record<string, LanguageKey> = {
  english: "en", englisch: "en",
  deutsch: "de", german: "de",
  "русский": "ru", russian: "ru", russisch: "ru",
  polski: "pl", polish: "pl", polnisch: "pl",
  "español": "es", espanol: "es", spanish: "es", spanisch: "es",
  francais: "fr", "français": "fr", french: "fr", "französisch": "fr",
  dutch: "nl", nederlands: "nl", "niederländisch": "nl",
  // Greek epsilon in the stored data, plus the correct Latin/Greek spellings
  "eλληνικά": "el", "ελληνικά": "el", greek: "el", griechisch: "el",
  "қазақша": "kk", kazakh: "kk",
  "oʻzbekcha": "uz", "o'zbekcha": "uz", uzbek: "uz",
};

/** Display label per language key, in the visitor's own locale. */
const LABELS: Record<string, Record<string, string>> = {
  en: { en: "English", de: "German", ru: "Russian", pl: "Polish", es: "Spanish", fr: "French", nl: "Dutch", el: "Greek", kk: "Kazakh", uz: "Uzbek" },
  de: { en: "Englisch", de: "Deutsch", ru: "Russisch", pl: "Polnisch", es: "Spanisch", fr: "Französisch", nl: "Niederländisch", el: "Griechisch", kk: "Kasachisch", uz: "Usbekisch" },
  pl: { en: "Angielski", de: "Niemiecki", ru: "Rosyjski", pl: "Polski", es: "Hiszpański", fr: "Francuski", nl: "Niderlandzki", el: "Grecki", kk: "Kazachski", uz: "Uzbecki" },
  ru: { en: "Английский", de: "Немецкий", ru: "Русский", pl: "Польский", es: "Испанский", fr: "Французский", nl: "Нидерландский", el: "Греческий", kk: "Казахский", uz: "Узбекский" },
};

/** Sort order for the filter chips — the site's own four locales first. */
const ORDER = ["en", "de", "ru", "pl", "es", "fr", "nl", "el", "kk", "uz"];

export function toLanguageKey(raw: string): LanguageKey {
  const k = raw.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

export function languageLabel(key: LanguageKey, lang: string, fallbackRaw?: string): string {
  const table = LABELS[lang] ?? LABELS.en;
  if (table[key]) return table[key];
  // Unrecognised language: show the stored native text, capitalised.
  const raw = fallbackRaw ?? key;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function sortLanguageKeys(keys: LanguageKey[]): LanguageKey[] {
  return [...keys].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
