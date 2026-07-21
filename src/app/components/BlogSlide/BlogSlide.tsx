import { File, Image as ImageType } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./BlogSlide.module.scss";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import Link from "next/link";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import { ImageAlt } from "@/types/project";
import { blurProps } from "@/lib/imageBlur";

type Props = {
  image: ImageAlt;
  title: string;
  // Development-sourced projects (resolveDevelopmentPrice) and legacy
  // "price on request" listings can both legitimately have no price —
  // null was always possible here, the type just didn't say so (2026-07-24
  // fix: every blog article with such a project in its manual project list
  // 500'd on price.toLocaleString()).
  price: number | null;
  linkLabel?: string;
  linkDestination?: string;
  buttonLabel?: string;
  lang: string;
};

const BlogSlide: FC<Props> = ({
  image,
  title,
  price,
  linkLabel,
  linkDestination,
  buttonLabel,
  lang,
}) => {
  // console.log("file", file);
  return (
    <div className={styles.slide}>
      {/* if image is available */}
      {image && (
        <Image
          alt={title}
          src={urlFor(image).url()}
          fill={true}
          sizes="100vw"
          className={styles.imagePoster}
          {...blurProps(image)}
        />
      )}
      {/* else poster image */}
      <div className={styles.posterImage}>
        <Image
          alt={title}
          src="/uploads/files/bef9ef8c1faaf4bb80be49714d5c345bc434b1e0.webp"
          fill={true}
          sizes="100vw"
          className={styles.imagePoster}
        />
      </div>
      <div className={styles.overlayWide}></div>
      <div className={styles.content}>
        <div className={styles.overlay}></div>
        <div className={styles.contentWrapper}>
          <p className={styles.title}>{title}</p>
          <p className={styles.price}>
            {price == null
              ? (lang === "en"
                  ? "Price on request"
                  : lang === "de"
                    ? "Preis auf Anfrage"
                    : lang === "pl"
                      ? "Cena na życzenie"
                      : lang === "ru"
                        ? "Цена по запросу"
                        : "Price on request")
              : (<>
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
                </>)}
          </p>
          {linkLabel && linkDestination && (
            <Link href={linkDestination} className={styles.link}>
              {linkLabel}
            </Link>
          )}
          {buttonLabel && (
            // <button className={styles.link}>{buttonLabel}</button>
            <ButtonModal>{buttonLabel}</ButtonModal>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogSlide;
