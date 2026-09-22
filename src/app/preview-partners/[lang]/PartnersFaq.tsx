"use client";

import { useState } from "react";
import type { PartnersFaqItem } from "./copy";

/* FAQ accordion for the Partners page. Reuses the SAME open/close interaction
   and `.faq__*` classes as Home's own Faq.tsx (defined in
   preview-home/tokens.css, already imported by this route's layout.tsx) for
   visual/behavioural consistency — but is otherwise self-contained: this
   page's copy.ts holds plain-string Q&A (not Sanity PortableText), so there's
   no PortableText rendering or Sanity-shaped props here. The heading uses
   THIS page's own `.pnr__section-head` pattern (eyebrow/title/stripe), same
   as every other section on this page, rather than Home Faq's two-column
   `.faq__grid` layout, which would look inconsistent here.

   Also emits its own FAQPage JSON-LD, scoped to just these Q&A pairs —
   added after DataForSEO LLM Responses testing (2026-09-22) showed ChatGPT
   citing this page's plain-text commission figures verbatim when answering
   real "how do I become a referral partner" queries; an explicit Q&A block
   plus structured data makes the same facts easier to find and extract. */
export default function PartnersFaq({
  eyebrow,
  titleStart,
  titleAccent,
  items,
}: {
  eyebrow: string;
  titleStart: string;
  titleAccent: string;
  items: PartnersFaqItem[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items?.length) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };

  return (
    <section className="section is-light pnr__faq-section">
      {/* escape "<" so a "</script>" inside any answer can't break out of the tag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="wrap">
        <div className="pnr__section-head">
          <p className="pnr__eyebrow">{eyebrow}</p>
          <h2 className="pnr__title">
            {titleStart}
            <span className="it">{titleAccent}</span>
          </h2>
          <hr className="shimmer pnr__stripe" />
        </div>
        <ul className="faq__list">
          {items.map((item, i) => {
            const isOpen = open === i;
            const id = `partners-faq-${i}`;
            return (
              <li className="faq__item" key={item.question}>
                <button
                  className="faq__q"
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="faq__q-text">{item.question}</span>
                  <span className={`faq__icon ${isOpen ? "is-open" : ""}`}>
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
                      <path
                        d="M2.5 4.5L6 8l3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                <div id={id} className={`faq__a ${isOpen ? "is-open" : ""}`} role="region">
                  <div className="faq__a-inner">
                    <div className="faq__a-body">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
