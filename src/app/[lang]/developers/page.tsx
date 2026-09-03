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
import { abs } from "@/lib/seo";
import { urlFor } from "@/sanity/sanity.client";
import { getAllDevelopersByLang, getDeveloperProjectCounts } from "@/sanity/sanity.utils";
import DevAtmosphere from "@/app/[lang]/developers/[slug]/DevAtmosphere";
import ParallaxBand from "@/app/preview-home/sections/ParallaxBand";
import { getHomePageByLang } from "@/sanity/sanity.utils";

export const revalidate = 3600;

const copy = (lang: string) =>
  lang === "de"
    ? { title: "Bauträger auf Zypern", sub: "Wir arbeiten mit den besten Bauträgern Zyperns zusammen.", projects: "Projekte" }
    : lang === "ru"
      ? { title: "Застройщики на Кипре", sub: "Мы работаем с лучшими застройщиками Кипра.", projects: "проектов" }
      : lang === "pl"
        ? { title: "Deweloperzy na Cyprze", sub: "Współpracujemy z najlepszymi deweloperami na Cyprze.", projects: "projektów" }
        : { title: "Developers in Cyprus", sub: "We work with the best property developers in Cyprus.", projects: "projects" };

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const t = copy(params.lang);
  const languages: Record<string, string> = {};
  for (const l of i18n.languages) languages[l.id] = abs(localizedHref(l.id, "developers"));
  return {
    title: t.title,
    description: t.sub,
    alternates: { canonical: abs(localizedHref(params.lang, "developers")), languages },
  };
}

/* The country name in the animated gold .it treatment, the same accent the
   homepage hero and the section titles use. It is the last word of the title
   in every locale — "Developers in Cyprus", "Bauträger auf Zypern",
   "Застройщики на Кипре", "Deweloperzy na Cyprze" — so the split takes the
   final word rather than matching "Cyprus", which would only ever hit English. */
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
  const t = copy(lang);

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
                    {typeof n === "number" && (
                      <span className="devx__count"><b>{n}</b> {t.projects}</span>
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
