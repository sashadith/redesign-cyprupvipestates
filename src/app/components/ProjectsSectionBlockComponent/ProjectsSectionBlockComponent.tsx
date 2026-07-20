"use client";

import React, { FC, useMemo, useRef, useState } from "react";
import styles from "./ProjectsSectionBlockComponent.module.scss";
import { ProjectsSectionBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../ProjectLink/ProjectLink";
import { localePrefix } from "@/lib/locale";

type Props = {
  block: ProjectsSectionBlock;
  lang: string;
};

const marginValues: Record<string, string> = {
  small: "clamp(0.625rem, 2.5vw, 1.875rem)",
  medium: "clamp(1.25rem, 0.5rem + 3vw, 2.75rem)",
  large: "clamp(1.25rem, 5vw, 3.75rem)",
};

// Sold units stay visible (dimmed + sold badge, per ProjectLink's existing
// treatment) but sink to the end — Array.sort is stable in this engine, so
// the curated manual order is preserved within each group. Applies to every
// consumer of this component (landing pages via the [...slug] catch-all,
// and blog/case-study inline blocks) — same sort everywhere it renders.
// For the paginated/filtered path, computeFilteredProjects already puts sold
// legacy Projects at the true end of the full set, so this is a no-op there —
// kept as-is because it's still load-bearing for the manual-array path.
const bySoldLast = (projects: ProjectsSectionBlock["projects"]) =>
  [...projects].sort((a: any, b: any) => (a.isSold === b.isSold ? 0 : a.isSold ? 1 : -1));

const PAGE_SIZE = 12;

// Windowed page numbers: 1 … current-1 current current+1 … last
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

const ProjectsSectionBlockComponent: FC<Props> = ({ block, lang }) => {
  const { title, projects, marginTop, marginBottom, paginate } = block;
  const orderedProjects = useMemo(() => bySoldLast(projects), [projects]);
  const [page, setPage] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Only the live filterCity/filterPropertyType render opts into pagination
  // (see page.tsx's `usingFiltered` dispatch) — every manual-array page keeps
  // rendering its full curated list unpaginated, exactly as before.
  const isPaginated = !!paginate && orderedProjects.length > PAGE_SIZE;
  const totalPages = isPaginated ? Math.ceil(orderedProjects.length / PAGE_SIZE) : 1;
  const visibleProjects = isPaginated
    ? orderedProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : orderedProjects;

  // Client-side only — no ?page= param, no navigation. The full sorted set is
  // already on the page; this just swaps the visible 12 in local state.
  const goToPage = (n: number) => {
    if (n === page) return;
    setPage(n);
    const el = headingRef.current;
    if (!el) return;
    // Account for the site's fixed nav (same fallback height used by the
    // blog pager's scroll-to-block) and for Lenis, which otherwise overrides
    // a plain window.scrollTo before it finishes (see useLenis.ts).
    const navH = document.querySelector(".nav")?.getBoundingClientRect().height ?? 74;
    const targetY = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - (navH + 12)));
    const lenis = typeof window !== "undefined" ? (window as any).lenis : null;
    if (lenis && typeof lenis.scrollTo === "function") lenis.scrollTo(targetY, { duration: 0.9 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  const computedMarginTop =
    marginTop && marginValues[marginTop] ? marginValues[marginTop] : "0";

  const computedMarginBottom =
    marginBottom && marginValues[marginBottom]
      ? marginValues[marginBottom]
      : "0";

  return (
    <section
      className={styles.projectsSectionBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
      <div className="container">
        <h2 ref={headingRef} className={styles.title}>{title}</h2>
        <div className={styles.projects}>
          {visibleProjects.map((project: any) => {
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
          <nav className={styles.pager} aria-label="Results pagination">
            {page > 1 ? (
              <button type="button" className={styles.pagerLink} onClick={() => goToPage(page - 1)} aria-label="Previous">‹</button>
            ) : (
              <span className={`${styles.pagerLink} ${styles.pagerLinkDisabled}`} aria-hidden="true">‹</span>
            )}
            {pageWindow(page, totalPages).map((it, i) =>
              it === "…" ? (
                <span key={`gap-${i}`} className={styles.pagerGap} aria-hidden="true">…</span>
              ) : (
                <button
                  key={it}
                  type="button"
                  className={it === page ? `${styles.pagerLink} ${styles.pagerLinkActive}` : styles.pagerLink}
                  onClick={() => goToPage(it)}
                  aria-current={it === page ? "page" : undefined}
                >
                  {it}
                </button>
              ),
            )}
            {page < totalPages ? (
              <button type="button" className={styles.pagerLink} onClick={() => goToPage(page + 1)} aria-label="Next">›</button>
            ) : (
              <span className={`${styles.pagerLink} ${styles.pagerLinkDisabled}`} aria-hidden="true">›</span>
            )}
          </nav>
        )}
      </div>
    </section>
  );
};

export default ProjectsSectionBlockComponent;
