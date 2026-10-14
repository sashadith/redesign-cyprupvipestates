import type { GuideId } from "@/lib/guides/registry";
import type { GuideLang } from "@/lib/guides/types";

/** One explained fact per guide for its card: the figure comes with the sentence that says what it means.
 *  Every figure is one of the guide's own key numbers; a test checks the digits against the guide text of the
 *  same language, so a revised guide cannot silently drift from its card. */
export type GuideFact = { before: string; bold: string; after: string };

export const GUIDE_FACTS: Record<GuideId, Record<GuideLang, GuideFact>> = {
  "buying-process": {
    en: { before: "", bold: "8 steps", after: " from budget to transfer of title, in a fixed order." },
    de: { before: "", bold: "8 Schritte", after: " vom Budget bis zur Eigentumsübertragung, in fester Reihenfolge." },
    pl: { before: "", bold: "8 kroków", after: " od budżetu do przeniesienia własności, w ustalonej kolejności." },
    ru: { before: "", bold: "8 шагов", after: " от бюджета до перехода права собственности, в строгом порядке." },
  },
  "cost-of-buying": {
    en: { before: "On a €300,000 new-build, the gap between ", bold: "5% and 19% VAT", after: " is €42,000." },
    de: { before: "Bei einem Neubau für 300.000 € beträgt der Unterschied zwischen ", bold: "5 % und 19 % MwSt", after: " 42.000 €." },
    pl: { before: "Przy nowym mieszkaniu za 300 000 € różnica między ", bold: "5 % a 19 % VAT", after: " wynosi 42 000 €." },
    ru: { before: "Для новостройки за 300 000 € разница между ", bold: "5 % и 19 % НДС", after: " составляет 42 000 €." },
  },
  "rent-or-buy": {
    en: { before: "In the Limassol resale example the buyer is ", bold: "€34,040 ahead", after: " of the renter after 10 years, with flat prices." },
    de: { before: "Im Beispiel einer Bestandswohnung in Limassol liegt der Käufer nach 10 Jahren ", bold: "34.040 € vor", after: " dem Mieter, bei gleichbleibenden Preisen." },
    pl: { before: "W przykładzie mieszkania z rynku wtórnego w Limassol kupujący jest po 10 latach ", bold: "34 040 € przed", after: " najemcą, przy stałych cenach." },
    ru: { before: "В примере вторичной квартиры в Лимасоле покупатель через 10 лет ", bold: "на 34 040 € впереди", after: " арендатора при неизменных ценах." },
  },
  residency: {
    en: { before: "The minimum investment is ", bold: "€300,000", after: " in a new-build home, plus VAT." },
    de: { before: "Die Mindestinvestition beträgt ", bold: "300.000 €", after: " in eine Neubauimmobilie, zzgl. MwSt." },
    pl: { before: "Minimalna inwestycja to ", bold: "300 000 €", after: " w nową nieruchomość, plus VAT." },
    ru: { before: "Минимальная инвестиция составляет ", bold: "300 000 €", after: " в новостройку, плюс НДС." },
  },
};
