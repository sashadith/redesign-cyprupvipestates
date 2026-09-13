// Sibling copy module for FormFull.tsx — lifted from `lang === "ru" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const FORM_FULL_EN = {
  contactMethodRequired: "Please choose your preferred contact method",
  surnameLabel: "Surname",
  contactMethodLegend: "What’s the best way to contact you?",
  phoneCallLabel: "Phone call",
  emailLabel: "Email",
  agreementLead: "I agree with the terms of the ",
  agreementLinkLabel: "User agreement",
  agreementHref: "/privacy-policy",
  agreementTail: " read and accept them",
};

export const FORM_FULL_COPY: Record<Locale, typeof FORM_FULL_EN> = {
  en: FORM_FULL_EN,
  de: {
    contactMethodRequired: "Bitte bevorzugten Kontaktweg auswählen",
    surnameLabel: "Nachname",
    contactMethodLegend: "Wie können wir Sie am besten kontaktieren?",
    phoneCallLabel: "Anruf",
    emailLabel: "E-Mail",
    agreementLead: "Ich habe die Bedingungen der ",
    agreementLinkLabel: "Benutzervereinbarung",
    agreementHref: "/de/datenschutzrichtlinie",
    agreementTail: " gelesen und akzeptiere sie",
  },
  pl: {
    contactMethodRequired: "Wybierz preferowaną formę kontaktu",
    surnameLabel: "Nazwisko",
    contactMethodLegend: "W jaki sposób najlepiej się z Tobą skontaktować?",
    phoneCallLabel: "Telefonicznie",
    emailLabel: "E-mail",
    agreementLead: "Zgadzam się z ",
    agreementLinkLabel: "Umowa użytkownika",
    agreementHref: "/pl/polityka-prywatnosci",
    agreementTail: " przeczytałem i akceptuję je",
  },
  ru: {
    contactMethodRequired: "Выберите удобный способ связи",
    surnameLabel: "Фамилия",
    contactMethodLegend: "Как с вами лучше связаться?",
    phoneCallLabel: "Телефон",
    emailLabel: "Email",
    agreementLead: "Я согласен с ",
    agreementLinkLabel: "Пользовательским соглашением",
    agreementHref: "/ru/politika-privatnosti",
    agreementTail: " прочитал и принимаю их",
  },
  he: FORM_FULL_EN, // TODO(he)
};

export const formFullCopy = (lang: string) => FORM_FULL_COPY[isLocale(lang) ? lang : "en"];
