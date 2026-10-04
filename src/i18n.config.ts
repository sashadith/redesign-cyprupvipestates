import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_LABELS, PUBLIC_LOCALES } from "@/lib/locale";

// Derived from lib/locale.ts (single source). Only PUBLIC locales are listed
// here: this object drives the next-intl middleware and the language switchers.
const TITLES: Record<string, string> = { en: "English", de: "German", pl: "Polish", ru: "Russian", he: "Hebrew" };
const languages = PUBLIC_LOCALES.map((id) => ({
  id,
  title: TITLES[id] ?? LOCALE_LABELS[id].name,
  isDefault: id === DEFAULT_LOCALE,
}));

export const i18n = { languages, base: DEFAULT_LOCALE };
export const locales = languages.map((el) => el.id);
export const defaultLocale = DEFAULT_LOCALE;

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as any)) notFound();
  return { messages: undefined };
});
