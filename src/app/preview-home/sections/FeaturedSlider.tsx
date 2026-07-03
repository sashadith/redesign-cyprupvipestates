"use client";

import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import type { FeaturedProject } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";
import { localePrefix } from "@/lib/locale";
import { homeStrings } from "./homeI18n";

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

const fmtPrice = (p?: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p || 0);

const Card: React.FC<{ project: FeaturedProject; lang: string }> = ({ project, lang }) => {
  const t = homeStrings(lang);
  const img = safeUrl(project.previewImage);
  const url = `${localePrefix(lang)}/projects/${project.slug}`;
  const { price } = project.keyFeatures || {};

  return (
    <a className="pcard" href={url}>
      <div className="pcard__media">
        {img && <img src={img} alt={project.title} />}
        {project.isSold && <span className="pcard__sold">{t.sold}</span>}
        <div className="pcard__shade" />
      </div>
      <div className="pcard__body">
        <h3 className="pcard__title">{project.title}</h3>
        <p className="pcard__price">
          {price && price > 0 ? (
            <>
              <span className="pcard__from">{t.priceFrom}</span>
              {fmtPrice(price)}
            </>
          ) : (
            t.priceOnRequest
          )}
        </p>
      </div>
    </a>
  );
};

export default function FeaturedSlider({
  projects,
  lang,
}: {
  projects: FeaturedProject[];
  lang: string;
}) {
  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{ delay: 2800, disableOnInteraction: false, pauseOnMouseEnter: true }}
      loop
      spaceBetween={20}
      slidesPerView={1.15}
      breakpoints={{
        640: { slidesPerView: 1.8 },
        900: { slidesPerView: 2.6 },
        1280: { slidesPerView: 3.4 },
      }}
      className="featured__swiper"
    >
      {projects.map((p) => (
        <SwiperSlide key={p._id}>
          <Card project={p} lang={lang} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
