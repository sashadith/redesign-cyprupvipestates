"use client";
import { FeaturedProjectsBlock } from "@/types/homepage";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import ProjectLink from "../ProjectLink/ProjectLink";

type Props = {
  featuredProjects: FeaturedProjectsBlock["projects"];
  lang: string;
};

const FeaturedProjectsSlider: React.FC<Props> = ({
  featuredProjects,
  lang,
}) => {
  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{
        delay: 2500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      }}
      spaceBetween={15}
      slidesPerView={1.2}
      breakpoints={{
        768: {
          slidesPerView: 2,
        },
        1024: {
          slidesPerView: 2.5,
        },
        1440: {
          slidesPerView: 3.4,
        },
        1920: {
          slidesPerView: 4.3,
        },
      }}
      loop={true}
    >
      {featuredProjects.map((project) => {
        const projectUrl =
          lang === "de"
            ? `/projects/${project.slug}`
            : `/${lang}/projects/${project.slug}`;

        return (
          <SwiperSlide key={project._id}>
            <ProjectLink
              url={projectUrl}
              previewImage={project.previewImage}
              title={project.title}
              price={project.keyFeatures.price}
              bedrooms={project.keyFeatures.bedrooms}
              coveredArea={project.keyFeatures.coveredArea}
              plotSize={project.keyFeatures.plotSize}
              lang={lang}
              isSold={project.isSold}
            />
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
};

export default FeaturedProjectsSlider;
