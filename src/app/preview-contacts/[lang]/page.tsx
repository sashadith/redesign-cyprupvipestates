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
import ConsultantFinder, { type FinderMember } from "./ConsultantFinder";
import OfficeHours from "./OfficeHours";
import { contactsCopy, CHANNELS } from "./copy";
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

const IcoWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" aria-hidden>
    <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 8.6c.3-.1.6 0 .8.3l.8 1.3c.1.2.1.5 0 .7l-.4.6c.5 1 1.3 1.8 2.3 2.3l.6-.4c.2-.1.5-.1.7 0l1.3.8c.3.2.4.5.3.8-.2.6-.8 1-1.5 1-2.8-.2-5-2.4-5.2-5.2 0-.7.4-1.3 1-1.5Z" fill="currentColor" />
  </svg>
);
const IcoPhone = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.6c0 .6-.4 1-1 1C10.6 21.1 2.9 13.4 2.9 3.7c0-.6.4-1 1-1H7.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />
  </svg>
);
const IcoMail = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <path d="M3 6.5 12 13l9-6.5" />
  </svg>
);
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

  const waHref = `https://wa.me/${CHANNELS.whatsappNumber.replace(/[^\d]/g, "")}`;
  const telHref = `tel:${CHANNELS.phoneNumber.replace(/[^\d+]/g, "")}`;

  const channels = [
    { key: "whatsapp", href: waHref, ico: <IcoWhatsApp />, title: t.channelWhatsapp, value: CHANNELS.whatsappNumber, hint: t.channelHint.whatsapp, external: true },
    { key: "phone", href: telHref, ico: <IcoPhone />, title: t.channelPhone, value: CHANNELS.phoneNumber, hint: t.channelHint.phone, external: false },
    { key: "email", href: `mailto:${CHANNELS.email}`, ico: <IcoMail />, title: t.channelEmail, value: CHANNELS.email, hint: t.channelHint.email, external: false },
  ];

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
            <ul className="cnt__channel-grid">
              {channels.map((c, i) => (
                <li key={c.key}>
                  <a
                    className={`cnt__channel cnt__channel--${c.key}`}
                    href={c.href}
                    {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="cnt__channel-index" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    <span className="cnt__channel-medallion" aria-hidden>{c.ico}</span>
                    <span className="cnt__channel-title">{c.title}</span>
                    <span className="cnt__channel-value">{c.value}</span>
                    <span className="cnt__channel-hint">{c.hint}</span>
                    <span className="cnt__channel-go" aria-hidden>
                      <Arrow />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
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
