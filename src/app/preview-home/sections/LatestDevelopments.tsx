import React from "react";
import { getLatestDevelopmentsByLang, getSinglePageByLang } from "@/sanity/sanity.utils";
import { localePrefix } from "@/lib/locale";
import { pathBuilders } from "@/lib/seo";
import { homeStrings } from "./homeI18n";

// Top 100 is a CMS Singlepage with a fully-translated slug per locale (unlike
// Development/project slugs, which are locale-invariant) — resolve it from the
// EN row's _translations rather than hardcoding four slugs that would drift
// silently if the CMS copy ever changes.
const TOP_100_EN_SLUG = "top-100-properties-in-cyprus";
async function top100Href(lang: string): Promise<string | null> {
  const page = await getSinglePageByLang("en", TOP_100_EN_SLUG);
  if (!page) return null;
  if (lang === "en") return pathBuilders.topLevel("en", TOP_100_EN_SLUG);
  const sibling = (page as any)._translations?.find((t: any) => t.slug?.[lang])?.slug?.[lang]?.current;
  return sibling ? pathBuilders.topLevel(lang, sibling) : null;
}

/* Latest Developments — light "gallery" section: a deep-green title tile sits
   in the grid alongside the most recently published Developments (reusing the
   Featured .pcard look). Sourced from the Development system (getLatestDevelopmentsByLang),
   excluding sold-out and capped at 5 — replaces the old static-Project "New
   Listings" block, which never surfaced new-system projects or sold-out state. */

const fmtPrice = (p?: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p || 0);

const ArrowRight = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
    <path d="M3 8.5h10M9 4.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function LatestDevelopments({ lang = "en" }: { lang?: string }) {
  const [developments, top100] = await Promise.all([getLatestDevelopmentsByLang(5), top100Href(lang)]);
  const t = homeStrings(lang);
  const px = localePrefix(lang);

  return (
    <section className="section is-light newlist">
      <div className="wrap">
        <div className="newlist__grid" data-theme="dark">
          <div className="newlist__intro">
            <div className="newlist__head">
              <h2 className="newlist__title">{t.newLead2}<span className="it">{t.newAccent}</span></h2>
              <p className="newlist__lead">{t.newLead}</p>
              {top100 && (
                <a className="newlist__subcta" href={top100}>
                  {t.top100Cta}
                  <ArrowRight />
                </a>
              )}
            </div>
            <a className="btn btn--ghost newlist__cta" href={`${px}/projects`}>
              {t.showAllProjects}
              <ArrowRight />
            </a>
          </div>

          {developments?.map((d) => {
            const price = d.keyFeatures?.price;
            return (
              <a key={d._id} className="pcard" href={`${px}/projects/${d.slug}`}>
                <div className="pcard__media">
                  {d.previewImage && <img src={d.previewImage} alt={d.title} />}
                  {d.isSold && <span className="pcard__sold">{t.sold}</span>}
                  <div className="pcard__shade" />
                </div>
                <div className="pcard__body">
                  <h3 className="pcard__title">{d.title}</h3>
                  <p className="pcard__price">
                    {price && price > 0 ? (
                      <>
                        <span className="pcard__from">{t.priceFrom}</span>
                        {fmtPrice(price)}
                      </>
                    ) : (
                      t.onRequest
                    )}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
