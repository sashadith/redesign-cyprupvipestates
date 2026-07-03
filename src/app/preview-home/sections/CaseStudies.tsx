import React from "react";
import type { FeaturedCaseStudiesBlock } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";
import { localePrefix } from "@/lib/locale";
import { homeStrings, CASE_CATEGORY_LABELS } from "./homeI18n";

/* Featured Case Studies — dark editorial section: image-top cards with a
   category badge, title + excerpt, linking to each case study. Reuses the
   original data + slug/category logic. */

const PLACEHOLDER = "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const renderTitle = (title: string) =>
  title.split(/(Success|Cyprus)/i).map((part, i) =>
    /^(success|cyprus)$/i.test(part) ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 17 17" fill="none" aria-hidden>
    <path d="M3 8.5h10M9 4.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CaseStudies({ block, lang = "en" }: { block: FeaturedCaseStudiesBlock; lang?: string }) {
  if (!block?.caseStudies?.length) return null;
  const { title, description, button, caseStudies } = block;
  const t = homeStrings(lang);
  const labels = CASE_CATEGORY_LABELS[lang] || CASE_CATEGORY_LABELS.en;
  const px = localePrefix(lang);

  return (
    <section className="section casestudies">
      <div className="wrap">
        {title && <h2 className="casestudies__title">{renderTitle(title)}</h2>}
        <hr className="shimmer casestudies__stripe" />
        {description && <p className="casestudies__desc">{description}</p>}

        <div className="casestudies__grid">
          {caseStudies.map((cs) => {
            const img = safeUrl(cs.previewImage) || PLACEHOLDER;
            const current = cs.slug?.[lang]?.current ?? Object.values(cs.slug ?? {})[0]?.current ?? "";
            const cat = labels[cs.category];
            return (
              <a key={cs._id} className="cscard" href={`${px}/case-studies/${current}`}>
                <div className="cscard__media">
                  <img src={img} alt={cs.title} />
                  {cat && <span className="cscard__cat">{cat}</span>}
                </div>
                <div className="cscard__body">
                  <h3 className="cscard__title">{cs.title}</h3>
                  {cs.excerpt && <p className="cscard__excerpt">{cs.excerpt}</p>}
                  <span className="cscard__more">
                    {t.readCaseStudy}
                    <ArrowRight />
                  </span>
                </div>
              </a>
            );
          })}
        </div>

        {button?.label && button?.url && (
          <div className="casestudies__cta">
            <a className="btn btn--glass" href={button.url}>{button.label || t.exploreAllCases}</a>
          </div>
        )}
      </div>
    </section>
  );
}
