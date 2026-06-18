"use client";
import { ImageAlt } from "@/types/property";
import React, { FC, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation, Thumbs } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import "swiper/css/thumbs";

import styles from "./PropertySlider.module.scss";
import PropertySlide from "../PropertySlide/PropertySlide";
import PropertySlideThumb from "../PropertySlideThumb/PropertySlideThumb";

import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";

type Props = {
  images: ImageAlt[];
  videoId?: string;
  videoPreview?: ImageAlt;
};

const PropertySlider: FC<Props> = ({ images, videoId, videoPreview }) => {
  const [thumbsSwiper, setThumbsSwiper] = useState<any>(null);

  return (
    <>
      {/* Основной слайдер */}
      <Swiper
        navigation={{
          nextEl: ".next-button",
          prevEl: ".prev-button",
        }}
        pagination={{ clickable: true }}
        modules={[Navigation, Pagination, Thumbs]}
        thumbs={thumbsSwiper ? { swiper: thumbsSwiper } : undefined} // Проверка
        className={styles.slider}
      >
        {images.map((image, index) => (
          <SwiperSlide key={index}>
            <PropertySlide image={image} />
          </SwiperSlide>
        ))}
        <div className={styles.navButtons}>
          <button className="prev-button">
            <IoIosArrowBack fontSize="3.5rem" color="#bd8948" />
          </button>
          <button className="next-button">
            <IoIosArrowForward fontSize="3.5rem" color="#bd8948" />
          </button>
        </div>
      </Swiper>

      {/* Галерея миниатюр */}
      <div className="container">
        <Swiper
          onSwiper={setThumbsSwiper}
          spaceBetween={10}
          slidesPerView={3}
          freeMode={true}
          watchSlidesProgress={true}
          modules={[Thumbs]}
          className="mySwiperThumbs"
        >
          {images.map((image, index) => (
            <SwiperSlide key={index}>
              <PropertySlideThumb image={image} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </>
  );
};

export default PropertySlider;
