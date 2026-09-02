import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { i18n } from "@/i18n.config";
import { isLocale, localizedHref } from "@/lib/locale";
import { getSinglePageByLang } from "@/sanity/sanity.utils";
import type { Translation } from "@/types/homepage";

import Nav from "@/app/preview-home/sections/Nav";
import Footer from "@/app/preview-home/sections/Footer";
import LandingBody from "../../LandingBody";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Params = { params: { lang: string; slug: string[] } };

/* The preview tree renders the same body the live catch-all does, wrapped in
   the redesign's own nav and footer instead of the site's shared chrome. It
   exists so a landing page can be compared against its live version before
   anything is cut over; noindex is set in this tree's layout. */
export default async function PreviewLandingPage({ params }: Params) {
  const { lang } = params;
  if (!isLocale(lang)) notFound();

  // Slugs can be multi-segment (parent/child), exactly as the live catch-all
  // resolves them — join rather than take the first, or a child page 404s.
  const slug = (params.slug ?? []).join("/");
  const page = (await getSinglePageByLang(lang, slug)) as any;
  if (!page) notFound();

  // The language switcher carries the slug across unchanged. Right for the
  // pages whose slug is identical in every language, wrong for the rest —
  // acceptable in a preview tree, and moot once the live route serves this
  // body with its own translations.
  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: l.id === "en" ? `/${slug}` : `/${l.id}/${slug}`,
  }));

  return (
    <>
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />
      <LandingBody page={page} lang={lang} />
      <Footer lang={lang} />
    </>
  );
}
