import React, { FC } from "react";
import styles from "./CaseStudyCard.module.scss";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { ImageAlt } from "@/types/project";

type Props = {
  title: string;
  excerpt?: string;
  categoryTitle: string;
  slug: {
    [lang: string]: {
      current: string;
    };
  };
  previewImage?: ImageAlt;
  lang: string;
};

const CaseStudyCard: FC<Props> = ({
  title,
  excerpt,
  slug,
  categoryTitle,
  previewImage,
  lang,
}) => {
  const langKey = lang as keyof typeof slug;

  const current =
    slug?.[langKey]?.current ?? Object.values(slug ?? {})[0]?.current ?? "";

  const PLACEHOLDER =
    "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

  return (
    <Link
      href={
        lang === "de"
          ? `/case-studies/${current}`
          : `/${lang}/case-studies/${current}`
      }
      className={styles.caseStudyCard}
    >
      <div className={styles.imageWrapper}>
        {previewImage ? (
          <Image
            src={urlFor(previewImage).url()}
            alt={title}
            fill
            className={styles.previewImage}
          />
        ) : (
          <Image
            src={PLACEHOLDER}
            alt="Placeholder"
            fill
            className={styles.previewImage}
          />
        )}

        <p className={styles.category}>{categoryTitle}</p>
      </div>

      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>

        {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      </div>
    </Link>
  );
};

export default CaseStudyCard;
