import React, { FC } from "react";
import styles from "./LandingProjectsBlockComponent.module.scss";
// Pager visual style reused as-is from ProjectsSectionBlockComponent (.pager/
// .pagerLink/.pagerLinkActive/.pagerLinkDisabled/.pagerGap) rather than
// duplicated -- that component itself is untouched by this change.
import pagerStyles from "../../ProjectsSectionBlockComponent/ProjectsSectionBlockComponent.module.scss";
import { LandingProjectsBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../../ProjectLink/ProjectLink";
import FormStatic from "../../FormStatic/FormStatic";
import { localePrefix } from "@/lib/locale";

type Props = {
  block: LandingProjectsBlock;
  lang: string;
  // The current page's own absolute path (e.g. "/ru/off-plan-properties-in-paphos"),
  // needed to build real, crawlable ?page=N hrefs. Only required when the
  // block actually has pagination enabled -- every other caller can omit it.
  pagePath?: string;
};

// Sold units stay visible (dimmed + sold badge, per the existing ProjectLink
// treatment) but sink to the end — Array.sort is stable in this engine, so
// the curated manual order is preserved within each group.
const bySoldLast = (projects: LandingProjectsBlock["projects"]) =>
  [...projects].sort((a: any, b: any) => (a.isSold === b.isSold ? 0 : a.isSold ? 1 : -1));

// Windowed page numbers: 1 … current-1 current current+1 … last. Duplicated
// from ProjectsSectionBlockComponent's identical helper rather than exporting
// it from that (untouched, out-of-scope) file -- small and pure enough that
// keeping the two in sync by inspection is a fair trade against widening that
// component's public surface for a one-function reuse.
function pageWindow(current: number, total: number): Array<number | "…"> {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!keep.has(n)) continue;
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

const LandingProjectsBlockComponent: FC<Props> = ({ block, lang, pagePath }) => {
  const { title, projects, totalPages, currentPage } = block;
  const orderedProjects = bySoldLast(projects);
  const page = currentPage ?? 1;
  // totalPages is only ever set by resolveBlocks when pagesEnabled is true;
  // every other block leaves it undefined, so isPaginated is false for all
  // of them exactly as today.
  const isPaginated = !!totalPages && totalPages > 1 && !!pagePath;
  // Real navigable hrefs (server-rendered, no client state) -- page 1 always
  // points at the bare path with no query string, so the canonical/no-query
  // URL is never one click away from itself with a stray "?page=1".
  const hrefFor = (n: number) => `${pagePath}${n > 1 ? `?page=${n}` : ""}`;

  return (
    <>
      <section className={styles.projectsSectionBlock}>
        <div className="container">
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.projects}>
            {orderedProjects.map((project: any) => {
              const projectUrl = `${localePrefix(lang)}/projects/${project.slug}`;
              return (
                <ProjectLink
                  key={project._id}
                  url={projectUrl}
                  previewImage={project.previewImage}
                  title={project.title}
                  price={project.keyFeatures.price}
                  bedrooms={project.keyFeatures.bedrooms}
                  coveredArea={project.keyFeatures.coveredArea}
                  plotSize={project.keyFeatures.plotSize}
                  lang={lang}
                  isSold={project.isSold}
                />
              );
            })}
          </div>
          {isPaginated && (
            <nav className={pagerStyles.pager} aria-label="Results pagination">
              {page > 1 ? (
                <Link href={hrefFor(page - 1)} className={pagerStyles.pagerLink} aria-label="Previous">‹</Link>
              ) : (
                <span className={`${pagerStyles.pagerLink} ${pagerStyles.pagerLinkDisabled}`} aria-hidden="true">‹</span>
              )}
              {pageWindow(page, totalPages!).map((it, i) =>
                it === "…" ? (
                  <span key={`gap-${i}`} className={pagerStyles.pagerGap} aria-hidden="true">…</span>
                ) : (
                  <Link
                    key={it}
                    href={hrefFor(it)}
                    className={it === page ? `${pagerStyles.pagerLink} ${pagerStyles.pagerLinkActive}` : pagerStyles.pagerLink}
                    aria-current={it === page ? "page" : undefined}
                  >
                    {it}
                  </Link>
                ),
              )}
              {page < totalPages! ? (
                <Link href={hrefFor(page + 1)} className={pagerStyles.pagerLink} aria-label="Next">›</Link>
              ) : (
                <span className={`${pagerStyles.pagerLink} ${pagerStyles.pagerLinkDisabled}`} aria-hidden="true">›</span>
              )}
            </nav>
          )}
        </div>
      </section>
      <FormStatic lang={lang} />
    </>
  );
};

export default LandingProjectsBlockComponent;
