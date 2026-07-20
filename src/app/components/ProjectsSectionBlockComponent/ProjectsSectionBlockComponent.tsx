import React, { FC } from "react";
import styles from "./ProjectsSectionBlockComponent.module.scss";
import { ProjectsSectionBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../ProjectLink/ProjectLink";
import { localePrefix } from "@/lib/locale";

type Props = {
  block: ProjectsSectionBlock;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};

// Sold units stay visible (dimmed + sold badge, per ProjectLink's existing
// treatment) but sink to the end — Array.sort is stable in this engine, so
// the curated manual order is preserved within each group. Applies to every
// consumer of this component (landing pages via the [...slug] catch-all,
// and blog/case-study inline blocks) — same sort everywhere it renders.
const bySoldLast = (projects: ProjectsSectionBlock["projects"]) =>
  [...projects].sort((a: any, b: any) => (a.isSold === b.isSold ? 0 : a.isSold ? 1 : -1));

const ProjectsSectionBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, projects, marginTop, marginBottom } = block;
  const orderedProjects = bySoldLast(projects);

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
  );
};

export default ProjectsSectionBlockComponent;
