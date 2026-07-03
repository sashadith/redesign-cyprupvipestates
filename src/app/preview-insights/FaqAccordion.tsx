"use client";

import React, { useId, useState, type ReactNode } from "react";

/* Accordion FAQ for articles. Single-open: opening one item closes the others.
   Open/close is animated via grid-template-rows (0fr↔1fr) + opacity in CSS — no
   display toggling — so both directions are smooth. Answers are pre-rendered on
   the server and passed in, so this stays purely an interaction layer (visuals
   are unchanged; same .iart__faq* classes). */

export type FaqItem = { key: string; question: string; answer: ReactNode };

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const uid = useId();

  if (!items?.length) return null;

  return (
    <div className="iart__faq">
      {items.map((it, i) => {
        const isOpen = openKey === it.key;
        const panelId = `${uid}-faq-${i}`;
        const btnId = `${panelId}-q`;
        return (
          <div className={`iart__faq-item${isOpen ? " is-open" : ""}`} key={it.key}>
            <button
              type="button"
              id={btnId}
              className="iart__faq-q"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenKey(isOpen ? null : it.key)}
            >
              {it.question}
            </button>
            <div className="iart__faq-a-wrap" id={panelId} role="region" aria-labelledby={btnId}>
              <div className="iart__faq-a">{it.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
