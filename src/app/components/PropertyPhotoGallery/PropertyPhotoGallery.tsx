"use client";
import Image from "next/image";
import { FC, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

import styles from "./PropertyPhotoGallery.module.scss";
import { urlFor } from "@/sanity/sanity.client";
import { ImageAlt } from "@/types/property";
import VideoSlide from "../VideoSlide/VideoSlide";

type Props = {
  photos: ImageAlt[]; // Только изображения
  iframeUrl?: string; // URL для видео iframe
  lang: string;
  videoId?: string; // ID YouTube-видео
};

const PropertyPhotoGallery: FC<Props> = ({
  photos,
  iframeUrl,
  lang,
  videoId,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const openModal = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const maximumVisiblePhotos = 3;
  const totalPhotos = photos.length;
  const displayPhotos = photos.slice(0, maximumVisiblePhotos);
  const remainingPhotosCount =
    totalPhotos > maximumVisiblePhotos ? totalPhotos - maximumVisiblePhotos : 0;

  return (
    <div className={styles.photoGallery}>
      <div className={styles.wrapper}>
        {/* <div className={styles.firstRow}>
          {videoId ? (
            <div
              onClick={() => openModal(0)}
              className={styles.iframeContainer}
            >
              <div className={styles.iframeOverlay}></div>
              <VideoSlide
                videoId={videoId}
                posterImage={photos[0]} // Передаем первое изображение как постер
              />
            </div>
          ) : (
            <Image
              src={urlFor(photos[0]).url()}
              alt="Photo 1"
              className={styles.imageMini}
              width={1000}
              height={1000}
              onClick={() => openModal(0)}
            />
          )}
        </div> */}
        <div className={styles.firstRow}>
          <Image
            src={urlFor(photos[0]).url()}
            alt="Photo 1"
            className={styles.imageMini}
            width={1000}
            height={1000}
            onClick={() => openModal(0)}
          />
        </div>
        <div className={styles.secondRow}>
          {photos.slice(1, maximumVisiblePhotos).map((photo, index) => (
            <div
              key={index + 1}
              className={styles.sectionRowPhoto}
              onClick={() => openModal(index + 1)}
            >
              <Image
                src={urlFor(photo).url()}
                alt={`Photo ${index + 2}`}
                className={styles.photoImage}
                width={1000}
                height={1000}
              />
            </div>
          ))}
          {remainingPhotosCount > 0 && (
            <div
              className={styles.remainingCount}
              onClick={() => openModal(maximumVisiblePhotos)}
            >
              <div className={styles.remainingOverlay}>
                +{remainingPhotosCount}
                {lang === "en"
                  ? " more"
                  : lang === "de"
                    ? " mehr"
                    : lang === "pl"
                      ? " więcej"
                      : lang === "ru"
                        ? " еще"
                        : " more"}
              </div>
            </div>
          )}
        </div>
        {showModal && (
          <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-90 z-[55]">
            <div className="h-[75vh] w-[320px] md:w-[720px] relative overflow-hidden">
              <Swiper
                modules={[Navigation]}
                navigation={{
                  nextEl: ".nextBtnNews",
                  prevEl: ".prevBtnNews",
                }}
                spaceBetween={50}
                slidesPerView={1}
                onSlideChange={(swiper) =>
                  setCurrentPhotoIndex(swiper.activeIndex)
                }
                initialSlide={currentPhotoIndex}
              >
                {photos.map((photo, index) => (
                  <SwiperSlide className={styles.swiperSlide} key={index}>
                    <Image
                      src={urlFor(photo).url()}
                      alt={`Photo ${index + 1}`}
                      className="img"
                      width={1000}
                      height={1000}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
              <div className="navButtonsGallery">
                <button className="prevBtnNews">❮</button>
                <button className="nextBtnNews">❯</button>
              </div>
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-white text-lg z-20"
              >
                ✖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyPhotoGallery;
