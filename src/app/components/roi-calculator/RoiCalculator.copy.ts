// Sibling copy module for RoiCalculator.tsx — lifted from `lang === "pl" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const ROI_CALCULATOR_EN = {
  title: "ROI Calculator",
  subtitle: "Estimated calculation based on Cyprus new-build market conditions",
  conservative: "Conservative",
  realistic: "Realistic",
  optimistic: "Optimistic",
  disclaimer:
    "Results are indicative only and depend on purchase price, VAT rate, holding period, selling costs and market conditions.",
  cta: "Get investment consultation",
};

export const ROI_CALCULATOR_COPY: Record<Locale, typeof ROI_CALCULATOR_EN> = {
  en: ROI_CALCULATOR_EN,
  de: {
    title: "ROI-Rechner",
    subtitle: "Geschätzte Kalkulation auf Basis der Marktbedingungen für Neubauten auf Zypern",
    conservative: "Konservativ",
    realistic: "Realistisch",
    optimistic: "Optimistisch",
    disclaimer:
      "Die Ergebnisse sind unverbindliche Schätzungen und hängen von Kaufpreis, MwSt.-Satz, Haltedauer, Verkaufskosten und Marktbedingungen ab.",
    cta: "Investmentberatung anfragen",
  },
  pl: {
    title: "Kalkulator ROI",
    subtitle:
      "Szacunkowa kalkulacja oparta na warunkach rynkowych nowych nieruchomości na Cyprze",
    conservative: "Konserwatywny",
    realistic: "Realistyczny",
    optimistic: "Optymistyczny",
    disclaimer:
      "Wyniki mają charakter orientacyjny i zależą od ceny zakupu, stawki VAT, okresu utrzymania, kosztów sprzedaży i warunków rynkowych.",
    cta: "Uzyskaj konsultację inwestycyjną",
  },
  ru: {
    title: "Калькулятор ROI",
    subtitle: "Ориентировочный расчет на основе рыночных условий для новостроек на Кипре",
    conservative: "Консервативный",
    realistic: "Реалистичный",
    optimistic: "Оптимистичный",
    disclaimer:
      "Результаты являются ориентировочными и зависят от цены покупки, ставки НДС, срока владения, расходов на продажу и рыночных условий.",
    cta: "Получить инвестиционную консультацию",
  },
  he: ROI_CALCULATOR_EN, // TODO(he)
};

export const roiCalculatorCopy = (lang: string) =>
  ROI_CALCULATOR_COPY[isLocale(lang) ? lang : "en"];
