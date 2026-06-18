import React, { FC } from "react";
import styles from "./ProjectsBlock.module.scss";
import { ProjectsBlock as ProjectsBlockType } from "@/types/homepage";
import Project from "../Project/Project";

type Props = {
  projectsBlock: ProjectsBlockType;
};

const ProjectsBlock: FC<Props> = ({ projectsBlock }) => {
  // const { title, projects } = projectsBlock;

  // console.log("projects", projectsBlock);

  return (
    <section className={styles.projectsBlock}>
      {/* <div className="container">
        <div className={styles.projectsData}>
          <h2 className="h2-white">{title}</h2>
        </div>
        <div className={styles.projects}>
          {projects.map((project) => (
            <Project
              key={project._key}
              title={project.title}
              description={project.description}
              image={project.image}
              city={project.city}
              propertyType={project.propertyType}
              adress={project.adress}
              flatsAmount={project.flatsAmount}
              area={project.area}
              price={project.price}
              buttonLabel={project.buttonLabel}
              buttonAltLabel={project.buttonAltLabel}
            />
          ))}
        </div>
      </div> */}
    </section>
  );
};

export default ProjectsBlock;
