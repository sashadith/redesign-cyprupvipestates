import type { Metadata } from "next";
import Nav from "../preview-home/sections/Nav";
import Footer from "../preview-home/sections/Footer";
import Form from "../preview-home/sections/Form";
import LightHeroFlag from "../preview-insights/LightHeroFlag";
import FaqExplorer from "./FaqExplorer";
import FaqMotion from "./FaqMotion";
import { FAQ_CATEGORIES, FAQ_TOTAL } from "./faqData";

/* Cyprus VIP Estates — FAQ, redesigned. Isolated preview (see layout.tsx);
   the live /faq Sanity singlepage is untouched. Content is the SAME 60
   question/answer pairs live on /faq today (verbatim — see faqData.ts for
   provenance), reorganised into 9 browsable categories with search. */

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to the questions we hear most from international buyers — foreigner eligibility, costs & VAT, residency, financing, and buying off-plan in Cyprus.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_CATEGORIES.flatMap((cat) =>
      cat.items.map((it) => ({
        "@type": "Question",
        name: it.question,
        acceptedAnswer: { "@type": "Answer", text: it.answer.join(" ") },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <LightHeroFlag />
      <FaqMotion />
      <Nav />
      <main className="faqp">
        <header className="faqp__hero is-light">
          <div className="wrap faqp__hero-grid">
            <div className="faqp__hero-text">
              <p className="faqp__eyebrow">Support</p>
              <h1 className="faqp__hero-title">
                Frequently <span className="faqp__hero-title-lock">Asked <span className="it">Questions</span></span>
              </h1>
              <p className="faqp__hero-lead">
                Straight answers to what international buyers ask us most — before, during and after
                purchasing property in Cyprus.
              </p>
              <p className="faqp__hero-meta">{FAQ_TOTAL} questions across {FAQ_CATEGORIES.length} topics</p>
            </div>

            <div className="faqp__hero-art" aria-hidden>
              <img className="faqp__hero-mark" src="/preview-assets/faq-hero-2.webp" alt="" width={1100} height={733} />
            </div>
          </div>
        </header>

        <FaqExplorer categories={FAQ_CATEGORIES} />

        <Form
          lang="en"
          title={<>Still <span className="it">have a question</span>?</>}
          subtitle="Every buyer’s situation is a little different. Send us yours and we’ll answer it directly."
          showQuestionField
        />
      </main>
      <Footer lang="en" />
    </>
  );
}
