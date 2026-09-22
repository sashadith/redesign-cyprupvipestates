import React, { FC } from "react";
import styles from "./NoProjects.module.scss";
import { noProjectsCopy } from "./NoProjects.copy";

type Props = {
  lang: string;
};

const NoProjects: FC<Props> = ({ lang }) => {
  return (
    <div
      className={styles.noProjects}
      style={{ margin: "2rem 0", textAlign: "center" }}
    >
      {noProjectsCopy(lang).message}
    </div>
  );
};

export default NoProjects;
