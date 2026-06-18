// app/components/BreadcrumbsBlog/BreadcrumbsBlog.tsx
import React from "react";
import Link from "next/link";
import styles from "./BreadcrumbsBlog.module.scss";

type BreadcrumbsProps = {
  lang: string;
  segments: string[]; // e.g. ['my-post']
  currentTitle: string;
};

const humanize = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const blogLabelByLang: Record<string, string> = {
  en: "Blog",
  ru: "Блог",
  de: "Blog",
  pl: "Blog",
};

const homeLabelByLang: Record<string, string> = {
  en: "Home",
  ru: "Главная",
  de: "Startseite",
  pl: "Strona główna",
};

const BreadcrumbsBlog: React.FC<BreadcrumbsProps> = ({
  lang,
  segments,
  currentTitle,
}) => {
  const base = lang === "de" ? "" : `/${lang}`;
  const homeTitle = homeLabelByLang[lang] ?? homeLabelByLang.en;
  const blogTitle = blogLabelByLang[lang] ?? blogLabelByLang.en;

  const crumbs = [
    { name: homeTitle, href: base || "/" },
    { name: blogTitle, href: `${base}/blog` },
    // Если у вас будут вложенные рубрики внутри блога, их тоже можно вывести:
    ...segments.slice(0, -1).map((seg, i) => {
      const path = segments.slice(0, i + 1).join("/");
      return { name: humanize(seg), href: `${base}/blog/${path}` };
    }),
    // Наконец — сама статья
    { name: currentTitle, href: `${base}/blog/${segments.join("/")}` },
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

export default BreadcrumbsBlog;
