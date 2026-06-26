import React from "react";
import { getLastFiveProjectsByLang } from "@/sanity/sanity.utils";
import { urlFor } from "@/sanity/sanity.client";
import type { Project } from "@/types/project";

/* New Listings — light "gallery" section: a deep-green title tile sits in the
   grid alongside the latest 5 project cards (clean 3×2 on desktop). Reuses the
   original data source (getLastFiveProjectsByLang) + routing. */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const renderTitle = (title: string) =>
  title.split(/(Listings)/i).map((part, i) =>
    part.toLowerCase() === "listings" ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const ArrowDiag = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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
        <div className="newlist__grid">
          <div className="newlist__intro" data-theme="dark">
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
              <a key={p._id} className="plcard" href={slug ? `/projects/${slug}` : "#"}>
                <div className="plcard__media">
                  {img && <img src={img} alt={p.previewImage?.alt || p.title} />}
                </div>
                <div className="plcard__shade" />
                <span className="plcard__arrow"><ArrowDiag /></span>
                <div className="plcard__body">
                  <p className="plcard__name">{p.title}</p>
                  <p className="plcard__price">
                    {price != null ? `Price from ${price.toLocaleString()} €` : "Price on request"}
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
