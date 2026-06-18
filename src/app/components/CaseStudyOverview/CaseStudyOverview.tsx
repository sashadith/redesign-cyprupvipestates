import React, { FC } from "react";
import styles from "./CaseStudyOverview.module.scss";
import { ClientOverview } from "@/types/caseStudy";
import { ButtonModal } from "../ButtonModal/ButtonModal";

type Props = {
  lang: string;
  clientOverview: ClientOverview;
};

const labels = {
  en: {
    propertyType: "Property Type",
    location: "Location",
    budget: "Budget",
    purchaseTimeline: "Purchase Timeline",
  },
  de: {
    propertyType: "Immobilientyp",
    location: "Standort",
    budget: "Budget",
    purchaseTimeline: "Kaufdauer",
  },
  pl: {
    propertyType: "Typ nieruchomości",
    location: "Lokalizacja",
    budget: "Budget",
    purchaseTimeline: "Czas zakupu",
  },
  ru: {
    propertyType: "Тип недвижимости",
    location: "Локация",
    budget: "Бюджет",
    purchaseTimeline: "Срок сделки",
  },
};

const propertyTypeLabels = {
  en: {
    villa: "Villa",
    apartment: "Apartment",
    penthouse: "Penthouse",
    townhouse: "Townhouse",
    plot: "Plot",
  },
  de: {
    villa: "Villa",
    apartment: "Apartment",
    penthouse: "Penthouse",
    townhouse: "Townhouse",
    plot: "Grundstück",
  },
  pl: {
    villa: "Willa",
    apartment: "Apartament",
    penthouse: "Penthouse",
    townhouse: "Townhouse",
    plot: "Działka",
  },
  ru: {
    villa: "Вилла",
    apartment: "Апартаменты",
    penthouse: "Пентхаус",
    townhouse: "Таунхаус",
    plot: "Участок",
  },
};

const CaseStudyOverview: FC<Props> = ({ lang, clientOverview }) => {
  const currentLabels = labels[lang as keyof typeof labels] || labels.en;

  const currentPropertyTypes =
    propertyTypeLabels[lang as keyof typeof propertyTypeLabels] ||
    propertyTypeLabels.en;

  const items = [
    {
      key: "propertyType",
      label: currentLabels.propertyType,
      value:
        currentPropertyTypes[
          clientOverview.propertyType as keyof typeof currentPropertyTypes
        ] || clientOverview.propertyType,
    },
    {
      key: "location",
      label: currentLabels.location,
      value: clientOverview.location,
    },
    {
      key: "budget",
      label: currentLabels.budget,
      value: clientOverview.budget,
    },
    {
      key: "purchaseTimeline",
      label: currentLabels.purchaseTimeline,
      value: clientOverview.purchaseTimeline,
    },
  ];

  const ctaTitles = {
    en: "Interested in Cyprus property?",
    de: "Interesse an Immobilien auf Zypern?",
    pl: "Interesuje Cię nieruchomość na Cyprze?",
    ru: "Интересует недвижимость на Кипре?",
  };

  const ctaLabels = {
    en: "Book a Call",
    de: "Termin buchen",
    pl: "Umów rozmowę",
    ru: "Записаться",
  };

  return (
    <section className={styles.caseStudyOverview}>
      <div className="container">
        <div className={styles.overviewList}>
          {items.map((item) => (
            <div className={styles.overviewItem} key={item.key}>
              <span className={styles.overviewLabel}>{item.label}</span>
              <strong className={styles.overviewValue}>{item.value}</strong>
            </div>
          ))}

          <div className={`${styles.overviewItem} ${styles.ctaItem}`}>
            {/* <span className={styles.overviewLabel}>
              {ctaTitles[lang as keyof typeof ctaTitles] || ctaTitles.en}
            </span> */}

            <ButtonModal className={styles.ctaButton}>
              {ctaLabels[lang as keyof typeof ctaLabels] || ctaLabels.en}
            </ButtonModal>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CaseStudyOverview;
