import { AboutBlock as AboutBlockType } from "@/types/homepage";
import React, { FC } from "react";
// Copy moved to a shared module so the redesigned renderer reads the same source.
import { BULLETS_ICONS as icons, BULLETS_TEXT as stepsText } from "@/app/preview-landing/blockCopy";
import styles from "./BulletsBlockComponent.module.scss";
import Image from "next/image";
import { BulletsBlock } from "@/types/blog";

type Props = {
  block: BulletsBlock;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};



const BulletsBlockComponent: FC<Props> = ({ block, lang }) => {
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
      className={styles.aboutBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
      <div className="container">
        <h2 className="h2">{title}</h2>
        <div className={styles.bullets}>
          {icons.map((icon, index) => (
            <div key={index} className={styles.bullet}>
              <div className={styles.imageBlock}>
                <Image
                  alt={texts[index]}
                  src={icon}
                  width={250}
                  height={250}
                  className={styles.image}
                  unoptimized
                />
              </div>
              <p className={styles.text}>{texts[index]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BulletsBlockComponent;
