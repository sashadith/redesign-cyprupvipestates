"use client";
import React, { FC, useEffect, useState } from "react";
import styles from "./SliderReviews.module.scss";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import { Review } from "@/types/homepage";

type Props = {
  reviews: Review[];
};

const SliderReviews: FC<Props> = ({ reviews }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  return (
    <div className={styles.sliderReviews}>
      <Swiper
        modules={[Pagination]}
        pagination={{ clickable: true }}
        spaceBetween={20}
        slidesPerView={1}
        onSlideChange={(swiper) => setCurrentPhotoIndex(swiper.activeIndex)}
        initialSlide={currentPhotoIndex}
        breakpoints={{
          320: { slidesPerView: 1.2, spaceBetween: 20 },
          768: { slidesPerView: 2, spaceBetween: 20 },
          1280: { slidesPerView: 2.4, spaceBetween: 20 },
          1920: { slidesPerView: 3.4, spaceBetween: 20 },
        }}
      >
        {reviews.map((review, index) => (
          <SwiperSlide
            key={review._key}
            className={styles.slide}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* {hoveredIndex === index && ( */}
            <div className={styles.reviewBlock}>
              <div className={styles.textReview}>
                <PortableText value={review.reviewText} components={RichText} />
                <p className={styles.reviewTitle}>{review.name}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default SliderReviews;
