// Sibling copy module for PropertyPhotoGallery.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROPERTY_PHOTO_GALLERY_EN = {
  more: " more",
};

export const PROPERTY_PHOTO_GALLERY_COPY: Record<Locale, typeof PROPERTY_PHOTO_GALLERY_EN> = {
  en: PROPERTY_PHOTO_GALLERY_EN,
  de: { more: " mehr" },
  pl: { more: " więcej" },
  ru: { more: " еще" },
  he: PROPERTY_PHOTO_GALLERY_EN, // TODO(he)
};

export const propertyPhotoGalleryCopy = (lang: string) =>
  PROPERTY_PHOTO_GALLERY_COPY[isLocale(lang) ? lang : "en"];
