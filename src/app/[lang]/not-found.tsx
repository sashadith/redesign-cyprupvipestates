// app/[lang]/not-found.tsx
import type { Metadata } from "next";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import { getNotFoundPageByLang } from "@/sanity/sanity.utils";

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

export default async function NotFound() {
  const lang = "en";

  const notFoundPage = await getNotFoundPageByLang(lang);

  return (
    <>
      <Header params={{ lang }} translations={[]} />
      <NotFoundPageComponent notFoundPage={notFoundPage} lang={lang} />
      <Footer params={{ lang }} />
    </>
  );
}
