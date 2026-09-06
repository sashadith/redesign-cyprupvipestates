/* The submit feedback texts, in one place.
 *
 * FormStandard reads its copy from the CMS (formStandardDocument.form), and
 * that document was rewritten on 2026-09-06: the old confirmation ended in a
 * winking smiley and asked the visitor to "wait a bit", the error told people
 * to write "in messenger" without naming an address.
 *
 * Every other form carries the same sentences hardcoded — the blog block, the
 * ROI calculator, the project-page qualification form and the static form all
 * render a fallback, because their content objects have no successMessage at
 * all. Left alone they would keep showing the old wording next to the new one.
 *
 * So the four locales live here once and every form reads them, with the CMS
 * value still winning wherever a form has one. */

export type FormLang = string;

type Copy = { success: string; error: string };

const COPY: Record<"en" | "de" | "pl" | "ru", Copy> = {
  en: {
    success:
      "Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day.",
    error:
      "Your enquiry could not be sent. Please try again, or reach us at office@cyprusvipestates.com or +357 99 278 285.",
  },
  de: {
    success:
      "Vielen Dank — Ihre Anfrage ist bei uns eingegangen. Ein Berater meldet sich, meist noch am selben Tag.",
    error:
      "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder erreichen Sie uns unter office@cyprusvipestates.com oder +357 99 278 285.",
  },
  pl: {
    success:
      "Dziękujemy — Twoje zapytanie do nas dotarło. Doradca odezwie się, zwykle jeszcze tego samego dnia.",
    error:
      "Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z nami: office@cyprusvipestates.com albo +357 99 278 285.",
  },
  ru: {
    success:
      "Спасибо — ваша заявка получена. Консультант свяжется с вами, обычно в тот же день.",
    error:
      "Не удалось отправить заявку. Попробуйте ещё раз или напишите на office@cyprusvipestates.com либо позвоните: +357 99 278 285.",
  },
};

function pick(lang: FormLang): Copy {
  return COPY[lang as keyof typeof COPY] ?? COPY.en;
}

export const formSuccessText = (lang: FormLang) => pick(lang).success;
export const formErrorText = (lang: FormLang) => pick(lang).error;
