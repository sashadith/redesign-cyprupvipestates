import React from "react";
import styles from "./PropertiesList.module.scss";

const PropertiesList = ({ children }: any) => {
  return (
    <div className="container">
      <div className={styles.propertiesList}>{children}</div>
    </div>
  );
};

export default PropertiesList;
