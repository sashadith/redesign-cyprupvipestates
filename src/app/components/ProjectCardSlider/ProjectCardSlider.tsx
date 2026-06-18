"use client";

import React, { FC, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { ImageAlt } from "@/types/project";
import styles from "./ProjectCardSlider.module.scss";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";

type Props = {
  images: ImageAlt[];
  title: string;
  lang: string;
};

const ProjectCardSlider: FC<Props> = ({ images, title, lang }) => {
  const getViewMoreLabel = (lang: string) => {
    switch (lang) {
      case "de":
        return "Mehr anzeigen";
      case "pl":
        return "Zobacz więcej";
      case "ru":
        return "Смотреть ещё";
      default:
        return "View more";
    }
  };

  const prevRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  return (
    <div className={styles.sliderWrapper}>
      {/* ⚠️ СТРЕЛКИ ВСЕГДА В DOM */}
      <button
        type="button"
        ref={prevRef}
        className={`${styles.swiperButtonPrev} ${
          isBeginning ? styles.hiddenButton : ""
        }`}
      >
        <IoIosArrowBack size={22} />
      </button>

      <button
        type="button"
        ref={nextRef}
        className={`${styles.swiperButtonNext} ${
          isEnd ? styles.hiddenButton : ""
        }`}
      >
        <IoIosArrowForward size={22} />
      </button>

      <Swiper
        slidesPerView={1}
        spaceBetween={0}
        modules={[Navigation]}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
          // @ts-ignore
          swiper.params.navigation.prevEl = prevRef.current;
          // @ts-ignore
          swiper.params.navigation.nextEl = nextRef.current;
          swiper.navigation.init();
          swiper.navigation.update();
        }}
        onSlideChange={(swiper) => {
          setIsBeginning(swiper.isBeginning);
          setIsEnd(swiper.isEnd);
        }}
        onReachBeginning={() => setIsBeginning(true)}
        onReachEnd={() => setIsEnd(true)}
        onFromEdge={() => {
          setIsBeginning(false);
          setIsEnd(false);
        }}
        className={styles.slider}
      >
        {images.map((img, index) => {
          const isLast = index === images.length - 1;

          return (
            <SwiperSlide key={index}>
              <div className={styles.slideWrapper}>
                <Image
                  src={urlFor(img).url()}
                  alt={img.alt || title}
                  className={styles.image}
                  fill
                  sizes="(max-width: 768px) 80vw, 360px"
                />
                {isLast && (
                  <div className={styles.viewMoreOverlay}>
                    <span className={styles.viewMoreText}>
                      {getViewMoreLabel(lang)}
                    </span>
                  </div>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default ProjectCardSlider;
