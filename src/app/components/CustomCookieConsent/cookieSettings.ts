// "Cookie settings" — the footer link that reopens the consent banner so a
// visitor can change or withdraw an earlier choice (2026-11-02). Without it the
// banner only ever appeared while no choice was stored.
//
// No runtime imports on purpose: both footers (server components) read the label from
// here, and the banner listens for the event, without pulling in each other.
import type { Locale } from "@/lib/locale";

/** Dispatched on window by CookieSettingsLink; CustomCookieConsent shows itself again. */
export const COOKIE_SETTINGS_EVENT = "cvp:consent-open";

// Hebrew shows the English label until a native speaker has checked a Hebrew
// one (operator decision 2026-11-02: an English way to withdraw beats none).
const LABELS: Record<Locale, string> = {
  en: "Cookie settings",
  de: "Cookie-Einstellungen",
  pl: "Ustawienia cookies",
  ru: "Настройки cookie",
  he: "Cookie settings", // English on purpose — REVIEW(he)
};

/** Locales whose label is the English fallback, so the button is marked lang="en" dir="ltr". */
const ENGLISH_FALLBACK: ReadonlySet<string> = new Set(["he"]);
export const cookieSettingsLabelIsEnglishFallback = (lang: string): boolean => ENGLISH_FALLBACK.has(lang);

// Own keys only: a stray route segment such as "constructor" must not reach Object.prototype.
export const cookieSettingsLabel = (lang: string): string | null =>
  Object.prototype.hasOwnProperty.call(LABELS, lang) ? LABELS[lang as Locale] ?? null : null;

/** True when the stored cookieConsent value allowed analytics or marketing tags —
 *  withdrawing such a choice has to reload the page to stop tags already running. */
export function hadTrackingConsent(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const c = JSON.parse(raw);
    return c?.analytics === true || c?.marketing === true;
  } catch {
    return false;
  }
}
