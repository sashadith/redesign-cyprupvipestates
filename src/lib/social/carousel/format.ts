// Formatting helpers for the carousel renderer (2026-11-05). Pure.
import type { Lang } from "./schema";

const group = (n: number, sep: string) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** Rule 7: DE 850.000 €, EN €850,000 — fixed separators, never the host's ICU data. */
export function formatPrice(n: number, lang: Lang): string {
  return lang === "de" ? `${group(n, ".")} €` : `€${group(n, ",")}`;
}

/** Rule 3: the note after the price, or null for "Prices from" alone. */
export function vatText(note: "plus" | "included" | null, lang: Lang): string | null {
  if (!note) return null;
  if (note === "plus") return lang === "de" ? "zzgl. MwSt." : "+ VAT";
  return lang === "de" ? "inkl. MwSt." : "incl. VAT";
}

/** Today's calendar date in Cyprus, as YYYY-MM-DD. */
export function nicosiaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** ISO 8601 week-year and week of a calendar date. */
export function isoWeek(ymd: string): { year: number; week: number } {
  const d = new Date(`${ymd}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

/** "2026-w46": from postingDate when given, else from the render time in Europe/Nicosia. */
export function isoWeekFolder(postingDate: string | undefined, now: Date): string {
  const { year, week } = isoWeek(postingDate ?? nicosiaDate(now));
  return `${year}-w${String(week).padStart(2, "0")}`;
}

/** Path below /uploads: social/<week>/<slug>-<lang> (one folder per language, so EN and DE never overwrite each other). */
export function outputSubdir(week: string, slug: string, lang: Lang): string {
  return `social/${week}/${slug}-${lang}`;
}
