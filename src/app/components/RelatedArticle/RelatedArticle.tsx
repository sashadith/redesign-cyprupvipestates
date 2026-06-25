import React, { FC } from "react";
import styles from "./RelatedArticle.module.scss";
import { Category, Image as ImageType } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { blurProps } from "@/lib/imageBlur";

export type Props = {
  title: string;
  category?: Category;
  // Canonical URL resolved server-side (blog -> /[lang]/blog/slug, singlepage -> its full path).
  href?: string;
  previewImage?: ImageType;
};

const RelatedArticle: FC<Props> = ({
  title,
  href,
  category,
  previewImage,
}) => {
  if (!href) return null;

  const PLACEHOLDER =
    "/uploads/files/1580d3312e8cb973526a4d8f1019c78868ab3a45.jpg";

  return (
    <Link
      href={href}
      className={styles.relatedArticle}
    >
      <div className={styles.relatedArticleImage}>
        {previewImage ? (
          <Image
            src={urlFor(previewImage).url()}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={styles.previewImage}
            {...blurProps(previewImage)}
          />
        ) : (
          <Image
            src={PLACEHOLDER}
            alt="Placeholder"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={styles.previewImage}
          />
        )}
        {category && <p className={styles.categoryTitle}>{category.title}</p>}
      </div>
      <div className={styles.content}>
        <h3 className={styles.articleTitle}>{title}</h3>
      </div>
    </Link>
  );
};

export default RelatedArticle;
