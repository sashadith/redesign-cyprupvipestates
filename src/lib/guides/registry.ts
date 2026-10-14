import articles from "./articles.json";
import { GUIDE_LANGS, type GuideContent, type GuideLang } from "./types";
import costEn from "./content/cost-of-buying.en.json";
import costDe from "./content/cost-of-buying.de.json";
import costPl from "./content/cost-of-buying.pl.json";
import costRu from "./content/cost-of-buying.ru.json";
import procEn from "./content/buying-process.en.json";
import procDe from "./content/buying-process.de.json";
import procPl from "./content/buying-process.pl.json";
import procRu from "./content/buying-process.ru.json";
import rentEn from "./content/rent-or-buy.en.json";
import rentDe from "./content/rent-or-buy.de.json";
import rentPl from "./content/rent-or-buy.pl.json";
import rentRu from "./content/rent-or-buy.ru.json";
import resEn from "./content/residency.en.json";
import resDe from "./content/residency.de.json";
import resPl from "./content/residency.pl.json";
import resRu from "./content/residency.ru.json";

export const GUIDE_IDS = ["cost-of-buying", "buying-process", "rent-or-buy", "residency"] as const;
export type GuideId = (typeof GUIDE_IDS)[number];

/** The four JSON files of one guide, in GUIDE_LANGS order (en, de, pl, ru). */
function byLang(...files: unknown[]): Record<GuideLang, GuideContent> {
  return Object.fromEntries(GUIDE_LANGS.map((l, i) => [l, files[i] as GuideContent])) as Record<GuideLang, GuideContent>;
}

const CONTENT: Record<GuideId, Record<GuideLang, GuideContent>> = {
  "cost-of-buying": byLang(costEn, costDe, costPl, costRu),
  "buying-process": byLang(procEn, procDe, procPl, procRu),
  "rent-or-buy": byLang(rentEn, rentDe, rentPl, rentRu),
  residency: byLang(resEn, resDe, resPl, resRu),
};

export function isGuideId(v: unknown): v is GuideId {
  return typeof v === "string" && (GUIDE_IDS as readonly string[]).includes(v);
}

export function isGuideLang(v: unknown): v is GuideLang {
  return typeof v === "string" && (GUIDE_LANGS as readonly string[]).includes(v);
}

/** `he` and any unknown locale read the English guide. */
export function guideLangFor(lang: string): GuideLang {
  return isGuideLang(lang) ? lang : "en";
}

export function getGuideContent(id: GuideId, lang: string): GuideContent {
  return CONTENT[id][guideLangFor(lang)];
}

/** Which guide an article (by language + slug) offers. One article offers at most one guide. */
const ARTICLE_TO_GUIDE = new Map<string, GuideId>();
for (const id of GUIDE_IDS) {
  const perLang = (articles as Record<string, Record<string, string[]>>)[id] ?? {};
  for (const [lang, slugs] of Object.entries(perLang)) for (const slug of slugs) ARTICLE_TO_GUIDE.set(`${lang}:${slug}`, id);
}
export function guideForArticle(lang: string, slug: string): GuideId | null {
  return ARTICLE_TO_GUIDE.get(`${lang}:${slug}`) ?? null;
}

export type GuideTeaser = { id: GuideId; lang: GuideLang; title: string; subtitle: string; edition: string; inside: string[] };
export function guideTeaser(id: GuideId, lang: string): GuideTeaser {
  const c = getGuideContent(id, lang);
  return { id, lang: c.lang, title: c.title, subtitle: c.subtitle, edition: c.edition, inside: c.sections.slice(0, 4).map((s) => s.heading) };
}

export type GuideUi = {
  eyebrow: string;
  insideLabel: string;
  button: string;
  formTitle: string;
  formHint: string;
  readyTitle: string;
  readyText: string;
  download: string;
  fileMeta: string;
};

export const GUIDE_UI: Record<GuideLang, GuideUi> = {
  en: {
    eyebrow: "Free PDF guide",
    insideLabel: "What is inside",
    button: "Get the free guide",
    formTitle: "Where should we send the guide?",
    formHint: "You can download it right after submitting. A copy goes to your e-mail.",
    readyTitle: "Your guide is ready",
    readyText: "We have also sent a copy to your e-mail. The link works for 30 days.",
    download: "Download the PDF",
    fileMeta: "PDF, English",
  },
  de: {
    eyebrow: "Kostenloser PDF-Ratgeber",
    insideLabel: "Das steht drin",
    button: "Ratgeber kostenlos erhalten",
    formTitle: "Wohin dürfen wir den Ratgeber senden?",
    formHint: "Sie können ihn direkt nach dem Absenden herunterladen. Eine Kopie geht an Ihre E-Mail-Adresse.",
    readyTitle: "Ihr Ratgeber ist bereit",
    readyText: "Eine Kopie haben wir Ihnen auch per E-Mail geschickt. Der Link ist 30 Tage gültig.",
    download: "PDF herunterladen",
    fileMeta: "PDF, Deutsch",
  },
  pl: {
    eyebrow: "Bezpłatny przewodnik PDF",
    insideLabel: "Co zawiera",
    button: "Pobierz bezpłatny przewodnik",
    formTitle: "Gdzie wysłać przewodnik?",
    formHint: "Możesz go pobrać zaraz po wysłaniu formularza. Kopia trafi też na Twój adres e-mail.",
    readyTitle: "Twój przewodnik jest gotowy",
    readyText: "Kopię wysłaliśmy także e-mailem. Link działa przez 30 dni.",
    download: "Pobierz PDF",
    fileMeta: "PDF, polski",
  },
  ru: {
    eyebrow: "Бесплатный PDF-гайд",
    insideLabel: "Что внутри",
    button: "Получить гайд бесплатно",
    formTitle: "Куда отправить гайд?",
    formHint: "Скачать его можно сразу после отправки формы. Копия придёт на вашу почту.",
    readyTitle: "Ваш гайд готов",
    readyText: "Копию мы также отправили на вашу почту. Ссылка действует 30 дней.",
    download: "Скачать PDF",
    fileMeta: "PDF, русский",
  },
};
