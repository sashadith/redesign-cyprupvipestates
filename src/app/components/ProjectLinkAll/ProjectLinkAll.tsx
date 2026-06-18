import { urlFor } from "@/sanity/sanity.client";
import { ImageAlt } from "@/types/project";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import styles from "./ProjectLinkAll.module.scss";
import ProjectCardSlider from "../ProjectCardSlider/ProjectCardSlider";

type Props = {
  url: string;
  previewImage: ImageAlt;
  images: ImageAlt[];
  title: string;
  price: number;
  bedrooms: number;
  coveredArea: number;
  plotSize: number;
  lang: string;
  isSold: boolean;
  videoId?: string;
  isNew?: boolean;
};

const ProjectLinkAll: FC<Props> = ({
  url,
  previewImage,
  images,
  title,
  price,
  bedrooms,
  coveredArea,
  plotSize,
  lang,
  isSold,
  videoId,
  isNew,
}) => {
  // if (!previewImage || !previewImage.asset) {
  //   return null; // <-- просто не рендерим проект без картинки
  // }

  const sliderImages = [
    previewImage,
    ...(images || []).filter(
      (img) => img?.asset?._ref !== previewImage?.asset?._ref
    ),
  ].slice(0, 5);

  return (
    <Link href={url} className={styles.project}>
      <div className={styles.projectImage}>
        <div className={styles.overlay}></div>
        <ProjectCardSlider images={sliderImages} title={title} lang={lang} />
        {/* <Image
          src={urlFor(previewImage).url()}
          alt={previewImage.alt || title}
          className={styles.image}
          fill={true}
          unoptimized
        /> */}
        <div className={styles.projectTile}>
          {videoId ? (
            <p className={styles.projectTileItem}>
              {lang === "en"
                ? "Video"
                : lang === "de"
                  ? "Video"
                  : lang === "pl"
                    ? "Wideo"
                    : lang === "ru"
                      ? "Видео"
                      : "Video"}
            </p>
          ) : null}
          {isNew ? (
            <p className={styles.projectTileItem}>
              {lang === "en"
                ? "New"
                : lang === "de"
                  ? "Neu"
                  : lang === "pl"
                    ? "Nowość"
                    : lang === "ru"
                      ? "Новинка"
                      : "New"}
            </p>
          ) : null}
        </div>
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

export default ProjectLinkAll;
