// Sibling copy module for FormPartners.tsx — lifted from `lang === "ru" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3). Interpolated
// validation messages become functions so they keep producing the exact same
// string as before.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const FORM_PARTNERS_EN = {
  surnameRequired: "Surname is required",
  surnameTooShort: (min: number) => `Surname is too short (min ${min})`,
  surnameTooLong: (max: number) => `Surname is too long (max ${max})`,
  countryRequired: "Country is required",
  countryTooShort: (min: number) => `Country is too short (min ${min})`,
  countryTooLong: (max: number) => `Country is too long (max ${max})`,
  surnameLabel: "Surname",
  countryLabel: "Country",
};

export const FORM_PARTNERS_COPY: Record<Locale, typeof FORM_PARTNERS_EN> = {
  en: FORM_PARTNERS_EN,
  de: {
    surnameRequired: "Nachname ist erforderlich",
    surnameTooShort: (min) => `Nachname ist zu kurz (mindestens ${min})`,
    surnameTooLong: (max) => `Nachname ist zu lang (max. ${max})`,
    countryRequired: "Land ist erforderlich",
    countryTooShort: (min) => `Land ist zu kurz (mindestens ${min})`,
    countryTooLong: (max) => `Land ist zu lang (max. ${max})`,
    surnameLabel: "Nachname",
    countryLabel: "Land",
  },
  pl: {
    surnameRequired: "Nazwisko jest wymagane",
    surnameTooShort: (min) => `Nazwisko jest za krótkie (min. ${min})`,
    surnameTooLong: (max) => `Nazwisko jest za długie (max ${max})`,
    countryRequired: "Kraj jest wymagany",
    countryTooShort: (min) => `Kraj jest za krótki (min. ${min})`,
    countryTooLong: (max) => `Kraj jest za długi (max ${max})`,
    surnameLabel: "Nazwisko",
    countryLabel: "Kraj",
  },
  ru: {
    surnameRequired: "Фамилия обязательна",
    surnameTooShort: (min) => `Слишком короткая фамилия (минимум ${min})`,
    surnameTooLong: (max) => `Слишком длинная фамилия (макс. ${max})`,
    countryRequired: "Страна обязательна",
    countryTooShort: (min) => `Слишком короткое название страны (минимум ${min})`,
    countryTooLong: (max) => `Слишком длинное название страны (макс. ${max})`,
    surnameLabel: "Фамилия",
    countryLabel: "Страна",
  },
  he: FORM_PARTNERS_EN, // TODO(he)
};

export const formPartnersCopy = (lang: string) =>
  FORM_PARTNERS_COPY[isLocale(lang) ? lang : "en"];
