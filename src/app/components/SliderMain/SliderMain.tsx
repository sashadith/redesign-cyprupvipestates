"use client";
import styles from "./SliderMain.module.scss";
import React, { useRef, useId } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { FaArrowLeftLong, FaArrowRightLong } from "react-icons/fa6";

const SliderMain = ({ children }: any) => {
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const uniqueId = useId().replace(/[^a-zA-Z0-9_-]/g, ""); // безопасный класс
  const wrapperClass = `pagination-wrapper-${uniqueId}`;

  return (
    <div className={styles.sliderMain}>
      <div className={styles.sliderSlides}>
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 6000, disableOnInteraction: true }}
          slidesPerView={1}
          grabCursor
          pagination={{
            clickable: true,
            el: `.${styles.pagination}.${wrapperClass} .swiper-pagination`,
          }}
          // navigation={{
          //   prevEl: prevRef.current,
          //   nextEl: nextRef.current,
          // }}
          onBeforeInit={(swiper) => {
            // @ts-ignore
            // swiper.params.navigation.prevEl = prevRef.current;
            // @ts-ignore
            // swiper.params.navigation.nextEl = nextRef.current;
          }}
        >
          {children.map((child: any, index: number) => (
            <SwiperSlide key={index}>
              <div
                ref={(el) => {
                  slideRefs.current[index] = el;
                }}
              >
                {child}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <div className={styles.sliderButtons}>
        <div className={`${styles.pagination} ${wrapperClass}`}>
          <div className="swiper-pagination">
            <span className="swiper-pagination-bullet"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SliderMain;
