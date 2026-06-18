import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import styles from "./DescriptionBlock.module.scss";
import { DescriptionBlock as DescriptionBlockType } from "@/types/homepage";
import { RichText } from "../RichText/RichText";

type Props = {
  descriptionBlock: DescriptionBlockType;
};

const DescriptionBlock: FC<Props> = ({ descriptionBlock }) => {
  const { title, descriptionFields } = descriptionBlock;

  return (
    <section className={styles.descriptionBlock}>
      <div className="container">
        <h2 className="h2">{title}</h2>
        <div className={styles.descriptionFields}>
          {descriptionFields.map((descriptionField) => (
            <div
              key={descriptionField._key}
              className={styles.descriptionField}
            >
              <PortableText
                value={descriptionField.descriptionField}
                components={RichText}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DescriptionBlock;
