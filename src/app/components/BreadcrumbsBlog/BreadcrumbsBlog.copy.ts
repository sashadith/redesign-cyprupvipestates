// Sibling copy module for BreadcrumbsBlog.tsx — moved out of the component
// (Hebrew Localization Phase 4, controller amendment 2) so the copy tables
// are loadable by the snapshot/meta-length gates without pulling in the
// component's CSS module.
import type { Locale } from "@/lib/locale";

export const BLOG_LABEL_BY_LANG: Record<Locale, string> = {
  en: "Blog",
  de: "Blog",
  pl: "Blog",
  ru: "Блог",
  he: "Blog", // TODO(he)
};

export const HOME_LABEL_BY_LANG: Record<Locale, string> = {
  en: "Home",
  de: "Startseite",
  pl: "Strona główna",
  ru: "Главная",
  he: "Home", // TODO(he)
};
