// app/[lang]/not-found.tsx
import type { Metadata } from "next";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import { getNotFoundPageByLang } from "@/sanity/sanity.utils";
import { headers } from "next/headers";
import { isLocale } from "@/lib/locale";

// Same stylesheet set the landing/article routes load — the 404 body is
// built from those same classes rather than its own SCSS module.
import "@/app/preview-home/tokens.css";
import "@/app/preview-insights/insights.css";
import "@/app/preview-landing/landing.css";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/* A not-found boundary gets no `params` — Next renders it outside the matched
   route — so this page used to hardcode "en" and served the English copy to
   German, Polish and Russian visitors even though all four translations exist
   in the CMS.

   next-intl's middleware already stamps the resolved locale on the request as
   x-next-intl-locale, so read that rather than adding a second locale header.
   Its own getLocale() is NOT usable here: it resolves through i18n.config's
   getRequestConfig, which calls notFound() for an unknown locale — throwing
   inside the very boundary that call renders. Reading the header skips that
   path entirely.

   Any failure falls back to English: a 404 in the wrong language is a small
   problem, a crash on the page a lost visitor just landed on is not. */
function resolveLang(): string {
  try {
    const detected = headers().get("x-next-intl-locale") ?? "";
    return isLocale(detected) ? detected : "en";
  } catch {
    return "en";
  }
}

export default async function NotFound() {
  const lang = resolveLang();

  const notFoundPage = await getNotFoundPageByLang(lang);

  return (
    <>
      <Header params={{ lang }} translations={[]} />
      <NotFoundPageComponent notFoundPage={notFoundPage} lang={lang} />
      <Footer params={{ lang }} />
    </>
  );
}
