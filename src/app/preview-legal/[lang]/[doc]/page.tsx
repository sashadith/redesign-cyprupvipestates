import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { languageAlternates } from "@/lib/seo";
import { CORPORATE_SLUGS, corporatePath, corporateTranslations, type CorporateLocale, type CorporatePage } from "@/lib/corporatePageSlugs";
import type { Translation } from "@/types/homepage";
import Nav from "../../../preview-home/sections/Nav";
import Footer from "../../../preview-home/sections/Footer";
import LegalMotion from "./LegalMotion";
import LegalToc from "./LegalToc";
import { getLegalDoc, isLegalDocKey } from "./registry";
import type { LegalBlock } from "./types";

/* Privacy Policy and Terms & Conditions share one route and one layout — they
   are the same KIND of document (a dated, sectioned legal text that people
   scan for one specific clause), and giving them two near-identical
   implementations would guarantee they drift apart.

   The reading experience is built around scanning, not reading front to back:
   a sticky table of contents on the left, generous measure on the right,
   every section deep-linkable by a stable, untranslated anchor, and a
   prominent "last updated" date — which the old pages did not have at all. */

type Props = { params: { lang: string; doc: string } };

const LOCALES = ["en", "de", "pl", "ru"] as const;

export async function generateStaticParams() {
  return LOCALES.flatMap((lang) => ["privacy", "terms"].map((doc) => ({ lang, doc })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, doc } = params;
  if (!isLegalDocKey(doc)) return {};
  const t = getLegalDoc(doc, lang);
  if (!t) return {};

  const l = (LOCALES as readonly string[]).includes(lang) ? (lang as CorporateLocale) : "en";
  const page: CorporatePage = doc === "privacy" ? "privacy" : "terms";

  const { canonical, languages } = languageAlternates({
    lang: l,
    slug: CORPORATE_SLUGS[page][l],
    pathFor: (lg, slug) => (lg === "en" ? `/${slug}` : `/${lg}/${slug}`),
    translations: corporateTranslations(page),
  });

  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical, languages },
    // Legal boilerplate has no business competing in search results, but it
    // must stay indexable — several jurisdictions expect these pages to be
    // publicly reachable, and trust signals depend on them being findable.
    openGraph: { title: t.metaTitle, description: t.metaDescription, url: canonical, siteName: "Cyprus VIP Estates", locale: lang, type: "article" },
  };
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="lgl__p">{block.text}</p>;
    case "list":
      return (
        <ul className="lgl__list">
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    case "definitions":
      return (
        <dl className="lgl__defs">
          {block.items.map((d, i) => (
            <div className="lgl__def" key={i}>
              <dt className="lgl__def-term">{d.term}</dt>
              <dd className="lgl__def-text">{d.text}</dd>
            </div>
          ))}
        </dl>
      );
    case "callout":
      return <p className="lgl__callout">{block.text}</p>;
  }
}

export default async function LegalPage({ params }: Props) {
  const { lang, doc } = params;
  if (!isLegalDocKey(doc)) notFound();

  const t = getLegalDoc(doc, lang);
  if (!t) notFound();

  const page: CorporatePage = doc === "privacy" ? "privacy" : "terms";

  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: corporatePath(page, l.id),
  }));

  const updatedDisplay = new Intl.DateTimeFormat(
    lang === "de" ? "de-DE" : lang === "pl" ? "pl-PL" : lang === "ru" ? "ru-RU" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(t.updated));

  // The sibling document, linked at the foot of the page — someone reading
  // the privacy policy is one click from the terms and vice versa.
  const siblingPage: CorporatePage = page === "privacy" ? "terms" : "privacy";
  const sibling = getLegalDoc(siblingPage === "privacy" ? "privacy" : "terms", lang);

  return (
    <>
      <LegalMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />

      <main className="lgl">
        <header className="lgl__head">
          <div className="wrap">
            <p className="eyebrow lgl__eyebrow">{t.eyebrow}</p>
            <h1 className="h1 lgl__title">{t.title}</h1>
            <div className="lgl__stripe shimmer" aria-hidden />
            <p className="lead lgl__intro">{t.intro}</p>
            <p className="lgl__updated">
              <span className="lgl__updated-label">{t.updatedLabel}</span>
              <time dateTime={t.updated}>{updatedDisplay}</time>
            </p>
          </div>
        </header>

        <div className="lgl__bodywrap is-light"><div className="wrap lgl__body">
          <LegalToc label={t.tocLabel} sections={t.sections.map((s) => ({ id: s.id, title: s.title }))} />

          <div className="lgl__content">
            {t.sections.map((s) => (
              <section className="lgl__section" id={s.id} key={s.id}>
                <h2 className="lgl__section-title">{s.title}</h2>
                {s.blocks.map((b, i) => <Block block={b} key={i} />)}
              </section>
            ))}

            <section className="lgl__contact">
              <h2 className="lgl__section-title">{t.contactTitle}</h2>
              <p className="lgl__p">{t.contactText}</p>
              {sibling && (
                <p className="lgl__sibling">
                  <a href={corporatePath(siblingPage, lang)}>{sibling.title}</a>
                </p>
              )}
            </section>
          </div>
        </div>
        </div>
      </main>

      <Footer lang={lang} />
    </>
  );
}
