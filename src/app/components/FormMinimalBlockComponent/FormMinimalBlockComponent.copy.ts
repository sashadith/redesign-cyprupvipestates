// Sibling copy module for FormMinimalBlockComponent.tsx — lifted from
// `lang === "ru" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
// Note: the validation-required message and the fieldset legend share the
// same EN/DE/RU text but differ in Polish, so they are kept as separate keys
// rather than de-duplicated.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const FORM_MINIMAL_EN = {
  contactMethodRequired: "What’s the best way to contact you?",
  surnameLabel: "Surname",
  contactMethodLegend: "What’s the best way to contact you?",
  phoneCallLabel: "Phone call",
  emailLabel: "Email",
};

export const FORM_MINIMAL_COPY: Record<Locale, typeof FORM_MINIMAL_EN> = {
  en: FORM_MINIMAL_EN,
  de: {
    contactMethodRequired: "Wie können wir Sie am besten kontaktieren?",
    surnameLabel: "Nachname",
    contactMethodLegend: "Wie können wir Sie am besten kontaktieren?",
    phoneCallLabel: "Anruf",
    emailLabel: "E-Mail",
  },
  pl: {
    contactMethodRequired: "Wybierz preferowaną formę kontaktu",
    surnameLabel: "Nazwisko",
    contactMethodLegend: "W jaki sposób najlepiej się z Tobą skontaktować?",
    phoneCallLabel: "Telefonicznie",
    emailLabel: "E-mail",
  },
  ru: {
    contactMethodRequired: "Как с вами лучше связаться?",
    surnameLabel: "Фамилия",
    contactMethodLegend: "Как с вами лучше связаться?",
    phoneCallLabel: "Телефон",
    emailLabel: "Email",
  },
  he: FORM_MINIMAL_EN, // TODO(he)
};

export const formMinimalCopy = (lang: string) =>
  FORM_MINIMAL_COPY[isLocale(lang) ? lang : "en"];
