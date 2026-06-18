import { AboutBlock as AboutBlockType } from "@/types/homepage";
import React, { FC } from "react";
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

const icons = [
  "/uploads/files/ba3f4d2b7dfab88f974568c6e48bfeb05887cc62.png",
  "/uploads/files/6b42b682c9ad5404806c7076b27c570cf6f6aaee.png",
  "/uploads/files/df9081dc26b9a47b1f91875c3d202a8f2312ed0e.png",
  "/uploads/files/d69fd9657c815c5f89b217219f6a11f28ef08845.png",
  "/uploads/files/7f24ab0216a613135e82ce4af1781546f1aceadc.png",
  "/uploads/files/ee54c07265e200b7e25ae8586e474a337c225870.png",
];

const stepsText: Record<string, string[]> = {
  de: [
    "340 SONNENTAGE IM JAHR",
    "MITGLIED DER EUROPÄISCHEN UNION",
    "EINES DER BESTEN STEUERSYSTEME",
    "ausgezeichnete Lebensqualität",
    "SEHR HOHER BILDUNGSSTANDARD",
    "MOdernes gesundheitssystem",
  ],
  en: [
    "340 SUNNY DAYS A YEAR",
    "MEMBER OF THE EUROPEAN UNION",
    "ONE OF THE BEST TAX SYSTEMS",
    "excellent quality of life",
    "VERY HIGH STANDARD OF EDUCATION",
    "MODERN healthcare system",
  ],
  pl: [
    "340 SŁONECZNYCH DNI W ROKU",
    "CZŁONEK UNII EUROPEJSKIEJ",
    "JEDEN Z NAJLEPSZYCH SYSTEMÓW KONTROLI",
    "doskonała jakość życia",
    "BARDZO WYSOKIE STANDARDY EDUKACYJNE",
    "NOWOCZESNY system opieki zdrowotnej",
  ],
  ru: [
    "340 СОЛНЕЧНЫХ ДНЕЙ В ГОДУ",
    "Расположение в ЕС",
    "Комфортная налоговая система",
    "отличное качество жизни",
    "ВЫСОКИЕ стандарты образования",
    "СОВРЕМЕННАЯ система здравоохранения",
  ],
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
