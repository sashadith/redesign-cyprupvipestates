import React, { FC } from "react";
import Link from "next/link";
import styles from "./PopularProperties.module.scss";
import { RelatedArticle } from "@/types/blog";
import { navLink } from "@/types/header";

type Props = {
  popularProperties: navLink[];
  lang: string;
};

const PopularProperties: FC<Props> = ({ popularProperties, lang }) => {
  return (
    <div className={styles.popularProperties}>
      <p className={styles.title}>
        {lang === "en"
          ? "Popular Properties"
          : lang === "de"
            ? "Beliebte Immobilien"
            : lang === "pl"
              ? "Popularne Nieruchomości"
              : lang === "ru"
                ? "Популярные объекты недвижимости"
                : "Popular Properties"}
      </p>
      <div className={styles.popularPropertiesList}>
        {popularProperties.map((property, index) => (
          <div key={index} className={styles.popularProperty}>
            <Link href={property.link} className={styles.link}>
              {property.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularProperties;
