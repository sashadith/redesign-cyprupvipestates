import { ImageAlt } from "@/types/property";
import React, { FC } from "react";
import styles from "./PropertyIntro.module.scss";
import {
  FaArrowsToCircle,
  FaLocationDot,
  FaHouseCircleCheck,
  FaBuilding,
  FaElevator,
  FaMoneyBill,
  FaBoxArchive,
  FaChalkboard,
  FaSquareParking,
  FaPeopleRoof,
  FaHouseFlag,
} from "react-icons/fa6";
import PropertyPhotoGallery from "../PropertyPhotoGallery/PropertyPhotoGallery";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import ResponsiveMedia from "../ResponsiveMedia/ResponsiveMedia";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  title: string;
  excerpt: string;
  previewImage: ImageAlt;
  videoId?: string;
  videoPreview?: ImageAlt;
  lang: string;
  isSold: boolean;
};

const PropertyIntro: FC<Props> = ({
  title,
  excerpt,
  previewImage,
  videoId,
  videoPreview,
  lang,
  isSold,
}) => {
  return (
    <section className={styles.popertyIntro}>
      <ResponsiveMedia
        title={title}
        previewImage={previewImage}
        videoId={videoId}
        videoPreview={videoPreview}
      />
      <div className={`container ${styles.contentInner}`}>
        {isSold && (
          <div className={styles.soldBadge}>
            <img
              src="/uploads/files/26e1326bb6674cac2ab950224bbc0b7d4fb7ba8a.png"
              alt={title}
            />
          </div>
        )}
        <div className={styles.overlay}></div>
        <div className={styles.content}>
          <div className={styles.contentWrapper}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{excerpt}</p>
            <div className={styles.button}>
              <ButtonModal>
                {lang === "en"
                  ? "Request Personal Offer"
                  : lang === "de"
                    ? "Persönliches Angebot anfordern"
                    : lang === "pl"
                      ? "Poproś o indywidualną ofertę"
                      : lang === "ru"
                        ? "Запросить персональное предложение"
                        : "Request Personal Offer"}
              </ButtonModal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PropertyIntro;
