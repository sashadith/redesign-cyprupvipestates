import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

// English is the new canonical/default language (all locales use explicit URL prefixes).
const languages = [
  { id: "en", title: "English", isDefault: true },
  { id: "de", title: "German" },
  { id: "pl", title: "Polish" },
  { id: "ru", title: "Russian" },
];

export const i18n = {
  languages,
  base: languages.find((item) => item.isDefault)?.id,
};

export const locales = languages?.map((el) => el.id);
export const defaultLocale = languages?.find((el) => el.isDefault)?.id || "en";

export default getRequestConfig(async ({ locale }) => {
  if (!locales.includes(locale as any)) {
    notFound();
  }

  return {
    messages: undefined,
  };
});
