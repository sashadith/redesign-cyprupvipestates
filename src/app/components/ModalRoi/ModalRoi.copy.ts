// Sibling copy module for ModalRoi.tsx — lifted from `lang === "ru" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const MODAL_ROI_EN = {
  title: "Send calculation by email",
  text: "We will send you a copy of the calculation and receive it on our side as well.",
};

export const MODAL_ROI_COPY: Record<Locale, typeof MODAL_ROI_EN> = {
  en: MODAL_ROI_EN,
  de: {
    title: "Berechnung per E-Mail senden",
    text: "Wir senden Ihnen eine Kopie der Berechnung und erhalten sie auch auf unserer Seite.",
  },
  pl: {
    title: "Wyślij kalkulację na e-mail",
    text: "Wyślemy Ci kopię kalkulacji i otrzymamy ją również na naszą skrzynkę.",
  },
  ru: {
    title: "Отправить расчет на email",
    text: "Мы отправим вам копию расчета и получим ее на нашу почту.",
  },
  he: MODAL_ROI_EN, // TODO(he)
};

export const modalRoiCopy = (lang: string) => MODAL_ROI_COPY[isLocale(lang) ? lang : "en"];
