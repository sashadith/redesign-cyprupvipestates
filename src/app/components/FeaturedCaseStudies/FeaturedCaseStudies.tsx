import React, { FC } from "react";
import Link from "next/link";
import styles from "./FeaturedCaseStudies.module.scss";
import { FeaturedCaseStudiesBlock } from "@/types/homepage";
import CaseStudyCard from "../CaseStudyCard/CaseStudyCard";
import { CaseStudyCategory } from "@/types/caseStudy";

type Props = {
  block: FeaturedCaseStudiesBlock;
  lang: string;
};

const categoryLabels: Record<string, Record<CaseStudyCategory, string>> = {
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

const FeaturedCaseStudies: FC<Props> = ({ block, lang }) => {
  const { title, description, button, caseStudies } = block;

  const labels = categoryLabels[lang] || categoryLabels.en;

  if (!caseStudies?.length) return null;

  return (
    <section className={styles.featuredCaseStudies}>
      <div className="container">
        {title && <h2 className="h2">{title}</h2>}

        {description && (
          <div className={styles.descriptionBlock}>
            <p className={styles.description}>{description}</p>
          </div>
        )}

        <div className={styles.grid}>
          {caseStudies.map((caseStudy) => (
            <CaseStudyCard
              key={caseStudy._id}
              title={caseStudy.title}
              excerpt={caseStudy.excerpt}
              slug={caseStudy.slug}
              previewImage={caseStudy.previewImage}
              lang={lang}
              categoryTitle={labels[caseStudy.category]}
            />
          ))}
        </div>

        {button?.label && button?.url && (
          <div className={styles.buttonWrapper}>
            <Link href={button.url} className={styles.button}>
              {button.label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedCaseStudies;
