import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import styles from "./FullDescriptionBlock.module.scss";

type Props = {
  description: any;
};

const FullDescriptionBlock: FC<Props> = ({ description }) => {
  return (
    <section className={styles.fullDescriptionBlock}>
      <div className="container">
        <div className={styles.content}>
          <PortableText value={description} components={RichText} />
        </div>
      </div>
    </section>
  );
};

export default FullDescriptionBlock;
