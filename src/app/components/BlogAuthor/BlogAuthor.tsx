import React, { FC } from "react";
import styles from "./BlogAuthor.module.scss";
import { Author } from "@/types/author";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";

type Props = {
  author: Author;
};

const BlogAuthor: FC<Props> = ({ author }) => {
  if (!author) {
    return null;
  }

  const { name, position, specialization, bio, image, linkedin } = author;

  return (
    <section className={styles.author}>
      <div className={styles.authorWrapper}>
        <div className={styles.authorImage}>
          {image && (
            <Image
              src={urlFor(image).url()}
              alt={image.alt ?? name}
              width={150}
              height={150}
              className={styles.image}
            />
          )}
        </div>

        <div className={styles.authorInfo}>
          <div className={styles.authorData}>
            <div className={styles.authorDataWrapper}>
              <div className={styles.authorDataLeft}>
                <h2 className={styles.authorName}>{name}</h2>
                {position && (
                  <p className={styles.authorPosition}>{position}</p>
                )}
              </div>
              <div className={styles.authorDataRight}>
                {linkedin && (
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.authorLinkedin}
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
          {bio && <p className={styles.authorBio}>{bio}</p>}
        </div>
      </div>
    </section>
  );
};

export default BlogAuthor;
