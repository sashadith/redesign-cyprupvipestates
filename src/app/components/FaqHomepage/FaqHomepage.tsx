"use client";

import React from "react";
import AccordionContainer from "../AccordionContainer/AccordionContainer";
import { FaqSection } from "@/types/homepage";
import styles from "./FaqHomepage.module.scss";

type Props = {
  faqSection?: FaqSection;
};

const FaqHomepage = ({ faqSection }: Props) => {
  if (!faqSection?.faq?.faq?.items?.length) return null;

  return (
    <section className={styles.faqHomepage}>
      <div className="container">
        {faqSection.faqTitle && (
          <h2 className="h2-white">{faqSection.faqTitle}</h2>
        )}
      </div>
      <div className={styles.accordionWrapper}>
        <div className="container-short">
          <AccordionContainer block={faqSection.faq.faq} />
        </div>
      </div>
    </section>
  );
};

export default FaqHomepage;
