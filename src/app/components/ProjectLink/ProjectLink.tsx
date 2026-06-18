import { urlFor } from "@/sanity/sanity.client";
import { ImageAlt } from "@/types/project";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import styles from "./ProjectLink.module.scss";

type Props = {
  url: string;
  previewImage: ImageAlt;
  title: string;
  price: number;
  bedrooms: number;
  coveredArea: number;
  plotSize: number;
  lang: string;
  isSold: boolean;
};

const ProjectLink: FC<Props> = ({
  url,
  previewImage,
  title,
  price,
  bedrooms,
  coveredArea,
  plotSize,
  lang,
  isSold,
}) => {
  // if (!previewImage || !previewImage.asset) {
  //   return null; // <-- просто не рендерим проект без картинки
  // }

  return (
    <Link href={url} className={styles.project}>
      <div className={styles.projectImage}>
        <div className={styles.overlay}></div>
        <Image
          src={urlFor(previewImage).url()}
          alt={previewImage.alt || title}
          className={styles.image}
          fill={true}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
        />
        <div className={styles.projectInfo}>
          {isSold && (
            <div className={styles.soldBadge}>
              <img
                src="/uploads/files/26e1326bb6674cac2ab950224bbc0b7d4fb7ba8a.png"
                alt={title}
              />
            </div>
          )}
          <p className={styles.projectTitle}>{title}</p>
          {!isSold && (
            <p className={styles.projectPrice}>
              {lang === "en"
                ? "Price from"
                : lang === "de"
                  ? "Preis ab"
                  : lang === "pl"
                    ? "Cena od"
                    : lang === "ru"
                      ? "Цена от"
                      : "Price from"}
              &nbsp;
              {price.toLocaleString()} €
            </p>
          )}
        </div>
      </div>
      <div className={styles.projectData}>
        <div className={styles.projectDataItem}>
          <p>
            {lang === "en"
              ? "Bedrooms"
              : lang === "de"
                ? "Schlafzimmer"
                : lang === "pl"
                  ? "Sypialnie"
                  : lang === "ru"
                    ? "Спальни"
                    : "Bedrooms"}
            <br />
            {bedrooms}
          </p>
        </div>
        <div className={styles.projectDataItemDivider}></div>
        <div className={styles.projectDataItem}>
          <p>
            {lang === "en"
              ? "Covered area"
              : lang === "de"
                ? "Überdachte Fläche"
                : lang === "pl"
                  ? "Powierzchnia zabudowy"
                  : lang === "ru"
                    ? "Площадь"
                    : "Covered area"}
            <br />
            {coveredArea} m²
          </p>
        </div>
        <div className={styles.projectDataItemDivider}></div>
        <div className={styles.projectDataItem}>
          <p>
            {lang === "en"
              ? "Plot size"
              : lang === "de"
                ? "Grundstück"
                : lang === "pl"
                  ? "Powierzchnia działki"
                  : lang === "ru"
                    ? "Площадь участка"
                    : "Plot size"}
            <br />
            {plotSize} m²
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ProjectLink;
