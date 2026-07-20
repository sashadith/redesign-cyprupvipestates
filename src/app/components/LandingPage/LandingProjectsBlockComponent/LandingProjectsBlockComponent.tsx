import React, { FC } from "react";
import styles from "./LandingProjectsBlockComponent.module.scss";
import { LandingProjectsBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../../ProjectLink/ProjectLink";
import FormStatic from "../../FormStatic/FormStatic";
import { localePrefix } from "@/lib/locale";

type Props = {
  block: LandingProjectsBlock;
  lang: string;
};

// Sold units stay visible (dimmed + sold badge, per the existing ProjectLink
// treatment) but sink to the end — Array.sort is stable in this engine, so
// the curated manual order is preserved within each group.
const bySoldLast = (projects: LandingProjectsBlock["projects"]) =>
  [...projects].sort((a: any, b: any) => (a.isSold === b.isSold ? 0 : a.isSold ? 1 : -1));

const LandingProjectsBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, projects } = block;
  const orderedProjects = bySoldLast(projects);

  return (
    <>
      <section className={styles.projectsSectionBlock}>
        <div className="container">
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.projects}>
            {orderedProjects.map((project: any) => {
              const projectUrl = `${localePrefix(lang)}/projects/${project.slug}`;
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
