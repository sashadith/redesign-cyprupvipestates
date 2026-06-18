"use client";

import React, { FC, useState, useEffect } from "react";
import ReactModal from "react-modal";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Controller } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import styles from "./ProjectSlider.module.scss";
import modalStyles from "./Modal.module.scss";

import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import PropertySlideThumb from "../PropertySlideThumb/PropertySlideThumb";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { ImageModal } from "@/types/project";

const setModalAppElement = () => {
  if (typeof document !== "undefined") {
    const appElement = document.querySelector("#__next") || document.body;
    ReactModal.setAppElement(appElement as HTMLElement);
  }
};

type Props = {
  images: ImageModal[];
};

const ProjectSlider: FC<Props> = ({ images }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [mainSwiper, setMainSwiper] = useState<any>(null);
  const [modalSwiper, setModalSwiper] = useState<any>(null);

  useEffect(() => {
    setModalAppElement();
  }, []);

  const openModal = (index: number) => {
    setActiveIndex(index);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Swiper
        onSwiper={setMainSwiper}
        controller={{ control: modalSwiper }}
        navigation={{
          nextEl: ".next-button",
          prevEl: ".prev-button",
        }}
        slidesPerView={4}
        spaceBetween={20}
        modules={[Navigation, Controller]}
        breakpoints={{
          0: {
            slidesPerView: 1.2,
            spaceBetween: 10,
          },
          640: {
            slidesPerView: 2,
            spaceBetween: 10,
          },
          768: {
            slidesPerView: 4,
            spaceBetween: 10,
          },
          980: {
            slidesPerView: 6,
            spaceBetween: 10,
          },
        }}
        className={styles.slider}
      >
        {images.map((image, index) => (
          <SwiperSlide
            key={image._key || index}
            onClick={() => openModal(index)}
          >
            <div style={{ cursor: "pointer" }}>
              <PropertySlideThumb image={image} />
            </div>
          </SwiperSlide>
        ))}

        <div className={styles.navButtons}>
          <button className="prev-button" type="button">
            <IoIosArrowBack fontSize="3.5rem" color="#bd8948" />
          </button>
          <button className="next-button" type="button">
            <IoIosArrowForward fontSize="3.5rem" color="#bd8948" />
          </button>
        </div>
      </Swiper>

      <ReactModal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="View images"
        className={modalStyles.modalContent}
        overlayClassName={modalStyles.modalOverlay}
      >
        <button
          className={modalStyles.closeButton}
          onClick={closeModal}
          type="button"
        >
          &times;
        </button>

        <Swiper
          initialSlide={activeIndex}
          onSwiper={setModalSwiper}
          controller={{ control: mainSwiper }}
          spaceBetween={10}
          navigation={{
            nextEl: ".modal-next-button",
            prevEl: ".modal-prev-button",
          }}
          pagination={{ clickable: true }}
          modules={[Navigation, Pagination, Controller]}
          className={modalStyles.fullscreenSlider}
        >
          {images.map((image, index) => {
            const width = image.asset?.metadata?.dimensions?.width || 1600;
            const height = image.asset?.metadata?.dimensions?.height || 900;
            const src = image.asset?.url || urlFor(image).url();

            return (
              <SwiperSlide key={image._key || index}>
                <div className={modalStyles.imageFrame}>
                  <Image
                    src={src}
                    alt={image.alt || "Cyprus VIP Estate Project"}
                    className={modalStyles.fullscreenImage}
                    width={width}
                    height={height}
                    sizes="(max-width: 768px) 92vw, 98vw"
                    // priority={index === activeIndex}
                  />
                </div>
              </SwiperSlide>
            );
          })}

          <div className={modalStyles.modalNavButtons}>
            <button className="modal-prev-button" type="button">
              <IoIosArrowBack fontSize="3.5rem" color="#bd8948" />
            </button>
            <button className="modal-next-button" type="button">
              <IoIosArrowForward fontSize="3.5rem" color="#bd8948" />
            </button>
          </div>
        </Swiper>
      </ReactModal>
    </>
  );
};

export default ProjectSlider;
