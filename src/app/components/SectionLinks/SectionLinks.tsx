import React, { FC } from "react";
import Link from "next/link";
import styles from "./SectionLinks.module.scss";
import { isLocale } from "@/lib/locale";
import { HEADINGS } from "./SectionLinks.copy";

export { HEADINGS };

type Props = {
  lang: string;
  links: { title: string; href: string }[];
  variant?: "section" | "related";
};

const SectionLinks: FC<Props> = ({ lang, links, variant = "section" }) => {
  if (!links?.length) return null;
  const headings = HEADINGS[variant] ?? HEADINGS.section;
  return (
    <section className={styles.sectionLinks}>
      <div className="container">
        <h2 className={styles.heading}>{headings[isLocale(lang) ? lang : "en"]}</h2>
        <ul className={styles.list}>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={styles.link}>
                {l.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default SectionLinks;
