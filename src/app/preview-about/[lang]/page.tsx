import type { Metadata } from "next";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { abs, languageAlternates } from "@/lib/seo";
import { CORPORATE_SLUGS, corporatePath, corporateTranslations, type CorporateLocale } from "@/lib/corporatePageSlugs";
import type { BenefitsBlock } from "@/types/homepage";
import type { Translation } from "@/types/homepage";
import Nav from "../../preview-home/sections/Nav";
import Footer from "../../preview-home/sections/Footer";
import Benefits from "../../preview-home/sections/Benefits";
import ContactChannels from "@/app/components/ContactChannels/ContactChannels";
import AboutMotion from "./AboutMotion";
import { aboutCopy } from "./copy";
import { getAboutPageData, getProjectCount } from "./data";

/* Cyprus VIP Estates — About, redesigned.

   REUSED, not reinvented (same discipline as preview-partners):
     - Hero: Home's own .hero/.hero__media/.hero__scrim/.hero__inner stack,
       with the page's existing team photo as a still background.
     - Stats band: the REAL Benefits component, fed the same 195/10/360°/100%
       facts the old page's benefitsBlock carried.
     - Nav / Footer: the shared preview-home sections, unchanged.
     - Buttons, eyebrows, .shimmer rules, .it gold accent: the design system's
       own classes from preview-home/tokens.css.
   New here: the team grid (the old TeamBlockComponent has no language data
   surfaced and no hover treatment), the values row, and the stance section —
   which merges three overlapping trust blocks from the old page into one. */

/* Limassol by night — the same asset the Client Presentation page uses for its
   Limassol city card, so the two surfaces share one image of the city. */
const HERO_IMAGE = "/uploads/images/7002ff319a170a66ef37739e608e14a0e3b0a9c1-2560x1441.jpg";

type Props = { params: { lang: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = params.lang;
  const t = aboutCopy(lang);
  const l = (["en", "de", "pl", "ru"].includes(lang) ? lang : "en") as CorporateLocale;

  const { canonical, languages } = languageAlternates({
    lang: l,
    slug: CORPORATE_SLUGS.about[l],
    pathFor: (lg, slug) => (lg === "en" ? `/${slug}` : `/${lg}/${slug}`),
    translations: corporateTranslations("about"),
  });

  const ogImage = abs(HERO_IMAGE);

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
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle,
      description: t.metaDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/* Thin-line icons in the same language as the Contacts channel icons and the
   DistancesStrip set: 24px viewBox, stroke-based, no fills. */
const IcoCurated = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3.2 14.6 8.6l5.9.85-4.3 4.15 1.02 5.9L12 16.66l-5.22 2.84 1.02-5.9-4.3-4.15 5.9-.85L12 3.2Z" />
  </svg>
);
const IcoFullService = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.5 12a8.5 8.5 0 1 1-3.2-6.65" />
    <path d="M8.5 12.2l2.6 2.6 6-6.4" />
  </svg>
);
const IcoAfterSales = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 10.6 12 4l8.5 6.6" />
    <path d="M5.8 9.4V19a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.4" />
    <path d="M9.7 20v-5.2h4.6V20" />
  </svg>
);
const RECEIVE_ICONS = [<IcoCurated key="a" />, <IcoFullService key="b" />, <IcoAfterSales key="c" />];

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function AboutPage({ params }: Props) {
  const { lang } = params;
  const t = aboutCopy(lang);
  const { team, reviews } = await getAboutPageData(lang);
  const projectCount = await getProjectCount();

  const translations: Translation[] = i18n.languages.map((l) => ({
    language: l.id,
    path: corporatePath("about", l.id),
  }));

  // Shaped exactly like the homepage's BenefitsBlock so the REAL Benefits
  // component renders it with zero changes. Title intentionally empty — this
  // page supplies its own eyebrow/heading above the band (Benefits.tsx's own
  // highlight logic is hardcoded to the word "Cyprus" and isn't reusable).
  const benefitsBlock: BenefitsBlock = {
    _key: "about-stats",
    _type: "benefitsBlock",
    title: "",
    benefits: t.stats.map((s, i) => ({
      _key: `stat-${i}`,
      _type: "benefits",
      counting: {
        _key: `c-${i}`,
        _type: "counting",
        // The projects figure comes from the database (see getProjectCount);
        // the rest are editorial constants.
        conuntNumber: s.live === "projects" ? projectCount : s.number,
        sign: s.sign ?? "",
      },
      title: s.title,
      description: s.description,
    })),
  } as BenefitsBlock;

  // Three, not ten — the full set lives on the Client Stories page.
  const featuredReviews = reviews.slice(0, 3);

  return (
    <>
      <AboutMotion />
      <Nav lang={lang} translations={translations} homeHref={localizedHref(lang)} />

      <main className="abt">
        {/* ------------------------------------------------------------ HERO */}
        <section className="hero abt__hero">
          <div className="hero__media abt__hero-media">
            <img src={HERO_IMAGE} alt={t.heroImageAlt} fetchPriority="high" />
          </div>
          <div className="hero__scrim" aria-hidden />
          <div className="hero__inner wrap">
            {/* Same structure as the homepage/partners hero: the h1 IS
                .hero__title (which carries the display font-size); brand and
                headline are spans inside it. Putting .hero__headline on the
                h1 itself left it at the browser-default size — and SplitText
                then froze that broken one-word-per-line wrap permanently. */}
            <h1 className="hero__title abt__hero-title">
              <span className="hero__brand">{t.heroEyebrow}</span>
              <span className="hero__headline">
                {t.heroTitle[0]}
                <span className="it">{t.heroTitle[1]}</span>
                {t.heroTitle[2]}
              </span>
            </h1>
            <div className="hero__stripe shimmer" aria-hidden />
            <p className="hero__desc abt__hero-lead">{t.heroLead}</p>
            <div className="hero__cta">
              <a className="btn btn--glass" href="#team">
                <span>{t.heroCta}</span>
              </a>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- STANCE */}
        <section className="section is-light abt__stance">
          <div className="wrap abt__stance-grid">
            <div className="abt__stance-head">
              <p className="abt__eyebrow">{t.stanceEyebrow}</p>
              <h2 className="abt__title abt__stance-title">{t.stanceTitle}</h2>
            <hr className="shimmer abt__stripe" />
            </div>
            <div className="abt__stance-body">
              {t.stanceBody.map((p, i) => (
                <p key={i} className={i === 0 ? "abt__stance-lead" : "abt__stance-p"}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- STATS */}
        <section className="section abt__stats">
          <div className="wrap">
            <p className="abt__eyebrow">{t.statsEyebrow}</p>
            <h2 className="abt__title">{t.statsTitle}</h2>
            <hr className="shimmer abt__stripe" />
          </div>
          <Benefits block={benefitsBlock} />
        </section>

        {/* ------------------------------------------------------- HOW WE WORK */}
        <section className="section is-light abt__work">
          <div className="wrap">
            <p className="abt__eyebrow">{t.workEyebrow}</p>
            <h2 className="abt__title">{t.workTitle}</h2>
            <hr className="shimmer abt__stripe" />
            <ol className="abt__steps">
              {t.work.map((w, i) => (
                <li className="abt__step" key={w.title}>
                  <span className="abt__step-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="abt__step-title">{w.title}</h3>
                  <p className="abt__step-desc">{w.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------- WHAT YOU RECEIVE */}
        <section className="section is-light abt__receive">
          <div className="wrap">
            <p className="abt__eyebrow">{t.receiveEyebrow}</p>
            <h2 className="abt__title">{t.receiveTitle}</h2>
            <hr className="shimmer abt__stripe" />
            <ul className="abt__cards">
              {t.receive.map((r, i) => (
                <li className="abt__card" key={r.title}>
                  <span className="abt__card-medallion" aria-hidden>{RECEIVE_ICONS[i]}</span>
                  <h3 className="abt__card-title">{r.title}</h3>
                  <p className="abt__card-desc">{r.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------- VALUES */}
        <section className="section abt__values">
          <div className="wrap">
            <p className="abt__eyebrow">{t.valuesEyebrow}</p>
            <h2 className="abt__title">{t.valuesTitle}</h2>
            <hr className="shimmer abt__stripe" />
            <ul className="abt__values-grid">
              {t.values.map((v, i) => (
                <li className="abt__value" key={v.title}>
                  <span className="abt__value-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="abt__value-title">{v.title}</h3>
                  <p className="abt__value-desc">{v.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ TEAM */}
        <section className="section is-light abt__team" id="team">
          <div className="wrap">
            <p className="abt__eyebrow">{t.teamEyebrow}</p>
            <h2 className="abt__title">{t.teamTitle}</h2>
            <hr className="shimmer abt__stripe" />
            <p className="abt__lead">{t.teamLead}</p>
            <ul className="abt__team-grid">
              {team.map((m) => (
                <li className="abt__member" key={m.name}>
                  <div className="abt__member-photo">
                    {m.photo ? <img src={m.photo} alt={m.alt} loading="lazy" /> : <span className="abt__member-ph" aria-hidden />}
                  </div>
                  <h3 className="abt__member-name">{m.name}</h3>
                  <p className="abt__member-role">{m.position}</p>
                  {m.languages.length > 0 && (
                    <p className="abt__member-langs">
                      <span className="abt__member-langs-label">{t.teamSpeaks}</span>
                      {m.languages.join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --------------------------------------------------------- STORIES */}
        {featuredReviews.length > 0 && (
          <section className="section abt__stories">
            <div className="wrap">
              <p className="abt__eyebrow">{t.storiesEyebrow}</p>
              <h2 className="abt__title">{t.storiesTitle}</h2>
            <hr className="shimmer abt__stripe" />
              <p className="abt__lead">{t.storiesLead}</p>
              <div className="abt__quotes">
                {featuredReviews.map((r) => (
                  <figure className="abt__quote" key={r.name}>
                    <blockquote className="abt__quote-text">{r.text}</blockquote>
                    <figcaption className="abt__quote-by">
                      {r.photo && <img className="abt__quote-photo" src={r.photo} alt="" loading="lazy" />}
                      <span>{r.name}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <a className="btn btn--ghost abt__stories-all" href={localizedHref(lang, "case-studies")}>
                <span>{t.storiesAll}</span>
              </a>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------- CTA */}
        <section className="section is-light abt__cta">
          <div className="wrap abt__cta-inner">
            <h2 className="abt__title abt__cta-title">{t.ctaTitle}</h2>
            <hr className="shimmer abt__stripe" />
            <p className="abt__lead">{t.ctaLead}</p>
            {/* The same three direct-contact cards the Contacts page uses —
                one shared component, so the two can't drift apart. */}
            <ContactChannels
              labels={{
                whatsapp: t.channelWhatsapp, phone: t.channelPhone, email: t.channelEmail,
                hint: t.channelHint,
              }}
            />
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </>
  );
}
