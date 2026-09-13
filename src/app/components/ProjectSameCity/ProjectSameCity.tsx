// ProjectSameCity.tsx
import React from "react";
import { getThreeProjectsBySameCity } from "@/sanity/sanity.utils";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import styles from "./ProjectSameCity.module.scss";
import ProjectLink from "../ProjectLink/ProjectLink";
import { localePrefix } from "@/lib/locale";
import { projectSameCityCopy } from "./ProjectSameCity.copy";

type Props = {
  lang: string;
  city: string;
  currentProjectId?: string;
};

const ProjectSameCity = async ({ lang, city, currentProjectId }: Props) => {
  const projects = await getThreeProjectsBySameCity(
    lang,
    city,
    currentProjectId
  );

  if (!projects || projects.length === 0) {
    return null;
  }

  const title = projectSameCityCopy(lang).title;

  return (
    <section className={styles.projectSameCity}>
      <div className="container">
        <h2 className={styles.title}>
          {title} {city}
        </h2>
        <div className={styles.projects}>
          {projects.map((project: any) => {
            const projectUrl = `${localePrefix(lang)}/projects/${project.slug.current}`;
            return (
              <ProjectLink
                key={project._id}
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
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProjectSameCity;
