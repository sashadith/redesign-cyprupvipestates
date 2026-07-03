import React from "react";
import { getLastFiveProjectsByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import type { Project } from "@/types/project";
import { localePrefix } from "@/lib/locale";
import { homeStrings } from "./homeI18n";

/* New Listings — light "gallery" section: a deep-green title tile sits in the
   grid alongside the latest 5 project cards (reusing the Featured .pcard look).
   Reuses the original data source (getLastFiveProjectsByLang) + routing. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const fmtPrice = (p?: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p || 0);

const ArrowRight = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
    <path d="M3 8.5h10M9 4.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function NewListings({ lang = "en" }: { lang?: string }) {
  const projects: Project[] = await getLastFiveProjectsByLang(lang);
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

          {projects?.map((p) => {
            const img = safeUrl(p.previewImage);
            const slug = (p.slug as Record<string, { current: string }> | undefined)?.[lang]?.current;
            const price = p.keyFeatures?.price;
            return (
              <a key={p._id} className="pcard" href={slug ? `${px}/projects/${slug}` : "#"}>
                <div className="pcard__media">
                  {img && <img src={img} alt={p.previewImage?.alt || p.title} />}
                  <div className="pcard__shade" />
                </div>
                <div className="pcard__body">
                  <h3 className="pcard__title">{p.title}</h3>
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
