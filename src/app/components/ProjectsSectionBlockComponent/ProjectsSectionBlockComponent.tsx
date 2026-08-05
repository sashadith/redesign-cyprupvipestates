"use client";

import React, { FC, useMemo, useRef, useState } from "react";
import styles from "./ProjectsSectionBlockComponent.module.scss";
import { ProjectsSectionBlock } from "@/types/blog";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity.client";
import ProjectLink from "../ProjectLink/ProjectLink";
import { localePrefix } from "@/lib/locale";
import { ProjectCard, type ProjectCardData } from "@/app/preview-projects/ProjectCard";
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";
import { resolveCompletionYear } from "@/lib/text";

type Props = {
  block: ProjectsSectionBlock;
  lang: string;
};

// Field-for-field match with getDeveloperCatalogByLang's own toCardData
// (developers/[slug]/page.tsx), so this block's cards receive the exact same
// ProjectCardData shape the developer page's cards do — not a second
// hand-tuned mapping that could drift out of sync with it. previewImage
// arrives here already asset-dereferenced by computeFilteredProjects (via
// D()) for legacy Project rows — an object, not a plain string — same
// {alt, asset:{url}} shape resolved via urlFor(); Development rows carry a
// plain string already (see mapDevelopmentRowToCard). computeFilteredProjects
// now supplies isNew/isFeatured/distances/unitsAvailable/unitsTotal too
// (2026-08-06) — previously a narrower shape than the listing/developer
// pages' own queries, closed to match.
function toCardData(project: any, lang: string): ProjectCardData {
  const kf = project.keyFeatures ?? {};
  const img = project.previewImage;
  return {
    id: project._id,
    title: project.title,
    href: `${localePrefix(lang)}/projects/${project.slug}`,
    image: typeof img === "string" ? img : img ? urlFor(img).url() : undefined,
    city: kf.city ?? "",
    price: typeof kf.price === "number" ? kf.price : Number(kf.price) || null,
    bedrooms: kf.bedrooms ?? "",
    area: kf.coveredArea ?? "",
    type: kf.propertyType ?? "",
    energy: kf.energyEfficiency ?? "",
    completion: resolveCompletionYear(kf.completionDate),
    isNew: !!project.isNew,
    isFeatured: !!project.isFeatured,
    vatApplies: kf.vatApplies ?? null,
    distances: project.distances ?? null,
    unitsAvailable: project.unitsAvailable,
    unitsTotal: project.unitsTotal,
  };
}

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

// Fallback ONLY for a block with no pageSize stored at all (shared with
// case-study/landing renders of this same component — see the render-time
// investigation in the commit message/PR description for exactly which
// blocks this can and can't reach). Every currently-existing
// projectsSectionBlock has pageSize explicitly baked in at 12, so changing
// this constant does not retroactively change any of them — this only sets
// what a future block with pageSize left unset would fall back to.
const DEFAULT_PAGE_SIZE = 8;

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
  const { title, projects, marginTop, marginBottom, paginate, pageSize } = block;
  // pageSize is stored per-block (set once, at creation, by whatever wrote
  // the block — the admin's "Add Projects" picker or an import script) and
  // is NOT re-derived from DEFAULT_PAGE_SIZE on every render. Every
  // currently-existing projectsSectionBlock has pageSize explicitly baked in
  // (confirmed against real data 2026-08-05: all 25 are set to 12) — this
  // fallback only ever applies to a block where pageSize was left unset.
  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const orderedProjects = useMemo(() => bySoldLast(projects), [projects]);
  const [page, setPage] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Only the live filterCity/filterPropertyType render opts into pagination
  // (see page.tsx's `usingFiltered` dispatch) — every manual-array page keeps
  // rendering its full curated list unpaginated, exactly as before.
  const isPaginated = !!paginate && orderedProjects.length > effectivePageSize;
  const totalPages = isPaginated ? Math.ceil(orderedProjects.length / effectivePageSize) : 1;
  const visibleProjects = isPaginated
    ? orderedProjects.slice((page - 1) * effectivePageSize, page * effectivePageSize)
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

  const s = projectsStrings(lang);

  return (
    <section
      className={styles.projectsSectionBlock}
      style={{
        marginTop: computedMarginTop,
        marginBottom: computedMarginBottom,
      }}
    >
      <div className="container">
        {/* iart__h2 — the same heading style every other H2 in this article
            already uses (color: var(--text), readable on the article's light
            background). NOT the /projects listing's own pp-h2: that class
            resolves color: var(--ivory), a fixed global token (#EFE9DB, not
            theme-scoped) meant for the listing page's dark-themed <main>
            (data-theme="dark") — reusing it here would reproduce the exact
            invisible-heading bug this change is fixing, just with a
            different off-white value. */}
        <h2 ref={headingRef} className="iart__h2">{title}</h2>
        {/* data-theme="dark" scopes the design tokens (--text-soft, --text-faint,
            --glass-bg, etc.) to their dark/ivory values for the card grid + pager,
            same as /projects (page.tsx's <main data-theme="dark">) and
            /developers/[slug] (DeveloperProjectsGrid.tsx's <section data-theme=
            "dark">). Without this, these tokens inherit the article body's
            .is-light override (light "ink" values), which ProjectCard was never
            designed for — its dark footer assumes the dark-token values, so
            .prj__dist's <i>/<small> labels render near-invisible ink-on-ink.
            The heading above stays outside this scope so .iart__h2 keeps using
            the article's light-theme color. */}
        <div data-theme="dark">
          <div className={styles.projects}>
            {visibleProjects.map((project: any) => (
              <ProjectCard key={project._id} c={toCardData(project, lang)} s={s} locale={lang} />
            ))}
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
      </div>
    </section>
  );
};

export default ProjectsSectionBlockComponent;
