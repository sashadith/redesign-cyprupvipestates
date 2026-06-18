"use client";
import React, { FC, useEffect, useState, useRef } from "react";
import styles from "./SliderReviewsFull.module.scss";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import Image from "next/image";
import { FaChevronLeft, FaChevronRight, FaStar } from "react-icons/fa";
import { SlArrowLeft, SlArrowRight } from "react-icons/sl";
import { TfiClose } from "react-icons/tfi";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import { ReviewFull } from "@/types/blog";
import { urlFor } from "@/sanity/sanity.client";
import FadeUpAnimate from "../FadeUpAnimate/FadeUpAnimate";

type Props = {
  reviews: ReviewFull[];
  lang: string;
};

function truncatePortableText(blocks: any[], maxChars: number): any[] {
  let charCount = 0;
  const result: any[] = [];

  // Проходим по каждому блоку
  for (const block of blocks) {
    if (block._type !== "block" || !Array.isArray(block.children)) {
      continue; // пропускаем не-текстовые блоки
    }

    const newBlock = { ...block, children: [] as any[] };

    for (const child of block.children) {
      if (charCount >= maxChars) break;

      const text: string = child.text || "";
      const remaining = maxChars - charCount;

      if (text.length <= remaining) {
        // весь спан помещается
        newBlock.children.push(child);
        charCount += text.length;
      } else {
        // обрезаем этот спан ровно по оставшимся символам + добавляем …
        newBlock.children.push({
          ...child,
          text: text.slice(0, remaining) + "…",
        });
        charCount = maxChars;
        break;
      }
    }

    if (newBlock.children.length > 0) {
      result.push(newBlock);
    }

    if (charCount >= maxChars) {
      break;
    }
  }

  return result;
}

const SliderReviewsFull: FC<Props> = ({ reviews, lang }) => {
  const modalPrevRef = useRef<HTMLButtonElement>(null);
  const modalNextRef = useRef<HTMLButtonElement>(null);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const openModal = (index: number, event: any) => {
    event.stopPropagation(); // Prevent any parent handlers from being executed
    setCurrentPhotoIndex(index);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handlePrevious = () => {
    setCurrentPhotoIndex((prevIndex) =>
      prevIndex === 0 ? reviews.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentPhotoIndex((prevIndex) =>
      prevIndex === reviews.length - 1 ? 0 : prevIndex + 1
    );
  };

  // Обработчик нажатия клавиш
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeModal();
    }
  };

  // Добавление и удаление обработчика событий
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className={styles.sliderDiplomas}>
      <Swiper
        modules={[Pagination]}
        pagination={{ clickable: true }}
        spaceBetween={20}
        slidesPerView={1}
        autoHeight={true}
        onSlideChange={(swiper) => setCurrentPhotoIndex(swiper.activeIndex)}
        initialSlide={currentPhotoIndex}
        breakpoints={{
          320: { slidesPerView: 1, spaceBetween: 20 },
          500: { slidesPerView: 1.2, spaceBetween: 20 },
          768: { slidesPerView: 2, spaceBetween: 20 },
          980: { slidesPerView: 2.5, spaceBetween: 20 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
          1200: { slidesPerView: 4, spaceBetween: 10 },
        }}
        wrapperClass={styles.reviewsWrapper}
      >
        {reviews.map((review, index) => {
          const previewBlocks = truncatePortableText(review.text, 135);
          return (
            <SwiperSlide
              key={review._key}
              className={styles.slide}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(event) => openModal(index, event)}
            >
              <FadeUpAnimate>
                {/* {hoveredIndex === index && ( */}
                <div className={styles.reviewBlock}>
                  <div className={styles.reviewer}>
                    <div className={styles.reviewerImageBlock}>
                      {review.image ? (
                        <Image
                          alt={review.name}
                          src={urlFor(review.image).url()}
                          width={50}
                          height={50}
                          className={styles.reviewerImage}
                        />
                      ) : (
                        <Image
                          alt={review.name}
                          src="/uploads/files/89f48e6b04046faa19f0098ef071e4ac22ebcc74.png"
                          width={50}
                          height={50}
                          className={styles.reviewerImage}
                        />
                      )}
                    </div>
                    <div className={styles.reviewerName}>
                      <p>{review.name}</p>
                      <div className={styles.fiveStars}>
                        <FaStar fontSize="13px" color="#bd8948" />
                        <FaStar fontSize="13px" color="#bd8948" />
                        <FaStar fontSize="13px" color="#bd8948" />
                        <FaStar fontSize="13px" color="#bd8948" />
                        <FaStar fontSize="13px" color="#bd8948" />
                      </div>
                    </div>
                  </div>
                  <div className={styles.textReview}>
                    <PortableText value={previewBlocks} components={RichText} />
                  </div>
                  <button className={styles.buttonReadMore}>
                    {lang === "de"
                      ? "Ganze Bewertung lesen"
                      : lang === "en"
                        ? "Read full review"
                        : lang === "pl"
                          ? "Przeczytaj całą recenzję"
                          : lang === "ru"
                            ? "Читать полный отзыв"
                            : "Read full review"}
                  </button>
                </div>
              </FadeUpAnimate>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {showModal && (
        <div className={styles.fullscreenModal}>
          <button onClick={closeModal} className={styles.closeButton}>
            <TfiClose color="#fff" fontSize="2.5em" />
          </button>
          <Swiper
            modules={[Navigation, Pagination]}
            navigation={{
              prevEl: modalPrevRef.current,
              nextEl: modalNextRef.current,
            }}
            onBeforeInit={(swiper) => {
              // @ts-ignore
              swiper.params.navigation.prevEl = modalPrevRef.current;
              // @ts-ignore
              swiper.params.navigation.nextEl = modalNextRef.current;
            }}
            pagination={{
              clickable: true, // Делает кнопки пагинации кликабельными
              dynamicBullets: true, // Можно добавить для лучшей визуализации при большом количестве слайдов
              renderBullet: (index, className) => {
                return `<span class="${className}" style="background-color: ${index === activeIndex ? "#163E5C" : "#ffffff"}; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin: 0 5px;"></span>`;
              },
            }}
            onSlideChange={(swiper) => {
              setCurrentPhotoIndex(swiper.activeIndex);
              setActiveIndex(swiper.activeIndex);
            }}
            // spaceBetween={10}
            slidesPerView={1}
            initialSlide={currentPhotoIndex} // Установка начального слайда на текущий индекс
            className={styles.modalSwiper}
          >
            {reviews.map((review) => (
              <SwiperSlide key={review._key} className={styles.modalSlide}>
                <div className={styles.reviewPopup}>
                  <div className={styles.textReviewPopup}>
                    <p className={styles.reviewTitle}>{review.name}</p>
                    <div className={styles.reviewText}>
                      <PortableText value={review.text} components={RichText} />
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
            <div className={styles.navButtonsModal}>
              <button ref={modalPrevRef} className="swiperModalPrev">
                <SlArrowLeft color="#fff" fontSize="3.5em" />
              </button>
              <button ref={modalNextRef} className="swiperModalNext">
                <SlArrowRight color="#fff" fontSize="3.5em" />
              </button>
            </div>
          </Swiper>
        </div>
      )}
    </div>
  );
};

export default SliderReviewsFull;
