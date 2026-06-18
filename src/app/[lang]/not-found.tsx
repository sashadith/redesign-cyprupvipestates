// app/[lang]/not-found.tsx
import type { Metadata } from "next";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";
import NotFoundPageComponent from "@/app/components/NotFoundPageComponent/NotFoundPageComponent";
import { getNotFoundPageByLang } from "@/sanity/sanity.utils";

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
