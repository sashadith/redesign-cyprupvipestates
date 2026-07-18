import React from "react";
import { getLatestDevelopmentsByLang } from "@/sanity/sanity.utils";
import { localePrefix } from "@/lib/locale";
import { homeStrings } from "./homeI18n";

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
  const developments = await getLatestDevelopmentsByLang(5);
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
