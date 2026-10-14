import type { GuideLang } from "@/lib/guides/types";

export type GuidesPageCopy = {
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  heroTitle: [string, string, string];
  heroLead: string;
  heroCta: string;
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
    metaTitle: "Free Guides on Buying Property in Cyprus (PDF) | Cyprus VIP Estates",
    metaDescription:
      "Four free PDF guides: the true cost of buying, the step-by-step buying process with a due-diligence checklist, rent or buy, and permanent residence through property. Figures as of October 2026.",
    heroEyebrow: "Free guides",
    heroTitle: ["Four free guides to ", "buying property", " in Cyprus"],
    heroLead:
      "Costs, the buying process, rent or buy, and residence rules, each in one document. Written from our published articles, with worked examples and figures as of October 2026.",
    heroCta: "Choose a guide",
    listEyebrow: "The guides",
    listTitle: "Pick the question you need answered",
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
    metaTitle: "Kostenlose Ratgeber zum Immobilienkauf auf Zypern (PDF) | Cyprus VIP Estates",
    metaDescription:
      "Vier kostenlose PDF-Ratgeber: die wahren Kosten des Kaufs, der Kaufablauf Schritt für Schritt mit Prüfliste, Mieten oder Kaufen und Daueraufenthalt durch Immobilienkauf. Stand Oktober 2026.",
    heroEyebrow: "Kostenlose Ratgeber",
    heroTitle: ["Vier kostenlose Ratgeber zum ", "Immobilienkauf", " auf Zypern"],
    heroLead:
      "Kosten, Kaufablauf, Mieten oder Kaufen und Aufenthaltsrecht, jeweils in einem Dokument. Erarbeitet aus unseren veröffentlichten Artikeln, mit Rechenbeispielen und Zahlen mit Stand Oktober 2026.",
    heroCta: "Ratgeber auswählen",
    listEyebrow: "Die Ratgeber",
    listTitle: "Wählen Sie die Frage, die Sie klären möchten",
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
    metaTitle: "Bezpłatne przewodniki o zakupie nieruchomości na Cyprze (PDF) | Cyprus VIP Estates",
    metaDescription:
      "Cztery bezpłatne przewodniki PDF: prawdziwy koszt zakupu, proces zakupu krok po kroku z listą kontrolną, wynajem czy zakup oraz pobyt stały przez zakup nieruchomości. Stan na październik 2026.",
    heroEyebrow: "Bezpłatne przewodniki",
    heroTitle: ["Cztery bezpłatne przewodniki po ", "zakupie nieruchomości", " na Cyprze"],
    heroLead:
      "Koszty, proces zakupu, wynajem czy zakup oraz zasady pobytu, każdy temat w jednym dokumencie. Opracowane na podstawie naszych artykułów, z przykładami obliczeń i liczbami według stanu na październik 2026.",
    heroCta: "Wybierz przewodnik",
    listEyebrow: "Przewodniki",
    listTitle: "Wybierz pytanie, na które szukasz odpowiedzi",
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
    metaTitle: "Бесплатные гайды по покупке недвижимости на Кипре (PDF) | Cyprus VIP Estates",
    metaDescription:
      "Четыре бесплатных PDF-гайда: реальная стоимость покупки, пошаговый процесс покупки с чек-листом проверки, аренда или покупка и ПМЖ через покупку недвижимости. Данные на октябрь 2026.",
    heroEyebrow: "Бесплатные гайды",
    heroTitle: ["Четыре бесплатных гайда по ", "покупке недвижимости", " на Кипре"],
    heroLead:
      "Расходы, процесс покупки, аренда или покупка и правила ПМЖ, каждая тема в одном документе. Составлены по нашим опубликованным статьям, с примерами расчётов и цифрами на октябрь 2026 года.",
    heroCta: "Выбрать гайд",
    listEyebrow: "Гайды",
    listTitle: "Выберите вопрос, на который нужен ответ",
    stepsEyebrow: "Как это работает",
    stepsTitle: "От формы до PDF за минуту",
    steps: [
      { title: "Выберите гайд", text: "Каждый посвящён одному решению: таблицы, пример расчёта и чек-лист." },
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
