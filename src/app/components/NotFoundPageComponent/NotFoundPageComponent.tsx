import React, { FC } from "react";
import styles from "./NotFoundPageComponent.module.scss";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import Link from "next/link";
import { NotFoundPage } from "@/types/notFoundPage";
import { LinkPrimary } from "../ui/LinkPrimary/LinkPrimary";

type Props = {
  notFoundPage: NotFoundPage;
  lang: string;
};

const NotFoundPageComponent: FC<Props> = ({ notFoundPage, lang }) => {
  if (!notFoundPage) {
    return null;
  }

  const { textStart, textEnd, description, buttonText } = notFoundPage;

  return (
    <section className={styles.success}>
      <div className={`container ${styles.containerCustom}`}>
        <div className={styles.wrapper}>
          <div className={styles.contentBlock}>
            <div className={styles.contentTop}>
              {textStart && <h1 className={styles.title}>{textStart}</h1>}
              {textEnd && <p className={styles.title}>{textEnd}</p>}
            </div>
            <div className={styles.contentBottom}>
              <p className={styles.description}>{description}</p>
              <div className={styles.linkBlock}>
                <LinkPrimary
                  url={`/${lang}/projects`}
                >
                  {buttonText}
                </LinkPrimary>
              </div>
            </div>
            <div className={styles.imageBlock}>
              <img
                src="/uploads/files/40cbe6eb7197905bf9ffc938cad80c648888ef21.jpg"
                alt={textStart}
                className={styles.image}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPageComponent;
