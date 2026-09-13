// Sibling copy module for ModalPartners.tsx — lifted from
// `lang === "ru" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const MODAL_PARTNERS_EN = {
  title: "Please provide your contact details",
  text: "We will contact you as soon as possible",
};

export const MODAL_PARTNERS_COPY: Record<Locale, typeof MODAL_PARTNERS_EN> = {
  en: MODAL_PARTNERS_EN,
  de: {
    title: "Kontaktieren Sie mich!",
    text: "Geben Sie Ihre Daten ein, damit wir Sie kontaktieren können",
  },
  pl: {
    title: "Proszę podać swoje dane kontaktowe",
    text: "Skontaktujemy się z Tobą jak najszybciej",
  },
  ru: {
    title: "Укажите контакты для связи",
    text: "Свяжемся с вами как можно скорее",
  },
  he: {
    title: "השאירו פרטים ליצירת קשר",
    text: "נחזור אליכם בהקדם",
  }, // REVIEW(he)
};

export const modalPartnersCopy = (lang: string) =>
  MODAL_PARTNERS_COPY[isLocale(lang) ? lang : "en"];
