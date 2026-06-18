// components/ProjectPdfButton/ProjectPdfButton.tsx

"use client";
import styles from "./ProjectPdfButton.module.scss";

type Props = {
  lang: string;
  slug: string;
};

export default function ProjectPdfButton({ lang, slug }: Props) {
  return (
    <a
      href={`/api/projects/${lang}/${slug}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.button}
    >
      {lang === "ru"
        ? "Скачать Брошюру"
        : lang === "pl"
          ? "Pobierz broszurę"
          : lang === "de"
            ? "Broschüre herunterladen"
            : "Download Brochure"}
    </a>
  );
}
