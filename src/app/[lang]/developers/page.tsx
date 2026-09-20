import "@/app/preview-home/tokens.css";
import "@/app/preview-projects/projects.css";
import "@/app/[lang]/developers/developer-catalog.css";
import "@/app/[lang]/developers/developers-index.css";

import { Metadata } from "next";
import Link from "next/link";
import Header from "@/app/components/Header/Header";
import HeaderWrapper from "@/app/components/HeaderWrapper/HeaderWrapper";
import Footer from "@/app/components/Footer/Footer";
import { i18n } from "@/i18n.config";
import { localizedHref } from "@/lib/locale";
import { ogLocale, staticAlternates } from "@/lib/seo";
import { urlFor } from "@/sanity/sanity.client";
import { getAllDevelopersByLang, getDeveloperProjectCounts } from "@/sanity/sanity.utils";
import DevAtmosphere from "@/app/[lang]/developers/[slug]/DevAtmosphere";
import ParallaxBand from "@/app/preview-home/sections/ParallaxBand";
import { getHomePageByLang } from "@/sanity/sanity.utils";
import { developersPageCopy } from "./page.copy";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const t = developersPageCopy(params.lang);
  // Same single-source head signals as /projects and /faq: staticAlternates
  // adds the x-default alternate and ogLocale the og:locale meta — both were
  // missing here in every locale (hreflang sampler against staging,
  // 2026-09-20).
  const { canonical, languages } = staticAlternates(params.lang, "developers");
  return {
    // `title` doubles as the H1 (withAccent gold-accents its last word), so the
    // brand can only ride along in a separate meta-only title. Today just `he`
    // has one; every other locale keeps the H1 string as its <title>.
    title: t.metaTitle ?? t.title,
    description: t.metaDescription,
    alternates: { canonical, languages },
    openGraph: {
      title: t.metaTitle ?? t.title,
      description: t.metaDescription,
      url: canonical,
      siteName: "Cyprus VIP Estates",
      locale: ogLocale(params.lang),
      type: "website",
    },
  };
}

/* The country name in the animated gold .it treatment, the same accent the
   homepage hero and the section titles use. It is the last word of the title
   in every locale — "Developers in Cyprus", "Bauträger auf Zypern",
   "Застройщики на Кипре", "Deweloperzy na Cyprze", "יזמי נדל"ן בקפריסין" — so
   the split takes the final word rather than matching "Cyprus", which would
   only ever hit English. */
const withAccent = (title: string) => {
  const i = title.lastIndexOf(" ");
  if (i < 0) return <span className="it">{title}</span>;
  return (
    <>
      {title.slice(0, i + 1)}
      <span className="it">{title.slice(i + 1)}</span>
    </>
  );
};

/** First letters of the first two words — stands in for a missing logo. */
const initials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export default async function DevelopersIndex({ params }: { params: { lang: string } }) {
  const { lang } = params;
  const [developers, counts, home] = await Promise.all([
    getAllDevelopersByLang(lang) as Promise<any[]>,
    getDeveloperProjectCounts(lang),
    // Same band the homepage closes with: same video under /uploads, same CMS
    // image as its poster. getHomePageByLang is wrapped in React cache().
    getHomePageByLang(lang).catch(() => null as any),
  ]);
  const translations = i18n.languages.map((l) => ({ language: l.id, path: localizedHref(l.id, "developers") }));
  const t = developersPageCopy(lang);

  return (
    <>
      <HeaderWrapper>
        <Header params={params} translations={translations} />
      </HeaderWrapper>

      {/* dev-atmos-root + DevAtmosphere are the detail page's own page-wide
          cloud layer: one absolutely-positioned layer sized to the rendered
          height, rather than per-section pseudo-elements that get clipped by
          whichever container's overflow is nearest. Reused here so the two
          pages share one atmosphere instead of two similar ones. */}
      <main className="dev-atmos-root">
        <DevAtmosphere />

        <div className="wrap devx__hero">
          <h1 className="devx__title">{withAccent(t.title)}</h1>
          <hr className="shimmer devx__stripe" />
          <p className="devx__lead">{t.sub}</p>
          <div className="devx__intro">
            {t.intro.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>

        <ul className="wrap devx__grid">
          {developers.map((d) => {
            const slug = d.slugStr as string | undefined;
            if (!slug) return null;
            const logo = d.logo ? urlFor(d.logo).width(340).url() : null;
            const n = counts[slug];
            return (
              <li key={d._id}>
                <Link className="devx__card" href={localizedHref(lang, ["developers", slug])}>
                  <span className="devx__plate">
                    {logo ? (
                      <img className="devx__logo" src={logo} alt={d.title} loading="lazy" />
                    ) : (
                      <span className="devx__initials" aria-hidden>{initials(d.title)}</span>
                    )}
                  </span>
                  <span className="devx__body">
                    <span className="devx__name">{d.title}</span>
                    {d.excerpt && <span className="devx__excerpt">{d.excerpt}</span>}
                    {/* "1 פרויקטים" is ungrammatical: Hebrew takes the singular
                        noun with the numeral as a word after it, so the count is
                        one phrase there and loses the <b>. LTR unchanged. */}
                    {typeof n === "number" && (
                      <span className="devx__count">
                        {lang === "he" && n === 1 ? "פרויקט אחד" : <><b>{n}</b> {t.projects}</>}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <ParallaxBand image={home?.parallaxImage} videoSrc="/uploads/sunset.mp4" />
      </main>

      <Footer params={params} />
    </>
  );
}
