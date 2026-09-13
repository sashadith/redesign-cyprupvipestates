// Sibling copy module for WhatsAppButton.tsx — moved out of the component
// (Hebrew Localization Phase 4, controller amendment 2). `messages` and
// `messageWithUrl` were already widened to `Record<Locale,…>` with a `he`
// placeholder by the Task 2 type-hardening pass and are carried over as-is;
// `label` is folded in here too since it was still a bare ternary chain
// (Task 3 scope: every ternary chain becomes a table entry).
import type { Locale } from "@/lib/locale";

const MESSAGE_EN =
  "Hello, I’m interested in buying property in Cyprus. Could you help me find suitable villas or apartments?";

export const messages: Record<Locale, string> = {
  en: MESSAGE_EN,
  de: "Hallo, ich interessiere mich für den Kauf einer Immobilie auf Zypern. Bitte kontaktieren Sie mich.",
  pl: "Dzień dobry, interesuję się zakupem nieruchomości na Cyprze. Czy mogą mi Państwo doradzić odpowiednie wille lub apartamenty?",
  ru: "Здравствуйте! Я интересуюсь покупкой недвижимости на Кипре. Подскажите, пожалуйста, какие виллы или апартаменты доступны сейчас?",
  he: "שלום, אשמח לקבל מידע על רכישת נכס בקפריסין. אפשר לעזור לי למצוא וילה או דירה מתאימה?", // REVIEW(he)
};

export const messageWithUrl: Record<Locale, string> = {
  en: `${messages.en}\n\nI'm sending this message from the page:`,
  de: `${messages.de}\n\nIch sende diese Nachricht von der Seite:`,
  pl: `${messages.pl}\n\nWiadomość wysyłam ze strony:`,
  ru: `${messages.ru}\n\nЯ отправляю это сообщение со страницы:`,
  he: `${messages.he}\n\nההודעה נשלחת מהעמוד:`, // REVIEW(he)
};

export const label: Record<Locale, string> = {
  en: "WhatsApp us now",
  de: "WhatsApp senden",
  pl: "Napisz do nas teraz",
  ru: "Напишите нам сейчас",
  he: "לכתוב לנו בוואטסאפ", // REVIEW(he)
};
