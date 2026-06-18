import { File, Image as ImageType } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./HeroSlide.module.scss";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import Link from "next/link";
import { ButtonModal } from "../ButtonModal/ButtonModal";

type Props = {
  image: ImageType;
  title: string;
  description: string;
  linkLabel?: string;
  linkDestination?: string;
  buttonLabel?: string;
};

const HeroSlide: FC<Props> = ({
  image,
  title,
  description,
  linkLabel,
  linkDestination,
  buttonLabel,
}) => {
  // console.log("file", file);
  return (
    <div className={styles.slide}>
      <Image
        alt={title}
        src={urlFor(image).url()}
        fill={true}
        className={styles.imagePoster}
      />
      <div className={styles.overlayWide}></div>
      <div className={styles.content}>
        <div className={styles.overlay}></div>
        <div className={styles.contentWrapper}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.description}>{description}</p>
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

export default HeroSlide;
