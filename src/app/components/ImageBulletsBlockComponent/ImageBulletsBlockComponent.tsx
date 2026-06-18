import React, { FC } from "react";
import styles from "./ImageBulletsBlockComponent.module.scss";
import { ImageBulletsBlock } from "@/types/blog";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import FadeUpAnimate from "../FadeUpAnimate/FadeUpAnimate";

type Props = {
  block: ImageBulletsBlock;
};

const ImageBulletsBlockComponent: FC<Props> = ({ block }) => {
  const { title, image, bullets } = block;
  return (
    <section className={styles.imageBulletsBlock}>
      <div className="container">
        <div className={styles.block}>
          <FadeUpAnimate>
            <div className={styles.wrapper}>
              <div className={styles.imageBlock}>
                <Image
                  src={urlFor(image).url()}
                  alt={image.alt ?? title}
                  width={400}
                  height={700}
                  className={styles.image}
                />
              </div>
              <div className={styles.bulletsBlock}>
                <ol className={styles.bulletsList}>
                  {bullets.map((bullet) => (
                    <li key={bullet._key} className={styles.bulletItem}>
                      <span className={styles.bulletTitle}>{bullet.title}</span>
                      <ul className={styles.bulletDescriptionList}>
                        <li className={styles.bulletDescription}>
                          {bullet.description}
                        </li>
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </FadeUpAnimate>
        </div>
      </div>
    </section>
  );
};

export default ImageBulletsBlockComponent;
