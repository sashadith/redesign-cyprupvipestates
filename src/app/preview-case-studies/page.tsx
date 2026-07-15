import type { Metadata } from "next";
import { LuEuro, LuMapPin, LuHouse, LuClock } from "react-icons/lu";
import Nav from "../preview-home/sections/Nav";
import Footer from "../preview-home/sections/Footer";
import Form from "../preview-home/sections/Form";
import LightHeroFlag from "../preview-insights/LightHeroFlag";
import CaseStudiesMotion from "./CaseStudiesMotion";
import CaseStudiesSeo from "./CaseStudiesSeo";
import { urlFor } from "@/sanity/sanity.client";
import {
  getCaseStudiesByLangWithDetails,
  getTotalCaseStudiesByLang,
  getCaseStudiesPageByLang,
} from "@/sanity/sanity.utils";
import { CASE_CATEGORY_LABELS } from "../preview-home/sections/homeI18n";
import type { CaseStudy } from "@/types/caseStudy";

/* Cyprus VIP Estates — Case Studies, redesigned. Isolated preview (see
   layout.tsx); the live /case-studies Sanity-backed page is untouched.
   Header + hero deliberately reuse Insights' OWN .ins__hero/.ins__device
   markup and CSS verbatim (see layout.tsx import), not a re-approximation —
   this was an explicit requirement.

   Design departs from a filterable grid (right for Insights' 100+ posts or
   the FAQ's 60 questions) because there are only 3 published case studies
   today — a filter/search UI would be mostly empty chrome. Instead each case
   study is a full-width "magazine feature" block, alternating image side,
   surfacing the client-overview facts (budget/location/property/timeline)
   directly on the index. */

const LANG = "en";
const PLACEHOLDER = "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "Real Cyprus property purchases — relocation, investment and lifestyle buyers, and how we helped them find the right home.",
};

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function CaseStudiesPage() {
  const total = await getTotalCaseStudiesByLang(LANG);
  const stories = await getCaseStudiesByLangWithDetails(LANG);
  const pageDoc = await getCaseStudiesPageByLang(LANG);
  const labels = CASE_CATEGORY_LABELS.en;

  const featured = stories[0];
  const featuredImg = featured ? safeUrl(featured.previewImage) || PLACEHOLDER : PLACEHOLDER;

  return (
    <>
      <LightHeroFlag />
      <CaseStudiesMotion />
      <Nav />
      <main className="ins csp">
        <header className="ins__hero is-light">
          <div className="wrap ins__hero-grid">
            <div className="ins__hero-text">
              <p className="ins__eyebrow">Success Stories</p>
              <h1 className="ins__hero-title">
                Case <span className="it">Studies</span>
              </h1>
              <p className="ins__hero-lead">
                Real Cyprus property purchases, from first consultation to keys in hand — how relocation,
                investment and lifestyle buyers found the right home with us.
              </p>
              <p className="ins__hero-meta">{total} client {total === 1 ? "success story" : "success stories"}</p>
            </div>

            <div className="ins__hero-art" aria-hidden>
              <div className="ins__device">
                <div className="ins__device-screen">
                  <div className="ins__device-topbar">
                    <span className="ins__device-brand">Cyprus VIP Estates</span>
                    <span className="ins__device-dots"><i /><i /><i /></span>
                  </div>
                  <div className="ins__device-cover" style={{ backgroundImage: `url("${featuredImg}")` }} />
                  <div className="ins__device-content">
                    <span className="ins__device-kicker">{featured ? labels[featured.category] : "Case Study"}</span>
                    <p className="ins__device-headline">{featured?.title ?? "A Cyprus property success story"}</p>
                    <span className="ins__device-line" />
                    <span className="ins__device-line" />
                    <span className="ins__device-line ins__device-line--short" />
                    <span className="ins__device-read">Read the story</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="csp__list">
          <div className="wrap csp__stories">
            {stories.map((cs, i) => {
              const img = safeUrl(cs.previewImage) || PLACEHOLDER;
              const current = cs.slug?.[LANG]?.current ?? Object.values(cs.slug ?? {})[0]?.current ?? "";
              const overview = cs.clientOverview;
              return (
                <article className={`csstory${i % 2 === 1 ? " csstory--reverse" : ""}`} key={cs._id}>
                  <div className="csstory__media">
                    <img src={img} alt={cs.previewImage?.alt || cs.title} />
                    <span className="cscard__cat">{labels[cs.category]}</span>
                  </div>
                  <div className="csstory__body">
                    <h2 className="csstory__title">{cs.fullTitle || cs.title}</h2>

                    {overview && (
                      <dl className="csstory__stats">
                        <div className="csstory__stat">
                          <LuEuro size={16} />
                          <div><dt>Budget</dt><dd>{overview.budget}</dd></div>
                        </div>
                        <div className="csstory__stat">
                          <LuMapPin size={16} />
                          <div><dt>Location</dt><dd>{overview.location}</dd></div>
                        </div>
                        <div className="csstory__stat">
                          <LuHouse size={16} />
                          <div><dt>Property</dt><dd className="csstory__cap">{overview.propertyType}</dd></div>
                        </div>
                        <div className="csstory__stat">
                          <LuClock size={16} />
                          <div><dt>Timeline</dt><dd>{overview.purchaseTimeline}</dd></div>
                        </div>
                      </dl>
                    )}

                    <a className="btn btn--primary csstory__cta" href={`/preview-case-studies/${current}`}>
                      <span>Read the full story</span>
                      <Arrow />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {pageDoc?.content && (
          <CaseStudiesSeo content={pageDoc.content} eyebrow="The Guide" title="Understanding Case Studies" />
        )}
      </main>

      <Form
        lang="en"
        title={<>Considering <span className="it">your own</span> move?</>}
        subtitle="Leave your details and our team will get in touch to understand your needs, answer your questions, and help you find the right way forward."
      />
      <Footer lang="en" />
    </>
  );
}
