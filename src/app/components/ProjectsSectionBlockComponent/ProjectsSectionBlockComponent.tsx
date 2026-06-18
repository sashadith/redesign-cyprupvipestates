import React, { FC } from "react";
import styles from "./ProjectsSectionBlockComponent.module.scss";
import { ProjectsSectionBlock } from "@/types/blog";
import { defaultLocale } from "@/i18n.config";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../ProjectLink/ProjectLink";

type Props = {
  block: ProjectsSectionBlock;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};

const ProjectsSectionBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, projects, marginTop, marginBottom } = block;

  const computedMarginTop =
    marginTop && marginValues[marginTop] ? marginValues[marginTop] : "0";

  const computedMarginBottom =
    marginBottom && marginValues[marginBottom]
      ? marginValues[marginBottom]
      : "0";

  return (
    <section
      className={styles.projectsSectionBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
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
  );
};

export default ProjectsSectionBlockComponent;
