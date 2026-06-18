import React, { FC } from "react";
import styles from "./CaseStudiesAll.module.scss";
import { CaseStudy } from "@/types/caseStudy";
import CaseStudyCard from "../CaseStudyCard/CaseStudyCard";

type Props = {
  title: string;
  caseStudies: CaseStudy[];
  lang: string;
};

const categoryLabels = {
  en: {
    "luxury-villa": "Luxury Villa Purchase",
    apartment: "Apartment Purchase",
    investment: "Investment Property",
    relocation: "Relocation to Cyprus",
    "permanent-residency": "Permanent Residency",
    "new-development": "New Development",
  },
  de: {
    "luxury-villa": "Kauf einer Luxusvilla",
    apartment: "Wohnungskauf",
    investment: "Investmentimmobilie",
    relocation: "Umzug nach Zypern",
    "permanent-residency": "Daueraufenthalt",
    "new-development": "Neubauimmobilie",
  },
  pl: {
    "luxury-villa": "Zakup luksusowej willi",
    apartment: "Zakup apartamentu",
    investment: "Nieruchomość inwestycyjna",
    relocation: "Przeprowadzka na Cypr",
    "permanent-residency": "Stały pobyt",
    "new-development": "Nowa inwestycja",
  },
  ru: {
    "luxury-villa": "Покупка роскошной виллы",
    apartment: "Покупка квартиры",
    investment: "Инвестиционная недвижимость",
    relocation: "Переезд на Кипр",
    "permanent-residency": "Постоянное проживание",
    "new-development": "Новостройка",
  },
};

const CaseStudiesAll: FC<Props> = ({ title, caseStudies, lang }) => {
  const labels =
    categoryLabels[lang as keyof typeof categoryLabels] || categoryLabels.en;

  return (
    <section className={styles.caseStudies}>
      <div className="container">
        <h1 className={styles.pageTitle}>{title}</h1>

        <div className={styles.grid}>
          {caseStudies.map((item) => (
            <CaseStudyCard
              key={item._id}
              title={item.title}
              excerpt={item.excerpt}
              slug={item.slug}
              previewImage={item.previewImage}
              lang={lang}
              categoryTitle={labels[item.category]}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CaseStudiesAll;
