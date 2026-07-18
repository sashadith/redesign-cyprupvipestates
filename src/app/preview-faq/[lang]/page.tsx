import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { staticAlternates, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "@/lib/seo";
import type { Translation } from "@/types/homepage";
import Nav from "../../preview-home/sections/Nav";
import Footer from "../../preview-home/sections/Footer";
import Form from "../../preview-home/sections/Form";
import LightHeroFlag from "../../preview-insights/LightHeroFlag";
import FaqExplorer from "./FaqExplorer";
import FaqMotion from "./FaqMotion";
import { getFaqPageByLang } from "@/sanity/sanity.utils";
import { faqCopy } from "./copy";

/* Cyprus VIP Estates — FAQ, redesigned. See ../[lang]/layout.tsx for why this
   lives outside src/app/[lang] despite having its own [lang] segment.
   Content (60 Q&A pairs across 9 categories) now lives in the `faqPage`
   SiteDocument (prisma.siteDocument, type="faqPage") — see
   scripts/seed-faq-translations.mjs for how it was seeded/translated, and
   src/app/preview-faq/faqData.ts for the original EN reference this was
   seeded from. */

type Props = { params: { lang: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = faqCopy(params.lang);
  const { canonical, languages } = staticAlternates(params.lang, "faq");
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: params.lang,
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT }],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function FaqPage({ params }: Props) {
  const { lang } = params;
  const faqPage = await getFaqPageByLang(lang);
  if (!faqPage) notFound();
  const { categories } = faqPage;
  const t = faqCopy(lang);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories.flatMap((cat) =>
      cat.items.map((it) => ({
        "@type": "Question",
        name: it.question,
        acceptedAnswer: { "@type": "Answer", text: it.answer.join(" ") },
      })),
    ),
  };

  const totalQuestions = categories.reduce((n, c) => n + c.items.length, 0);

  // Fixed path present in every locale that has a published faqPage row —
  // languages without one yet still serve the OLD Sanity FAQ (see
  // middleware.ts), so they're deliberately left out of the switcher rather
  // than linking to a 404.
  const publishedLangs = new Set((faqPage._translations ?? []).map((tr) => tr.language));
  const translations: Translation[] = i18n.languages
    .filter((l) => publishedLangs.has(l.id))
    .map((l) => ({ language: l.id, path: localizedHref(l.id, "faq") }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <LightHeroFlag />
      <FaqMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />
      <main className="faqp">
        <header className="faqp__hero is-light">
          <div className="wrap faqp__hero-grid">
            <div className="faqp__hero-text">
              <p className="faqp__eyebrow">{t.eyebrow}</p>
              <h1 className="faqp__hero-title">
                {t.heroTitlePart1}<span className="faqp__hero-title-lock">{t.heroTitlePart2}<span className="it">{t.heroTitlePart3Italic}</span></span>
              </h1>
              <p className="faqp__hero-lead">{t.heroLead}</p>
              <p className="faqp__hero-meta">{t.heroMeta(totalQuestions, categories.length)}</p>
            </div>

            <div className="faqp__hero-art" aria-hidden>
              <img className="faqp__hero-mark" src="/preview-assets/faq-hero-2.webp" alt="" width={1100} height={733} />
            </div>
          </div>
        </header>

        <FaqExplorer categories={categories} lang={lang} />

        <Form
          lang={lang}
          title={<>{t.formTitlePlain}<span className="it">{t.formTitleItalic}</span>?</>}
          subtitle={t.formSubtitle}
          showQuestionField
        />
      </main>
      <Footer lang={lang} />
    </>
  );
}
