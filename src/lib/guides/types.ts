import { LOCALES, type Locale } from "@/lib/locale";

/** Guides exist in every locale except Hebrew (Hebrew content is not produced without an explicit request). */
export type GuideLang = Exclude<Locale, "he">;
export const GUIDE_LANGS: readonly GuideLang[] = LOCALES.filter((l): l is GuideLang => l !== "he");

/** One block inside a section of a lead-magnet PDF guide. */
export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "table"; head: string[]; rows: string[][]; note?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "example"; title: string; rows: [string, string][]; total?: [string, string]; note?: string }
  | { type: "checklist"; title?: string; items: string[] };

export type GuideSection = { heading: string; blocks: GuideBlock[] };

/** The full text of one guide in one language. Content only: layout lives in pdf.tsx. */
export type GuideContent = {
  id: string;
  lang: GuideLang;
  title: string;
  subtitle: string;
  /** Short edition line shown on the cover, e.g. "Edition October 2026". */
  edition: string;
  /** 3-4 headline figures shown on the first page. */
  keyNumbers: { value: string; label: string }[];
  intro: string;
  sections: GuideSection[];
  nextSteps: { heading: string; text: string };
  disclaimer: string;
};
