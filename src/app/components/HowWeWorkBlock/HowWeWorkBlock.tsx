import React, { FC } from "react";
import styles from "./HowWeWorkBlock.module.scss";
import { HowWeWorkBlock as HowWeWorkBlockType } from "@/types/homepage";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { MdOutlineArrowCircleDown } from "react-icons/md";

type Props = {
  work: HowWeWorkBlockType;
};

const HowWeWorkBlock: FC<Props> = ({ work }) => {
  if (!work || work.steps.length === 0) {
    return null;
  }

  return (
    <section className={styles.howWeWorkBlock}>
      <div className="container">
        <div className={styles.inner}>
          {work.title && <h2 className="h2">{work.title}</h2>}
          <div className={styles.steps}>
            {work.steps.map((step, index) => (
              <div key={step._key} className={styles.step}>
                <div className={styles.icon}>
                  <Image
                    alt={step.text}
                    src={urlFor(step.icon).url()}
                    width={80}
                    height={80}
                    unoptimized
                    className={styles.icon}
                  />
                </div>
                <div className={styles.text}>
                  {step.text && <p className={styles.title}>{step.text}</p>}
                </div>
                {index < work.steps.length - 1 && (
                  <MdOutlineArrowCircleDown
                    size={35}
                    color="#bd8948"
                    className={styles.arrow}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
          {work.description && (
            <div className={styles.descriptionText}>
              <p>{work.description}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HowWeWorkBlock;
