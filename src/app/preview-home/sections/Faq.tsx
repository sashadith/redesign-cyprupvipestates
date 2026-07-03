"use client";

import React, { useState } from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "@/app/components/RichText/RichText";
import type { FaqSection } from "@/types/homepage";
import { homeStrings } from "./homeI18n";

/* FAQ — dark section, editorial split: heading/context on the left (sticky),
   an accordion of question/answer items on the right. Reuses the original
   data; adds FAQPage JSON-LD for rich-result SEO. */

const renderTitle = (title: string) =>
  title.split(/(Questions|Cyprus)/i).map((part, i) =>
    /^(questions|cyprus)$/i.test(part) ? (
      <span key={i} className="it">{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// flatten PortableText to plain text for the JSON-LD answer
const toPlainText = (blocks: any): string =>
  Array.isArray(blocks)
    ? blocks
        .map((b) => (b?.children || []).map((c: any) => c?.text || "").join(""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

export default function Faq({ section, lang = "en" }: { section: FaqSection; lang?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const t = homeStrings(lang);
  const items = section?.faq?.faq?.items;
  if (!items?.length) return null;
  const { faqTitle } = section;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: toPlainText(it.answer) },
    })),
  };

  return (
    <section className="section faq">
      <script
        type="application/ld+json"
        // escape "<" so a "</script>" inside any answer can't break out of the tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="wrap">
        <div className="faq__grid">
          <div className="faq__head">
            {faqTitle && <h2 className="faq__title">{renderTitle(faqTitle)}</h2>}
            <hr className="shimmer faq__stripe" />
            <p className="faq__lead">{t.faqLead}</p>
          </div>

          <ul className="faq__list">
            {items.map((item, i) => {
              const isOpen = open === i;
              const id = `faq-${item._key}`;
              return (
                <li className="faq__item" key={item._key}>
                  <button
                    className="faq__q"
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="faq__q-text">{item.question}</span>
                    <span className={`faq__icon ${isOpen ? "is-open" : ""}`}><Chevron /></span>
                  </button>
                  <div id={id} className={`faq__a ${isOpen ? "is-open" : ""}`} role="region">
                    <div className="faq__a-inner">
                      <div className="faq__a-body">
                        <PortableText value={item.answer} components={RichText} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
