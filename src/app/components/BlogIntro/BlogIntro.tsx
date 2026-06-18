import React, { FC } from "react";
import styles from "./BlogIntro.module.scss";
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { RichText } from "../RichText/RichText";
import { ImageAlt } from "@/types/project";

type Props = {
  title: string;
  categoryTitle: string;
  date: string;
  previewImage: ImageAlt;
};

const BlogIntro: FC<Props> = ({ title, categoryTitle, date, previewImage }) => {
  const formatDate = (dateString: string) => {
    const parsedDate = new Date(dateString);
    return parsedDate.toLocaleDateString("en-GB").replace(/\//g, ".");
  };

  return (
    <section className={styles.blogIntro}>
      <div className={styles.blogIntroWrapper}>
        <div className={styles.blogIntroContent}>
          <div className={styles.data}>
            <div className={styles.category}>{categoryTitle}</div>
            <div className={styles.date}>{formatDate(date)}</div>
          </div>
          <h1 className={styles.blogHeading}>{title}</h1>
        </div>
        <div className={styles.blogIntroImage}>
          {previewImage && (
            <Image
              src={urlFor(previewImage).url()}
              alt={title}
              fill={true}
              sizes="(max-width: 768px) 100vw, 800px"
              priority
              {...((previewImage as any).asset?.blurDataURL
                ? { placeholder: "blur" as const, blurDataURL: (previewImage as any).asset.blurDataURL }
                : {})}
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default BlogIntro;
