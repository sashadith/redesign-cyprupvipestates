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

// `sub` stays the short hero tagline; `metaDescription` and `intro` were added
// 2026-09-11 — this page previously had zero body copy (hero + card grid
// only) and reused `sub`'s single sentence as its metaDescription too. RU's
// GSC data specifically showed real, un-served demand for generic "developers
// in Limassol/Cyprus" queries (not brand-name searches) landing here and on
// individual /developers/[slug] pages, at weak positions — this index page
// had nothing on it to support that intent. `intro` is genuinely informative
// (what "vetted" means, direct-partner/no-markup positioning already
// established on the About page), not filler, and written for all four
// locales together since this component is shared across them.
const copy = (lang: string) =>
  lang === "de"
    ? {
        title: "Bauträger auf Zypern",
        sub: "Wir arbeiten mit den besten Bauträgern Zyperns zusammen.",
        metaDescription: "Alle Bauträger, mit denen Cyprus VIP Estates direkt zusammenarbeitet — von internationalen Entwicklern bis zu Boutique-Studios in Limassol und Paphos. Aktuelle Projekte, Preise und Kaufbedingungen je Bauträger.",
        intro: [
          "Wir arbeiten direkt mit den führenden Bauträgern Zyperns zusammen — von großen internationalen Entwicklern bis zu spezialisierten Studios für Premium-Wohnimmobilien in Limassol und Paphos. Jeder hier gelistete Bauträger wurde geprüft: einwandfreier rechtlicher Titel der Projekte, nachweisliche Erfahrung bei der Fertigstellung und ein aktuelles Portfolio.",
          "Unten finden Sie die vollständige Liste der Bauträger, mit denen wir direkt zusammenarbeiten — ohne Aufschlag für den Käufer. Jeder hat eine eigene Seite mit aktuellen Projekten, Preisen und Kaufbedingungen.",
        ],
        projects: "Projekte",
      }
    : lang === "ru"
      ? {
          title: "Застройщики на Кипре",
          sub: "Мы работаем с лучшими застройщиками Кипра.",
          metaDescription: "Все застройщики, с которыми Cyprus VIP Estates работает напрямую — от крупных международных девелоперов до бутик-студий в Лимассоле и Пафосе. Актуальные проекты, цены и условия покупки по каждому застройщику.",
          intro: [
            "Мы напрямую сотрудничаем с ведущими застройщиками Кипра — от крупных международных девелоперов до локальных студий премиального жилья в Лимассоле и Пафосе. Каждый застройщик в этом каталоге проверен: юридическая чистота проектов, реальный опыт сдачи объектов и актуальный портфель.",
            "Ниже — полный список застройщиков, с которыми мы работаем напрямую, без наценки для покупателя. У каждого — отдельная страница с текущими проектами, ценами и условиями покупки.",
          ],
          projects: "проектов",
        }
      : lang === "pl"
        ? {
            title: "Deweloperzy na Cyprze",
            sub: "Współpracujemy z najlepszymi deweloperami na Cyprze.",
            metaDescription: "Wszyscy deweloperzy, z którymi Cyprus VIP Estates współpracuje bezpośrednio — od dużych międzynarodowych firm po butikowe studia w Limassol i Pafos. Aktualne projekty, ceny i warunki zakupu przy każdym deweloperze.",
            intro: [
              "Współpracujemy bezpośrednio z czołowymi deweloperami na Cyprze — od dużych międzynarodowych firm po butikowe studia specjalizujące się w nieruchomościach premium w Limassol i Pafos. Każdy deweloper na tej liście został zweryfikowany: czysty tytuł prawny projektów, realne doświadczenie w oddawaniu inwestycji i aktualne portfolio.",
              "Poniżej pełna lista deweloperów, z którymi współpracujemy bezpośrednio, bez marży dla kupującego. Każdy ma własną stronę z aktualnymi projektami, cenami i warunkami zakupu.",
            ],
            projects: "projektów",
          }
        : {
            title: "Developers in Cyprus",
            sub: "We work with the best property developers in Cyprus.",
            metaDescription: "Every developer Cyprus VIP Estates partners with directly — from major international builders to boutique studios in Limassol and Paphos. Current projects, prices, and buying terms for each developer.",
            intro: [
              "We work directly with Cyprus's leading property developers — from major international builders to boutique studios specializing in premium homes in Limassol and Paphos. Every developer listed here has been vetted: clean legal title on their projects, a real delivery track record, and an active current portfolio.",
              "Below is the full list of developers we partner with directly, at no markup to the buyer. Each has its own page with current projects, prices, and buying terms.",
            ],
            projects: "projects",
          };

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const t = copy(params.lang);
  const languages: Record<string, string> = {};
  for (const l of i18n.languages) languages[l.id] = abs(localizedHref(l.id, "developers"));
  return {
    title: t.title,
    description: t.metaDescription,
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
