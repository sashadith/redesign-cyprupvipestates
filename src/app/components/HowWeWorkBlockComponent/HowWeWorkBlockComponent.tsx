import React, { FC } from "react";
// Copy moved to a shared module so the redesigned renderer reads the same source.
import { STEPS_ICONS as icons, STEPS_TEXT as stepsText } from "@/app/preview-landing/blockCopy";
import styles from "./HowWeWorkBlockComponent.module.scss";
import { HowWeWorkBlock as HowWeWorkBlockType } from "@/types/blog";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { MdOutlineArrowCircleDown } from "react-icons/md";

type Props = {
  block: HowWeWorkBlockType;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};



const HowWeWorkBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, marginTop, marginBottom } = block;
  const texts = stepsText[lang] || stepsText.en;

  const computedMarginTop =
    marginTop && marginValues[marginTop] ? marginValues[marginTop] : "0";

  const computedMarginBottom =
    marginBottom && marginValues[marginBottom]
      ? marginValues[marginBottom]
      : "0";

  return (
    <section
      className={styles.howWeWorkBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
      <div className="container">
        <div className={styles.inner}>
          <h2 className="h2">{title}</h2>
          <div className={styles.steps}>
            {icons.map((icon, index) => (
              <div key={index} className={styles.step}>
                <div className={styles.icon}>
                  <Image
                    alt={texts[index]}
                    src={icon}
                    width={80}
                    height={80}
                    unoptimized
                    className={styles.icon}
                  />
                </div>
                <div className={styles.text}>
                  <p className={styles.title}>{texts[index]}</p>
                </div>
                {index < icons.length - 1 && (
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
        </div>
      </div>
    </section>
  );
};

export default HowWeWorkBlockComponent;
