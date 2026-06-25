import React, { FC } from "react";
import Link from "next/link";
import styles from "./SectionLinks.module.scss";

// Two distinct, non-merged link blocks, each rendered ONLY when it has links (never site-wide):
//  - "section" = structural parent -> child links (via parentSanityId)
//  - "related" = editor-curated contextual links (Phase 2 "Related Landing Pages")
const HEADINGS: Record<string, Record<string, string>> = {
  section: {
    en: "More in this section",
    de: "Mehr in diesem Bereich",
    ru: "Ещё в этом разделе",
    pl: "Więcej w tej sekcji",
  },
  related: {
    en: "You may also be interested in",
    de: "Das könnte Sie auch interessieren",
    ru: "Вам также может быть интересно",
    pl: "Może Cię również zainteresować",
  },
};

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
        <h2 className={styles.heading}>{headings[lang] ?? headings.en}</h2>
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
