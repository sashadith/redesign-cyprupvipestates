// Label for the header's conversion button.
//
// `Record<Locale, …>` rather than `Record<string, …>` on purpose, the same
// reason ModalBrochure.copy.ts gives: the type refuses to compile the day a
// locale is added without copy, instead of silently serving English.
//
// Why "Speak to an adviser" and not "Contact"/"Get in touch": a "Contacts" item
// exists in the nav (under About Us), so a second control making the same
// promise would leave a visitor guessing which one they want. And the label
// names a person, which is the thing this brand actually sells.
//
// Why "Speak" and not "Ask" — the label this started as: the modal's form has
// NO message field. Three inputs, a country select and a channel choice; its
// submit button reads "Contact me" and its lead promises "we will get back to
// you, usually the same day". Nothing in it takes a question. "Ask" therefore
// advertised a box that does not exist on the other side of the click, while
// "Speak" describes what the form really arranges: a conversation, over the
// channel the visitor picks. The wording is also the modal's own headline, so
// the promise does not shift mid-flow.
//
// The locales are sense-equal, not word-equal, and deliberately so. A literal
// Russian rendering ("Поговорить с консультантом", 26 characters) would put the
// button near 250px — wider than any label the header has room for. Russian
// therefore reuses the wording its own hero CTA already carries, which makes the
// same promise in 21.
import type { Locale } from "@/lib/locale";

export const HEADER_CONSULT_COPY: Record<Locale, string> = {
  en: "Speak to an adviser",
  de: "Berater sprechen",
  pl: "Porozmawiaj z doradcą",
  // The hero CTA's wording, not a literal translation — see the note above.
  ru: "Получить консультацию",
  // Infinitive, not a gendered imperative (styleguide §2). This is verbatim the
  // Hebrew modal headline, title + accent joined.
  he: "לדבר עם יועץ", // REVIEW(he)
};
