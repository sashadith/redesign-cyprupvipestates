import { AboutBlock as AboutBlockType } from "@/types/homepage";
import React, { FC } from "react";
import styles from "./AboutBlock.module.scss";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  aboutBlock: AboutBlockType;
};

const AboutBlock: FC<Props> = ({ aboutBlock }) => {
  const { title, description, bullets } = aboutBlock;

  // console.log("bullets", bullets);

  return (
    <section className={styles.aboutBlock} id="about">
      <div className="container">
        <h2 className="h2">{title}</h2>
        <div className={styles.descriptionBlock}>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.bullets}>
          {bullets.map((bullet) => (
            <div key={bullet._key} className={styles.bullet}>
              <div className={styles.imageBlock}>
                <Image
                  alt={bullet.description}
                  src={urlFor(bullet.image).url()}
                  width={250}
                  height={250}
                  className={styles.image}
                />
              </div>
              <p className={styles.text}>{bullet.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutBlock;
