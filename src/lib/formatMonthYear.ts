const localeMap: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  pl: "pl-PL",
  ru: "ru-RU",
};

function normalizeToIso(dateStr: string): string | null {
  if (!dateStr) return null;
  // поддержка "YYYY-MM" → добавим "-01"
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`;
  // уже "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return null;
}

function capitalizeFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Форматирует ISO-дату (YYYY-MM[-DD]) в "Month YYYY" для заданной локали.
 * Примеры: "2026-05" → "May 2026", "2026-05-01" → "Maj 2026" (pl)
 */
export function formatMonthYear(
  dateStr: string,
  lang: string = "en",
  opts?: { numeric?: boolean; capitalize?: boolean }
): string {
  const iso = normalizeToIso(dateStr);
  if (!iso) return dateStr;

  const d = new Date(iso);
  if (isNaN(d.getTime())) return dateStr;

  // numeric: "05-2026"
  if (opts?.numeric) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${mm}-${d.getFullYear()}`;
  }

  const locale = localeMap[lang] ?? "en-US";
  const s = d.toLocaleDateString(locale, { year: "numeric", month: "long" });
  return opts?.capitalize ? capitalizeFirst(s) : s;
}
