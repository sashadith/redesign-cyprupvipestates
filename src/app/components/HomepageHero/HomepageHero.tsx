import { HeroBlock } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./HomepageHero.module.scss";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import HeroVideoSection from "../HeroVideoSection/HeroVideoSection";
import { LinkPrimary } from "../ui/LinkPrimary/LinkPrimary";

type Props = {
  heroBlock: HeroBlock;
};

const HomepageHero: FC<Props> = ({ heroBlock }) => {
  const {
    video,
    posterImage,
    heroTitle,
    heroDescription,
    type,
    linkLabel,
    linkDestination,
    buttonLabel,
  } = heroBlock;

  return (
    <section className={styles.hero}>
      <HeroVideoSection
        video={video}
        posterImage={posterImage}
        heroTitle={heroTitle}
      />
      <div className={`container ${styles.contentInner}`}>
        <div className={styles.overlay}></div>
        <div className={styles.content}>
          <div className={styles.contentWrapper}>
            <h1 className={styles.title}>
              <span>Cyprus VIP Estates</span>
              <br />
              {heroTitle}
            </h1>
            <p className={styles.description}>{heroDescription}</p>
            <div className={styles.button}>
              {type === "button" && buttonLabel && (
                <ButtonModal>{buttonLabel}</ButtonModal>
              )}
              {type === "link" && linkLabel && linkDestination && (
                <LinkPrimary url={linkDestination}>{linkLabel}</LinkPrimary>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomepageHero;
