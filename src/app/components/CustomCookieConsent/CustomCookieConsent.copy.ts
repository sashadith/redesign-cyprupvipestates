// Sibling copy module for CustomCookieConsent.tsx — moved out of the
// component (Hebrew Localization Phase 4, controller amendment 2) so the
// copy table is loadable by the snapshot/meta-length gates without pulling in
// the component's CSS module. Widened from a 4-locale `Record<string,…>` to
// `Record<Locale,…>` with a `he` placeholder in the same move.
import type { Locale } from "@/lib/locale";

const COOKIE_CONSENT_EN = {
  title: "We use cookies",
  description:
    "We use necessary cookies for the site to work. We also use analytics and marketing cookies to improve our services – only if you agree.",
  acceptAll: "Accept all",
  rejectAll: "Only necessary",
  privacy: "Cookie Policy",
};

export const COOKIE_CONSENT_COPY: Record<Locale, typeof COOKIE_CONSENT_EN> = {
  en: COOKIE_CONSENT_EN,
  de: {
    title: "Wir verwenden Cookies",
    description:
      "Wir verwenden notwendige Cookies für den Betrieb der Website. Zusätzlich setzen wir Analyse- und Marketing-Cookies nur mit Ihrer Zustimmung.",
    acceptAll: "Alle akzeptieren",
    rejectAll: "Nur notwendige",
    privacy: "Cookie-Richtlinie",
  },
  pl: {
    title: "Używamy plików cookie",
    description:
      "Używamy niezbędnych plików cookie, aby strona działała poprawnie. Analityczne i marketingowe pliki cookie wykorzystujemy tylko za Twoją zgodą.",
    acceptAll: "Akceptuj wszystkie",
    rejectAll: "Tylko niezbędne",
    privacy: "Polityka plików cookie",
  },
  ru: {
    title: "Мы используем файлы cookie",
    description:
      "Мы используем необходимые файлы cookie для работы сайта. Аналитические и маркетинговые файлы cookie используются только с вашего согласия.",
    acceptAll: "Принять все",
    rejectAll: "Только необходимые",
    privacy: "Политика использования cookies",
  },
  he: COOKIE_CONSENT_EN, // TODO(he)
};
