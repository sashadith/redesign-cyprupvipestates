import React, { FC } from "react";
import styles from "./LandingProjectsBlockComponent.module.scss";
import { LandingProjectsBlock } from "@/types/blog";
import { defaultLocale } from "@/i18n.config";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../../ProjectLink/ProjectLink";
import FormStatic from "../../FormStatic/FormStatic";

type Props = {
  block: LandingProjectsBlock;
  lang: string;
};

const LandingProjectsBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, projects } = block;

  return (
    <>
      <section className={styles.projectsSectionBlock}>
        <div className="container">
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.projects}>
            {projects.map((project: any) => {
              const projectUrl =
                lang === defaultLocale
                  ? `/projects/${project.slug}`
                  : `/${lang}/projects/${project.slug}`;
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
      <FormStatic lang={lang} />
    </>
  );
};

export default LandingProjectsBlockComponent;
