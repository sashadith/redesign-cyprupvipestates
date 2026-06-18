// app/components/Breadcrumbs/Breadcrumbs.tsx
import React from "react";
import Link from "next/link";
import styles from "./Breadcrumbs.module.scss";

type BreadcrumbsProps = {
  lang: string;
  /** Сегменты URL: ["apartments-in-cyprus","just-subpage","sub-sub-page"] */
  segments: string[];
  /** Заголовок текущей (последней) страницы */
  currentTitle: string;
};

const humanize = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); // Just Subpage

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  lang,
  segments,
  currentTitle,
}) => {
  const base = lang === "de" ? "" : `/${lang}`;
  const homeTitle =
    lang === "en"
      ? "Home"
      : lang === "ru"
        ? "Главная"
        : lang === "pl"
          ? "Strona główna"
          : lang === "de"
            ? "Startseite"
            : "Home";

  // Собираем массив крошек
  const crumbs = [
    { name: homeTitle, href: base || "/" },
    // промежуточные сегменты
    ...segments.slice(0, -1).map((seg, i) => {
      const path = segments.slice(0, i + 1).join("/");
      return { name: humanize(seg), href: `${base}/${path}` };
    }),
    // последняя — уже настоящий заголовок страницы
    { name: currentTitle, href: `${base}/${segments.join("/")}` },
  ];

  return (
    <div className="container">
      <nav
        aria-label="breadcrumb"
        className={styles.breadcrumbs}
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        <ol className={styles.breadcrumb}>
          {crumbs.map((crumb, idx) => (
            <li
              key={idx}
              className={`${styles.breadcrumbItem} ${
                idx === crumbs.length - 1 ? styles.breadcrumbItemActive : ""
              }`}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {idx < crumbs.length - 1 ? (
                <Link href={crumb.href} itemProp="item">
                  <span itemProp="name">{crumb.name}</span>
                </Link>
              ) : (
                <span itemProp="name">{crumb.name}</span>
              )}
              <meta itemProp="position" content={String(idx + 1)} />
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
};

export default Breadcrumbs;
