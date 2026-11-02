import type { GuideLang } from "@/lib/guides/types";

export type GuidesPageCopy = {
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  heroTitle: [string, string, string];
  heroLead: string;
  heroCta: string;
  /** Second hero button: jumps to the free PDF guides block. */
  heroCta2: string;
  listEyebrow: string;
  listTitle: string;
  stepsEyebrow: string;
  stepsTitle: string;
  steps: { title: string; text: string }[];
  note: string;
  ctaButton: string;
  breadcrumbHome: string;
};

const COPY: Record<GuideLang, GuidesPageCopy> = {
  en: {
    metaTitle: "Cyprus Guides: Property, Tax, Residence | Cyprus VIP Estates",
    metaDescription: "Guides to buying property in Cyprus, taxes, residence permits and everyday life, with worked examples and dated figures, plus four free PDF guides.",
    heroEyebrow: "Guides",
    heroTitle: ["Guides to ", "buying property and living", " in Cyprus"],
    heroLead: "Step-by-step guides with worked examples and dated figures, from the cost of buying to taxes, residence permits and everyday life. Four of them are also available as free PDF downloads.",
    heroCta: "Browse all guides",
    heroCta2: "Free PDF guides",
    listEyebrow: "Free PDF guides",
    listTitle: "Four guides to download",
    stepsEyebrow: "How it works",
    stepsTitle: "From the form to the PDF in a minute",
    steps: [
      { title: "Choose a guide", text: "Each one covers a single decision, with tables, a worked example and a checklist." },
      { title: "Leave your details", text: "Name, phone and e-mail, the same short form as everywhere on the site." },
      { title: "Download at once", text: "The PDF opens immediately and a copy goes to your e-mail. The link works for 30 days." },
    ],
    note: "General information as of October 2026, not legal or tax advice. Check every figure with a licensed lawyer or tax adviser before you commit.",
    ctaButton: "Ask for a consultation",
    breadcrumbHome: "Home",
  },
  de: {
    metaTitle: "Zypern-Ratgeber: Immobilien, Steuern, Aufenthalt | Cyprus VIP Estates",
    metaDescription: "Ratgeber zu Immobilienkauf, Steuern, Aufenthaltstiteln und Alltag auf Zypern, mit Rechenbeispielen und datierten Zahlen, dazu vier kostenlose PDF-Ratgeber.",
    heroEyebrow: "Ratgeber",
    heroTitle: ["Ratgeber zu ", "Immobilienkauf und Leben", " auf Zypern"],
    heroLead: "Ratgeber Schritt für Schritt, mit Rechenbeispielen und datierten Zahlen: von den Kaufkosten über Steuern und Aufenthaltstitel bis zum Alltag. Vier davon gibt es zusätzlich als kostenlosen PDF-Download.",
    heroCta: "Alle Ratgeber ansehen",
    heroCta2: "Kostenlose PDF-Ratgeber",
    listEyebrow: "Kostenlose PDF-Ratgeber",
    listTitle: "Vier Ratgeber zum Herunterladen",
    stepsEyebrow: "So funktioniert es",
    stepsTitle: "Vom Formular zum PDF in einer Minute",
    steps: [
      { title: "Ratgeber auswählen", text: "Jeder behandelt eine einzelne Entscheidung, mit Tabellen, Rechenbeispiel und Prüfliste." },
      { title: "Daten eintragen", text: "Name, Telefon und E-Mail, dasselbe kurze Formular wie überall auf der Website." },
      { title: "Sofort herunterladen", text: "Das PDF öffnet sich sofort, eine Kopie geht an Ihre E-Mail-Adresse. Der Link ist 30 Tage gültig." },
    ],
    note: "Allgemeine Informationen mit Stand Oktober 2026, keine Rechts- oder Steuerberatung. Prüfen Sie jede Zahl vor dem Kauf mit einem zugelassenen Rechtsanwalt oder Steuerberater.",
    ctaButton: "Beratung anfragen",
    breadcrumbHome: "Startseite",
  },
  pl: {
    metaTitle: "Przewodniki po Cyprze: nieruchomości, podatki, pobyt | Cyprus VIP Estates",
    metaDescription: "Przewodniki o zakupie nieruchomości, podatkach, pozwoleniach na pobyt i życiu na Cyprze, z przykładami obliczeń i datowanymi liczbami, oraz cztery bezpłatne przewodniki PDF.",
    heroEyebrow: "Przewodniki",
    heroTitle: ["Przewodniki o ", "zakupie nieruchomości i życiu", " na Cyprze"],
    heroLead: "Przewodniki krok po kroku z przykładami obliczeń i datowanymi liczbami: od kosztów zakupu przez podatki i pozwolenia na pobyt po codzienne życie. Cztery z nich dostępne są także jako bezpłatne pliki PDF.",
    heroCta: "Zobacz wszystkie przewodniki",
    heroCta2: "Bezpłatne przewodniki PDF",
    listEyebrow: "Bezpłatne przewodniki PDF",
    listTitle: "Cztery przewodniki do pobrania",
    stepsEyebrow: "Jak to działa",
    stepsTitle: "Od formularza do PDF w minutę",
    steps: [
      { title: "Wybierz przewodnik", text: "Każdy dotyczy jednej decyzji, z tabelami, przykładem obliczeń i listą kontrolną." },
      { title: "Zostaw dane", text: "Imię, telefon i e-mail, ten sam krótki formularz co w całym serwisie." },
      { title: "Pobierz od razu", text: "PDF otwiera się natychmiast, a kopia trafia na Twój e-mail. Link działa przez 30 dni." },
    ],
    note: "Informacje ogólne według stanu na październik 2026, nie stanowią porady prawnej ani podatkowej. Przed decyzją sprawdź każdą liczbę z licencjonowanym prawnikiem lub doradcą podatkowym.",
    ctaButton: "Zamów konsultację",
    breadcrumbHome: "Strona główna",
  },
  ru: {
    metaTitle: "Гиды по Кипру: недвижимость, налоги, ВНЖ | Cyprus VIP Estates",
    metaDescription: "Гиды по покупке недвижимости на Кипре, налогам, видам на жительство и жизни, с расчётами на примерах и датированными цифрами, плюс четыре бесплатных PDF-гида.",
    heroEyebrow: "Гиды",
    heroTitle: ["Гиды по ", "покупке недвижимости и жизни", " на Кипре"],
    heroLead: "Пошаговые гиды с расчётами на примерах и датированными цифрами: от стоимости покупки до налогов, видов на жительство и повседневной жизни. Четыре из них можно скачать бесплатно в PDF.",
    heroCta: "Все гиды",
    heroCta2: "Бесплатные PDF-гиды",
    listEyebrow: "Бесплатные PDF-гиды",
    listTitle: "Четыре гида для скачивания",
    stepsEyebrow: "Как это работает",
    stepsTitle: "От формы до PDF за минуту",
    steps: [
      { title: "Выберите гид", text: "Каждый посвящён одному решению: таблицы, пример расчёта и чек-лист." },
      { title: "Оставьте данные", text: "Имя, телефон и email, та же короткая форма, что и везде на сайте." },
      { title: "Скачайте сразу", text: "PDF открывается сразу, а копия приходит на вашу почту. Ссылка действует 30 дней." },
    ],
    note: "Общая информация на октябрь 2026 года, не юридическая и не налоговая консультация. Перед решением проверьте каждую цифру у лицензированного юриста или налогового консультанта.",
    ctaButton: "Запросить консультацию",
    breadcrumbHome: "Главная",
  },
};

export function guidesPageCopy(lang: GuideLang): GuidesPageCopy {
  return COPY[lang];
}
