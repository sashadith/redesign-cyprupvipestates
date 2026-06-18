import React, { FC } from "react";
import styles from "./PropertiesPageIntro.module.scss";

type Props = {
  title: string;
};

const PropertiesPageIntro: FC<Props> = ({ title }) => {
  return (
    <div className={styles.propertiesPageIntro}>
      <div className="container">
        <h1 className={styles.title}>{title}</h1>
      </div>
    </div>
  );
};

export default PropertiesPageIntro;
