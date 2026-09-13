// Sibling copy module for NewsletterForm.tsx — moved out of the component
// (Hebrew Localization Phase 4, controller amendment 2) so the copy table is
// loadable by the snapshot/meta-length gates without pulling in the
// component's CSS module. The `he` placeholder was already added by the
// Task 2 type-hardening pass and is carried over as-is.
import type { Locale } from "@/lib/locale";

const NEWSLETTER_MESSAGES_EN = {
  success: "You have successfully subscribed to our newsletter!",
  error: "Failed to subscribe. Please try again.",
  invalid: "Please enter a valid email address.",
};

export const NEWSLETTER_MESSAGES: Record<Locale, typeof NEWSLETTER_MESSAGES_EN> = {
  en: NEWSLETTER_MESSAGES_EN,
  de: {
    success: "Sie haben sich erfolgreich für unseren Newsletter angemeldet!",
    error: "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    invalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  },
  pl: {
    success: "Pomyślnie zapisałeś się na nasz newsletter!",
    error: "Nie udało się zapisać. Spróbuj ponownie.",
    invalid: "Wprowadź poprawny adres e-mail.",
  },
  ru: {
    success: "Вы успешно подписались на нашу рассылку!",
    error: "Не удалось подписаться. Попробуйте еще раз.",
    invalid: "Пожалуйста, введите корректный адрес электронной почты.",
  },
  he: NEWSLETTER_MESSAGES_EN, // TODO(he)
};
