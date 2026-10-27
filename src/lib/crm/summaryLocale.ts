// Languages for "Summarise with Claude" (2026-10-27). A leaf module on purpose:
// the cockpit's client component imports it, so it must not pull in Prisma or
// the Anthropic SDK (which ai/summary.ts does).
import { LOCALES, type Locale } from "@/lib/locale";

// The four staff/client languages; Hebrew is left out (nobody on the team reads it).
export type SummaryLocale = Exclude<Locale, "he">;
export const SUMMARY_LOCALES: readonly SummaryLocale[] = LOCALES.filter((l): l is SummaryLocale => l !== "he");
export const DEFAULT_SUMMARY_LOCALE: SummaryLocale = "en";
export function isSummaryLocale(x: unknown): x is SummaryLocale {
  return typeof x === "string" && (SUMMARY_LOCALES as readonly string[]).includes(x);
}
export const summaryLanguageName = (l: SummaryLocale) => new Intl.DisplayNames(["en"], { type: "language" }).of(l) ?? "English";

