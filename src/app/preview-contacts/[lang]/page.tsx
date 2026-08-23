import type { Metadata } from "next";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { languageAlternates } from "@/lib/seo";
import { CORPORATE_SLUGS, corporatePath, corporateTranslations, type CorporateLocale } from "@/lib/corporatePageSlugs";
import type { Translation } from "@/types/homepage";
import Nav from "../../preview-home/sections/Nav";
import Footer from "../../preview-home/sections/Footer";
import Form from "../../preview-home/sections/Form";
import ContactsMotion from "./ContactsMotion";
import ContactChannels from "@/app/components/ContactChannels/ContactChannels";
import ConsultantFinder, { type FinderMember } from "./ConsultantFinder";
import OfficeHours from "./OfficeHours";
import { contactsCopy } from "./copy";
import { getContactsPageData } from "./data";
import { toLanguageKey } from "./languages";

/* Cyprus VIP Estates — Contacts, redesigned as a ROUTING page.

   The old page put a generic form next to the same ten-person roster the
   About page already carried, with nothing to say who handles what. Here the
   order follows what a visitor actually needs, most-direct first:
     1. the three direct channels, with a LIVE open/closed badge
     2. "find a consultant who speaks your language" — real filtering over the
        one attribute the stored team data genuinely supports
     3. the form, as the fallback for anyone who would rather write
     4. the office, for anyone who wants to walk in

   REUSED: Nav, Footer and the shared Form component from preview-home (the
   same one every other redesigned page's form uses, posting to the same
   endpoint with the same validation) — not a re-implementation. */

type Props = { params: { lang: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = params.lang;
  const t = contactsCopy(lang);
  const l = (["en", "de", "pl", "ru"].includes(lang) ? lang : "en") as CorporateLocale;

  const { canonical, languages } = languageAlternates({
    lang: l,
    slug: CORPORATE_SLUGS.contacts[l],
    pathFor: (lg, slug) => (lg === "en" ? `/${slug}` : `/${lg}/${slug}`),
    translations: corporateTranslations("contacts"),
  });

  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: lang,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: t.metaTitle, description: t.metaDescription },
  };
}

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function ContactsPage({ params }: Props) {
  const { lang } = params;
  const t = contactsCopy(lang);
  const { team, heroImage, heroAlt } = await getContactsPageData(lang);

  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: corporatePath("contacts", l.id),
  }));

  const members: FinderMember[] = team.map((m) => {
    const languageRaw: Record<string, string> = {};
    const languageKeys = m.languages.map((raw) => {
      const key = toLanguageKey(raw);
      languageRaw[key] = raw;
      return key;
    });
    return { name: m.name, position: m.position, photo: m.photo, alt: m.alt, languageKeys, languageRaw };
  });

  return (
    <>
      <ContactsMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />

      <main className="cnt">
        {/* ------------------------------------------------------------ HERO */}
        {/* Same construction as the About hero (and the homepage/partners
            pattern it follows): full-bleed photo + scrim, with the h1 carrying
            .hero__title and brand/headline as spans inside it. The photo is
            this page's own previewImage from the singlepage row. */}
        <section className="hero cnt__hero">
          <div className="hero__media cnt__hero-media">
            {heroImage && <img src={heroImage} alt={heroAlt} fetchPriority="high" />}
          </div>
          <div className="hero__scrim" aria-hidden />
          <div className="hero__inner wrap">
            <h1 className="hero__title cnt__hero-title">
              <span className="hero__brand">{t.heroEyebrow}</span>
              <span className="hero__headline">
                {t.heroTitle[0]}
                <span className="it">{t.heroTitle[1]}</span>
                {t.heroTitle[2]}
              </span>
            </h1>
            <div className="hero__stripe shimmer" aria-hidden />
            <p className="hero__desc cnt__hero-lead">{t.heroLead}</p>
            <OfficeHours
              labels={{
                label: t.hoursLabel, value: t.hoursValue, open: t.hoursOpen,
                closed: t.hoursClosed, opensAt: t.hoursOpensAt, timezone: t.hoursTimezone,
              }}
            />
          </div>
        </section>

        {/* -------------------------------------------------------- CHANNELS */}
        <section className="section is-light cnt__channels">
          <div className="wrap">
            <p className="cnt__eyebrow">{t.channelsEyebrow}</p>
            <h2 className="cnt__title">{t.channelsTitle}</h2>
            <hr className="shimmer cnt__stripe" />
            <ContactChannels
              labels={{
                whatsapp: t.channelWhatsapp, phone: t.channelPhone, email: t.channelEmail,
                hint: t.channelHint,
              }}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------- FINDER */}
        <section className="section cnt__finder-sec" id="team">
          <div className="wrap">
            <p className="cnt__eyebrow">{t.finderEyebrow}</p>
            <h2 className="cnt__title">{t.finderTitle}</h2>
            <hr className="shimmer cnt__stripe" />
            <p className="cnt__lead">{t.finderLead}</p>
            <ConsultantFinder
              members={members}
              lang={lang}
              labels={{
                languageLabel: t.finderLanguageLabel, all: t.finderAll, empty: t.finderEmpty,
                countOne: t.finderCountOne, countMany: t.finderCountMany, speaks: t.speaks,
              }}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------ FORM */}
        <section className="section cnt__form-sec" id="form">
          <Form
            lang={lang}
            title={
              <span className="cnt__title">
                {t.formTitle[0]}
                <span className="it">{t.formTitle[1]}</span>
                {t.formTitle[2]}
              </span>
            }
            subtitle={t.formLead}
          />
        </section>

      </main>

      <Footer lang={lang} />
    </>
  );
}
