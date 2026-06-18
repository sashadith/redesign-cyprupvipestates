import { FeaturedProjectsBlock } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./FeaturedProjectsHomepage.module.scss";
import FeaturedProjectsSlider from "../FeaturedProjectsSlider/FeaturedProjectsSlider";

type Props = {
  featuredProjectsBlock: FeaturedProjectsBlock;
  lang: string;
};

const FeaturedProjectsHomepage: FC<Props> = ({
  featuredProjectsBlock,
  lang,
}) => {
  return (
    <section className={styles.featuredProjectsHomepage}>
      <div className="container">
        <div className={styles.wrapper}>
          <h2 className="h2-white">{featuredProjectsBlock.title}</h2>
          <p className="p-white">{featuredProjectsBlock.description}</p>
        </div>
      </div>
      <div className={styles.slider}>
        <FeaturedProjectsSlider
          featuredProjects={featuredProjectsBlock.projects}
          lang={lang}
        />
      </div>
    </section>
  );
};

export default FeaturedProjectsHomepage;
