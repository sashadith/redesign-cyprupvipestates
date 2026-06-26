import React from "react";
import { getLastFiveProjectsByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import type { Project } from "@/types/project";

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
  p && p > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p)
    : "On request";

const renderTitle = (title: string) =>
  title.split(/(Listings)/i).map((part, i) =>
    part.toLowerCase() === "listings" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const ArrowRight = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
    <path d="M3 8.5h10M9 4.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function NewListings({ lang = "en" }: { lang?: string }) {
  const projects: Project[] = await getLastFiveProjectsByLang(lang);

  return (
    <section className="section is-light newlist">
      <div className="wrap">
        <div className="newlist__grid" data-theme="dark">
          <div className="newlist__intro">
            <h2 className="newlist__title">{renderTitle("New Listings")}</h2>
            <a className="btn btn--ghost newlist__cta" href="/projects">
              Show all projects
              <ArrowRight />
            </a>
          </div>

          {projects?.map((p) => {
            const img = safeUrl(p.previewImage);
            const slug = (p.slug as Record<string, { current: string }> | undefined)?.[lang]?.current;
            const price = p.keyFeatures?.price;
            return (
              <a key={p._id} className="pcard" href={slug ? `/projects/${slug}` : "#"}>
                <div className="pcard__media">
                  {img && <img src={img} alt={p.previewImage?.alt || p.title} />}
                  <div className="pcard__shade" />
                </div>
                <div className="pcard__body">
                  <h3 className="pcard__title">{p.title}</h3>
                  <p className="pcard__price">
                    {price && price > 0 ? (
                      <>
                        <span className="pcard__from">from</span>
                        {fmtPrice(price)}
                      </>
                    ) : (
                      "On request"
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
