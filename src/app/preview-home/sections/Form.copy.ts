// Sibling copy module for preview-home/sections/Form.tsx — lifted from the
// in-file `DICT` record (Hebrew Localization Phase 4, WP3 fix round 1).
//
// Why it moved: `DICT` had no `he` branch and the component resolved
// `DICT[lang] ?? DICT.en`, so every /he/… page that renders this shared form
// (homepage, projects, blog, contacts, case studies, FAQ, and the landing
// `formMinimalBlock`) shipped an English form under a Hebrew headline —
// labels, legend, Send button, every validation message and both feedback
// lines. Styleguide §10 ("kein englischer Restsatz").
//
// he: success/error are word-identical with `formFeedbackCopy.ts`, the labels
// and validation messages with `FormStatic.copy.ts` (§11.6 — duplicated
// strings stay word-identical); the phone/e-mail tokens are wrapped with
// ltrIsolate() — RTL only.
import type { Locale } from "@/lib/locale";
import { isLocale, ltrIsolate } from "@/lib/locale";

export const FORM_EN = {
  labelName: "Your name", labelSurname: "Surname", labelPhone: "Phone", labelEmail: "Email",
  legend: "What’s the best way to contact you?", optPhone: "Phone call", optEmail: "Email", send: "Send",
  vName: "Name is required", vSurname: "Surname is required", vPhone: "Phone is required",
  vEmailInvalid: "Invalid email address", vEmail: "Email is required", vContact: "What’s the best way to contact you?",
  vConsentReq: "Consent is required", vConsentOne: "Consent required",
  success: "Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day.",
  error: "Your enquiry could not be sent. Please try again, or reach us at office@cyprusvipestates.com or +357 99 278 285.",
  // Optional — only populated for "en" today. showQuestionField is only ever
  // passed true on the (English-only) FAQ page, so de/pl/ru/he fall back to the
  // English copy in the component rather than risk an unreviewed translation
  // shipping.
  labelQuestion: "Your question", placeholderQuestion: "What would you like to know?",
  vQuestion: "Please enter your question",
};

type QuestionKeys = "labelQuestion" | "placeholderQuestion" | "vQuestion";
/** The three question-field keys are en-only today; every other key is required. */
export type FormStrings = Omit<typeof FORM_EN, QuestionKeys> & Partial<Pick<typeof FORM_EN, QuestionKeys>>;

export const FORM_COPY: Record<Locale, FormStrings> = {
  en: FORM_EN,
  de: {
    labelName: "Ihr Vorname", labelSurname: "Ihr Nachname", labelPhone: "Telefon", labelEmail: "E-Mail Adresse",
    legend: "Wie möchten Sie am besten kontaktiert werden?", optPhone: "Telefon", optEmail: "E-Mail", send: "Absenden",
    vName: "Name ist erforderlich", vSurname: "Nachname ist erforderlich", vPhone: "Telefon ist erforderlich",
    vEmailInvalid: "Ungültige E-Mail Adresse", vEmail: "E-Mail ist erforderlich", vContact: "Wie können wir Sie am besten kontaktieren?",
    vConsentReq: "Zustimmung erforderlich", vConsentOne: "Einverständnis erforderlich",
    success: "Vielen Dank — Ihre Anfrage ist bei uns eingegangen. Ein Berater meldet sich, meist noch am selben Tag.",
    error: "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder erreichen Sie uns unter office@cyprusvipestates.com oder +357 99 278 285.",
  },
  pl: {
    labelName: "Imię", labelSurname: "Nazwisko", labelPhone: "Telefon", labelEmail: "E-mail",
    legend: "W jaki sposób najlepiej się z Tobą skontaktować?", optPhone: "Telefonicznie", optEmail: "E-mail", send: "Wyślij",
    vName: "Imię jest wymagane", vSurname: "Nazwisko jest wymagane", vPhone: "Telefon jest wymagany",
    vEmailInvalid: "Nieprawidłowy format email", vEmail: "Email jest wymagany", vContact: "Wybierz preferowaną formę kontaktu",
    vConsentReq: "Zgoda jest wymagana", vConsentOne: "Wymagane wyrażenie zgody",
    success: "Dziękujemy — Twoje zapytanie do nas dotarło. Doradca odezwie się, zwykle jeszcze tego samego dnia.",
    error: "Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z nami: office@cyprusvipestates.com albo +357 99 278 285.",
  },
  ru: {
    labelName: "Ваше имя", labelSurname: "Фамилия", labelPhone: "Телефон", labelEmail: "Ваш email",
    legend: "Как с вами лучше связаться?", optPhone: "Телефон", optEmail: "Email", send: "Отправить",
    vName: "Имя обязательно", vSurname: "Фамилия обязательна", vPhone: "Телефон обязателен",
    vEmailInvalid: "Неверный формат email", vEmail: "Email обязателен", vContact: "Как с вами лучше связаться?",
    vConsentReq: "Согласие обязательно", vConsentOne: "Требуется согласие",
    success: "Спасибо — ваша заявка получена. Консультант свяжется с вами, обычно в тот же день.",
    error: "Не удалось отправить заявку. Попробуйте ещё раз или напишите на office@cyprusvipestates.com либо позвоните: +357 99 278 285.",
  },
  he: {
    labelName: "שם פרטי", labelSurname: "שם משפחה", labelPhone: "טלפון", labelEmail: "אימייל",
    legend: "מה דרך ההתקשרות הנוחה לכם?", optPhone: "שיחת טלפון", optEmail: "אימייל", send: "שליחה",
    vName: "יש להזין שם פרטי", vSurname: "יש להזין שם משפחה", vPhone: "יש להזין טלפון",
    vEmailInvalid: "כתובת אימייל לא תקינה", vEmail: "יש להזין אימייל", vContact: "יש לבחור דרך התקשרות מועדפת",
    vConsentReq: "נדרש אישור", vConsentOne: "חובה לאשר",
    labelQuestion: "השאלה שלכם", placeholderQuestion: "מה תרצו לדעת?", vQuestion: "יש להזין שאלה",
    success: "תודה, הפנייה שלכם הגיעה אלינו. יועץ יחזור אליכם, בדרך כלל עוד באותו יום.",
    error: `לא הצלחנו לשלוח את הפנייה. אפשר לנסות שוב, או ליצור איתנו קשר באימייל ${ltrIsolate("office@cyprusvipestates.com")} או בטלפון ${ltrIsolate("+357 99 278 285")}.`,
  }, // REVIEW(he)
};

export const formCopy = (lang: string) => FORM_COPY[isLocale(lang) ? lang : "en"];
