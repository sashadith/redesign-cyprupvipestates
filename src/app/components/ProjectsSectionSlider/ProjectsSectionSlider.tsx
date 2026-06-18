// ProjectsSectionSlider.tsx
"use client";
import React, { FC } from "react";
import styles from "./ProjectsSectionSlider.module.scss";
import { ProjectsSectionBlock } from "@/types/blog";
import SliderMain from "../SliderMain/SliderMain";
import HeroSlide from "../HeroSlide/HeroSlide";
import { File, Image as ImageType } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client";
import BlogSlide from "../BlogSlide/BlogSlide";

type Props = {
  block: ProjectsSectionBlock;
  lang: string;
};

const ProjectsSectionSlider: FC<Props> = ({ block, lang }) => {
  const { title, projects, marginTop, marginBottom } = block;
  const basePath = `/${lang}`;

  return (
    <section
      className={styles.projectsSectionSlider}
      style={{
        marginTop: marginTop || 0,
        marginBottom: marginBottom || 0,
      }}
    >
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.sliderBlog}>
        <SliderMain>
          {projects.map((proj) => {
            const href = `${basePath}/projects/${proj.slug}`;

            return (
              <BlogSlide
                key={proj._id}
                image={proj.previewImage}
                title={proj.title}
                price={proj.keyFeatures.price}
                linkLabel={
                  lang === "en"
                    ? "View project"
                    : lang === "de"
                      ? "Projekt ansehen"
                      : lang === "pl"
                        ? "Zobacz projekt"
                        : lang === "ru"
                          ? "Посмотреть проект"
                          : "View project"
                }
                linkDestination={href}
                lang={lang}
              />
            );
          })}
        </SliderMain>
      </div>
    </section>
  );
};

export default ProjectsSectionSlider;
