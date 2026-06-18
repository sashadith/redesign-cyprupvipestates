import React, { FC } from "react";
import { PortableText } from "@portabletext/react";
import { RichText } from "../RichText/RichText";
import styles from "./PropertyDescription.module.scss";

type Props = {
  description: any;
};

const PropertyDescription: FC<Props> = ({ description }) => {
  return (
    <section className={styles.propetryDescription}>
      <div className={styles.content}>
        <PortableText value={description} components={RichText} />
      </div>
    </section>
  );
};

export default PropertyDescription;
