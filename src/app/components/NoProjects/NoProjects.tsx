import React, { FC } from "react";
import styles from "./NoProjects.module.scss";

type Props = {
  lang: string;
};

const NoProjects: FC<Props> = ({ lang }) => {
  return (
    <div
      className={styles.noProjects}
      style={{ margin: "2rem 0", textAlign: "center" }}
    >
      {lang === "en"
        ? "No projects found. Please try searching with different parameters."
        : lang === "de"
          ? "Keine Projekte gefunden. Versuchen Sie, nach anderen Parametern zu suchen."
          : lang === "pl"
            ? "Nie znaleziono projektów. Spróbuj wyszukać według innych parametrów."
            : lang === "ru"
              ? "Проекты не найдены. Попробуйте поискать по другим параметрам."
              : "No projects found."}
    </div>
  );
};

export default NoProjects;
