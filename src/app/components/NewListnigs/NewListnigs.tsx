import Link from "next/link";
import styles from "./NewListnigs.module.scss";
import { getLastFiveProjectsByLang } from "@/sanity/sanity.utils";
import { Project } from "@/types/project";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import { BsChevronDoubleRight } from "react-icons/bs";

type Props = {
  lang: string;
};

export default async function NewListnigs({ lang }: Props) {
  const projects: Project[] = await getLastFiveProjectsByLang(lang);

  return (
    <section className={styles.newListings}>
      <div className="container">
        <div className={styles.newListingsWrapper}>
          {/* Блок с заголовком, который будет занимать всю ширину */}
          <div className={styles.newListingsTitle}>
            <h2>
              {lang === "en"
                ? "New Listings"
                : lang === "de"
                  ? "Neue Projekte"
                  : lang === "pl"
                    ? "Nowe oferty"
                    : lang === "ru"
                      ? "Новейшие проекты"
                      : "New Listings"}
            </h2>
          </div>
          {projects.map((project) => (
            <Link
              key={project._id}
              href={`/${lang}/projects/${project.slug[lang].current}`}
              className={styles.projectLink}
            >
              <div className={styles.projectImage}>
                <div className={styles.overlay}></div>
                <Image
                  src={urlFor(project.previewImage).url()}
                  alt={project.previewImage.alt || project.title}
                  className={styles.image}
                  fill={true}
                  sizes="(max-width: 768px) 100vw, 360px"
                />
                <div className={styles.projectInfo}>
                  <div className={styles.content}>
                    <p className={styles.projectTitle}>{project.title}</p>
                    <p className={styles.projectPrice}>
                      {lang === "en"
                        ? "Price from"
                        : lang === "de"
                          ? "Preis ab"
                          : lang === "pl"
                            ? "Cena od"
                            : lang === "ru"
                              ? "Цена от"
                              : "Price from"}
                      &nbsp;
                      {project.keyFeatures?.price != null
                        ? `${project.keyFeatures.price.toLocaleString()} €`
                        : lang === "en"
                          ? "on request"
                          : lang === "de"
                            ? "auf Anfrage"
                            : lang === "pl"
                              ? "na zapytanie"
                              : lang === "ru"
                                ? "по запросу"
                                : "on request"}
                    </p>
                  </div>
                  <div className={styles.button}>
                    <BsChevronDoubleRight fontSize="1.5rem" color="#fff" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className={styles.showAllBlock}>
          <Link
            href={`/${lang}/projects`}
            className={styles.showAll}
          >
            {lang === "en"
              ? "Show all projects"
              : lang === "de"
                ? "Alle Immobilienprojekte"
                : lang === "pl"
                  ? "Pokaż wszystkie projekty"
                  : lang === "ru"
                    ? "Показать все проекты"
                    : "Show all projects"}
          </Link>
        </div>
      </div>
    </section>
  );
}
