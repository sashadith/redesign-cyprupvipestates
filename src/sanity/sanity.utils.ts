// Phase 3 — data layer rewritten to read from Postgres via Prisma (was Sanity/GROQ).
// Public function names, signatures, and RETURN SHAPES are preserved so page components
// and types need no changes. Rich JSON fields were migrated faithfully (Sanity shape);
// asset refs are dereferenced on read via dereferenceAssets(), and relations are resolved
// with targeted Prisma joins. See DECISIONS.md (Decisions 1, 2, 6, 7).
import { cache } from "react";
import { draftMode } from "next/headers";
import { prisma } from "@/lib/prisma";
import { dereferenceAssets, refToLocalUrl } from "@/lib/sanityRefs";
import { localizedHref } from "@/lib/locale";
import { loadBlurMap } from "@/lib/blur";
import { resolveDevelopmentPrice, resolveBedRange, resolveDevelopmentLocation, resolveDevelopmentType, toCardDistances } from "@/lib/developmentCard";
import { soldOutFromCounts } from "@/lib/developmentAvailability";
import { Homepage } from "@/types/homepage";
import { Header } from "@/types/header";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { Singlepage } from "@/types/singlepage";
import { SanityFile } from "@/types/sanityFile";
import { Project } from "@/types/project";
import { ProjectsPage } from "@/types/projectsPage";
import { Developer } from "@/types/developer";
import { Blog } from "@/types/blog";
import { BlogPage } from "@/types/blogPage";
import { NotFoundPage } from "@/types/notFoundPage";
import { CaseStudy } from "@/types/caseStudy";
import { CaseStudiesPage } from "@/types/caseStudiesPage";
import { FaqPage } from "@/types/faq";

type AnyRow = Record<string, any>;
const D = <T>(v: T): T => dereferenceAssets(v);

// Draft Preview: when an admin has enabled Next.js Draft Mode (preview cookie), detail
// getters include unpublished content; otherwise only PUBLISHED. Safe at build time
// (draftMode() throws outside a request → falls back to the published-only filter).
function draftFilter(): { status?: "PUBLISHED" } {
  try { return draftMode().isEnabled ? {} : { status: "PUBLISHED" }; }
  catch { return { status: "PUBLISHED" }; }
}

// Prime the LQIP blur cache once at startup so dereferenceAssets() can attach a blur
// placeholder to EVERY image (lists, galleries, content) — not just detail hero images.
// Fire-and-forget: blur is a progressive enhancement, so a cold first hit simply renders
// without it. Memoized, so this is a single DB read for the whole process.
void loadBlurMap().catch(() => {});

// Per-request memoization: each detail page calls its getter in BOTH generateMetadata and the
// page body. React.cache() dedupes those to a single DB read per request (Next memoizes fetch(),
// not Prisma). The impls are declared below as `_getX` (function declarations are hoisted).
export const getHomePageByLang = cache(_getHomePageByLang);
export const getSinglePageByLang = cache(_getSinglePageByLang);
export const getBlogPostByLang = cache(_getBlogPostByLang);
export const getCaseStudyByLang = cache(_getCaseStudyByLang);
export const getProjectByLang = cache(_getProjectByLang);
export const getDeveloperByLang = cache(_getDeveloperByLang);

// Attach the migrated lqip (from Media) as blurDataURL on a (dereferenced) image's asset, so the
// LCP hero can render a blur placeholder. Single lookup — used only for previewImage on detail pages.
async function withBlur(img: any): Promise<any> {
  const ref = img?.asset?._ref ?? img?.asset?._id;
  if (!ref) return img;
  const m = await prisma.media.findUnique({ where: { sanityAssetId: ref }, select: { blurDataUrl: true } });
  if (m?.blurDataUrl && img.asset) img.asset.blurDataURL = m.blurDataUrl;
  return img;
}

// Project sanityIds intentionally hidden from listings/maps (business rule from source GROQ).
const HIDDEN_PROJECT_IDS: string[] = [
  "project-akamantis-gardens-de",
  "project-akamantis-gardens-en",
  "project-akamantis-gardens-pl",
  "project-akamantis-gardens-ru",
];

// Reconstruct a Sanity localizedSlug object ({ [lang]: { current } }) from a row.
const slugObj = (row: AnyRow) => (row?.slug ? { [row.language]: { current: row.slug } } : null);
const ref = (sanityId?: string | null) =>
  sanityId ? { _ref: sanityId, _type: "reference" } : null;

// _translations: sibling-language versions linked by translationGroupId, shaped like
// Sanity's `translations[].value->{ slug }`.
async function translationsFor(
  model: any,
  groupId: string | null | undefined,
  hasStatus = true, // status-bearing models must exclude unpublished siblings (else the
  // language switcher + hreflang would point at DRAFT/SCHEDULED/ARCHIVED siblings that the
  // frontend resolvers (which filter status:PUBLISHED) render as not-found. Pass false for
  // models without a status column (e.g. developer).
): Promise<{ slug: any }[]> {
  if (!groupId) return [];
  const siblings = await model.findMany({
    where: { translationGroupId: groupId, ...(hasStatus ? { status: "PUBLISHED" } : {}) },
    select: { language: true, slug: true },
  });
  return siblings.map((s: AnyRow) => ({ slug: { [s.language]: { current: s.slug } } }));
}

// Singletons (homepage, *Page, footer…) have one doc per language and no translationGroupId
// column — their language siblings are simply the same `type`. Mirrors GROQ `value->{ slug }`.
async function siteTranslations(type: string): Promise<{ slug: any }[]> {
  const rows = await prisma.siteDocument.findMany({ where: { type }, select: { data: true } });
  return rows.map((r) => ({ slug: (r.data as AnyRow)?.slug ?? null }));
}

const base = (row: AnyRow, type: string) => ({
  _id: row.sanityId,
  _type: type,
  _updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
  _createdAt: row.createdAt?.toISOString?.() ?? row.createdAt ?? null,
});

// ── Project projections used inside blocks/relations (slug as STRING per source GROQ) ──
const projectCardString = (p: AnyRow) => ({
  _id: p.sanityId,
  _type: "project",
  title: p.title,
  excerpt: p.excerpt,
  slug: p.slug, // string
  previewImage: D(p.previewImage),
  images: p.images ? D(p.images) : undefined,
  keyFeatures: p.keyFeatures,
  isSold: p.isSold,
});

// Resolve formStandardDocument reference (-> { _id, _type, language, form }).
async function resolveFormRef(refObj: any, lang: string) {
  const sid = refObj?._ref;
  if (!sid) return null;
  const doc = await prisma.siteDocument.findUnique({ where: { sanityId: sid } });
  if (!doc) return null;
  return { _id: sid, _type: "formStandardDocument", language: doc.language, form: (doc.data as AnyRow)?.form };
}

// Map project rows to their SAME-LANGUAGE sibling (via translationGroupId), so links built from
// the card slug match the page language. Project refs/relations may point at a different
// language's row (the stored slug would then 404 under the current locale, e.g.
// /pl/projects/<en-slug>). Rows already in `lang` are kept; rows with no sibling in `lang` are
// dropped (better than a 404). Input order is preserved and duplicates removed.
async function mapProjectRowsToLang(rows: AnyRow[], lang: string): Promise<AnyRow[]> {
  const tgids = Array.from(new Set(rows.filter((r) => r.language !== lang && r.translationGroupId).map((r) => r.translationGroupId as string)));
  const langRows = tgids.length ? await prisma.project.findMany({ where: { language: lang as any, translationGroupId: { in: tgids } } }) : [];
  const byTgid = new Map<string, AnyRow>();
  for (const r of langRows) if (r.translationGroupId && !byTgid.has(r.translationGroupId)) byTgid.set(r.translationGroupId, r as AnyRow);
  const out: AnyRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const m = r.language === lang ? r : (r.translationGroupId ? byTgid.get(r.translationGroupId) : undefined);
    if (m && !seen.has(m.sanityId)) { seen.add(m.sanityId); out.push(m); }
  }
  return out;
}

// Resolve project refs inside a block to the card projection (in the page's language).
async function resolveProjectRefs(refs: any[], lang: string) {
  const ids = (refs || []).map((r) => r?._ref).filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.project.findMany({ where: { sanityId: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.sanityId, r as AnyRow]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as AnyRow[];
  const mapped = await mapProjectRowsToLang(ordered, lang);
  return mapped.map((p) => projectCardString(p));
}

// Compute filteredProjects for projectsSection/landingProjects blocks.
async function computeFilteredProjects(lang: string, filterCity?: string, filterPropertyType?: string) {
  const rows = await prisma.project.findMany({
    where: {
      language: lang as any,
      ...(filterCity ? { city: filterCity } : {}),
      ...(filterPropertyType ? { propertyType: filterPropertyType } : {}),
      sanityId: { notIn: HIDDEN_PROJECT_IDS },
    },
    orderBy: { price: "asc" },
  });
  return rows
    .filter((p) => p.previewImage)
    .map((p) => ({
      _id: p.sanityId,
      title: p.title,
      slug: p.slug,
      previewImage: D(p.previewImage),
      keyFeatures: p.keyFeatures,
    }));
}

// Walk a page-builder contentBlocks array, resolving form/project refs, then deref assets.
async function resolveBlocks(blocks: any[] | null | undefined, lang: string): Promise<any[]> {
  if (!Array.isArray(blocks)) return [];
  const out: any[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") { out.push(block); continue; }
    const b: AnyRow = { ...block };
    if ((b._type === "contactFullBlock" || b._type === "formMinimalBlock") && b.form?._ref) {
      b.form = await resolveFormRef(b.form, lang);
    }
    if (b._type === "projectsSectionBlock" || b._type === "landingProjectsBlock") {
      if (Array.isArray(b.projects)) b.projects = await resolveProjectRefs(b.projects, lang);
      b.filteredProjects = await computeFilteredProjects(lang, b.filterCity, b.filterPropertyType);
    }
    // Inline Related Article: hydrate the referenced internal blog's title/excerpt/slug.
    if (b._type === "inlineRelatedArticleBlock" && b.article?._ref) {
      const art = await prisma.blog.findFirst({
        where: { sanityId: b.article._ref },
        select: { title: true, excerpt: true, slug: true, language: true },
      });
      b.resolved = art
        ? { title: art.title ?? "", excerpt: art.excerpt ?? "", slug: art.slug ?? "", language: art.language ?? lang }
        : null;
    }
    out.push(D(b));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
export async function getHeaderByLang(lang: string): Promise<Header> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "header", language: lang as any } } });
  const data = (row?.data as AnyRow) ?? {};
  return D({ _id: row?.sanityId, logo: data.logo, logoMobile: data.logoMobile, navLinks: data.navLinks }) as unknown as Header;
}

async function _getHomePageByLang(lang: string): Promise<Homepage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: lang as any } } });
  if (!row) return null as unknown as Homepage;
  const d = row.data as AnyRow;

  // featuredProjectsBlock.projects[]-> (slug string)
  const fpb = d.featuredProjectsBlock ? { ...d.featuredProjectsBlock } : undefined;
  if (fpb?.projects) {
    fpb.projects = await resolveProjectRefs(fpb.projects, lang);
  }
  // featuredCaseStudiesBlock.caseStudies[]-> (slug full object)
  const fcb = d.featuredCaseStudiesBlock ? { ...d.featuredCaseStudiesBlock } : undefined;
  if (fcb?.caseStudies) {
    const ids = fcb.caseStudies.map((r: any) => r?._ref).filter(Boolean);
    const rows = await prisma.caseStudy.findMany({ where: { sanityId: { in: ids } } });
    const byId = new Map(rows.map((r) => [r.sanityId, r]));
    fcb.caseStudies = ids.map((id: string) => byId.get(id)).filter(Boolean).map((c: AnyRow) => ({
      _id: c.sanityId, _type: "caseStudy", title: c.title, excerpt: c.excerpt, category: c.category,
      clientOverview: c.clientOverview, slug: slugObj(c), previewImage: D(c.previewImage),
      publishedAt: c.publishedAt?.toISOString?.() ?? null, _updatedAt: c.updatedAt,
    }));
  }

  // citiesBlock.cities[].image is intentionally language-INDEPENDENT — always
  // sourced from the EN document, matched by array position (Paphos/Limassol/
  // Larnaca are always in that order across every locale row). `city` (the
  // displayed label) and `link` stay per-locale/localized as normal; only the
  // image asset is borrowed. This is a structural fix, not just a data fix:
  // previously each locale stored (and could independently edit) its own
  // image reference, which drifted from EN's — DE/PL/RU showed a stale photo
  // for any city whose translated name didn't match a hardcoded English-keyed
  // lookup in Cities.tsx (see that file's own comment). Editing the image via
  // /admin/content/featured for a non-EN locale still updates that locale's
  // stored value (for data-consistency / a correct-looking preview there),
  // but the public page always renders EN's — so the three photos genuinely
  // cannot drift apart on the live site again.
  const cb = d.citiesBlock ? { ...d.citiesBlock } : undefined;
  if (cb?.cities?.length) {
    const enCities: AnyRow[] = lang === "en"
      ? cb.cities
      : ((await prisma.siteDocument.findUnique({ where: { type_language: { type: "homepage", language: "en" as any } } }))?.data as AnyRow)?.citiesBlock?.cities ?? [];
    cb.cities = cb.cities.map((c: AnyRow, i: number) => (enCities[i]?.image ? { ...c, image: { ...c.image, asset: enCities[i].image.asset } } : c));
  }

  const out: AnyRow = {
    ...base(row, "homepage"),
    ...d,
    featuredProjectsBlock: fpb,
    featuredCaseStudiesBlock: fcb,
    citiesBlock: cb,
    contentBlocks: await resolveBlocks(d.contentBlocks, lang),
    language: row.language,
    slug: d.slug,
    _translations: await siteTranslations("homepage"),
  };
  return D(out) as unknown as Homepage;
}

export async function getFooterByLang(lang: string): Promise<any> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "footer", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return D({ _id: row?.sanityId, ...d });
}

export async function getFormStandardDocumentByLang(lang: string): Promise<FormStandardDocument> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "formStandardDocument", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return { _id: row?.sanityId, form: d.form, language: row?.language } as unknown as FormStandardDocument;
}

async function _getSinglePageByLang(lang: string, slug: string): Promise<Singlepage | null> {
  const row = await prisma.singlepage.findFirst({ where: { language: lang as any, slug, ...draftFilter() } });
  if (!row) return null;
  let parentPage: any = null;
  if (row.parentSanityId) {
    const p = await prisma.singlepage.findUnique({ where: { sanityId: row.parentSanityId } });
    if (p) parentPage = { _id: p.sanityId, title: p.title, slug: slugObj(p), _translations: await translationsFor(prisma.singlepage as any, p.translationGroupId) };
  }
  const out: AnyRow = {
    ...base(row, "singlepage"),
    title: row.title, slug: slugObj(row), seo: row.seo, excerpt: row.excerpt,
    previewImage: D(row.previewImage), allowIntroBlock: row.allowIntroBlock,
    contentBlocks: await resolveBlocks(row.contentBlocks as any[], lang),
    parentPage, language: row.language,
    relatedLandingPages: row.relatedLandingPages ?? null,
    _translations: await translationsFor(prisma.singlepage as any, row.translationGroupId),
  };
  return D(out) as unknown as Singlepage;
}

export async function getAllSinglePagesByLang(lang: string) {
  const rows = await prisma.singlepage.findMany({ where: { language: lang as any, status: "PUBLISHED" } });
  const byId = new Map(rows.map((r) => [r.sanityId, r]));
  return rows.map((r) => ({
    _id: r.sanityId,
    slug: slugObj(r),
    parentPage: r.parentSanityId && byId.get(r.parentSanityId) ? { slug: slugObj(byId.get(r.parentSanityId) as AnyRow) } : undefined,
  })) as any;
}

export async function getAllPathsForLang(lang: string): Promise<string[][]> {
  const rows = await prisma.singlepage.findMany({
    where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" },
    select: { slug: true, parentSanityId: true, sanityId: true },
  });
  const slugById = new Map(rows.map((r) => [r.sanityId, r.slug]));
  const items = rows.map((r) => ({
    current: r.slug,
    parent: r.parentSanityId ? slugById.get(r.parentSanityId) ?? undefined : undefined,
  }));
  const map: Record<string, string[]> = {};
  items.forEach(({ current, parent }) => { if (current && !parent) map[current] = [current]; });
  let added = true;
  while (added) {
    added = false;
    items.forEach(({ current, parent }) => {
      if (!current || !parent) return;
      if (map[parent] && !map[current]) { map[current] = [...map[parent], current]; added = true; }
    });
  }
  return Object.values(map);
}

// Child landing pages of a parent singlepage (via parentSanityId) — for the contextual
// parent->child links block. Returns each child's title + canonical (nested) href, same language.
export async function getChildLandingPages(lang: string, parentSanityId?: string | null): Promise<{ title: string; href: string }[]> {
  if (!parentSanityId) return [];
  const kids = await prisma.singlepage.findMany({
    where: { language: lang as any, parentSanityId, status: "PUBLISHED", slug: { not: "" } },
    select: { slug: true, title: true },
    orderBy: { title: "asc" },
  });
  if (!kids.length) return [];
  const all = await getAllPathsForLang(lang);
  const byLeaf = new Map(all.map((s) => [s[s.length - 1], s]));
  return kids.map((k) => ({ title: k.title, href: localizedHref(lang, byLeaf.get(k.slug) ?? [k.slug]) }));
}

// Editor-curated "Related Landing Pages" (Phase 2). Resolves the stored refs to their target
// pages, preserving the editor's order. Enforces SAME-LANGUAGE + PUBLISHED at render time too
// (defence-in-depth on top of the admin picker + save action), and skips missing/unpublished refs.
export async function getRelatedLandingPages(lang: string, refs: any): Promise<{ title: string; href: string }[]> {
  const ids = Array.isArray(refs) ? refs.map((r) => r?._ref).filter(Boolean) : [];
  if (!ids.length) return [];
  const rows = await prisma.singlepage.findMany({
    where: { sanityId: { in: ids }, language: lang as any, status: "PUBLISHED", slug: { not: "" } },
    select: { sanityId: true, slug: true, title: true },
  });
  const bySanity = new Map(rows.map((r) => [r.sanityId, r]));
  const all = await getAllPathsForLang(lang);
  const byLeaf = new Map(all.map((s) => [s[s.length - 1], s]));
  return ids
    .map((id) => bySanity.get(id))
    .filter((r): r is { sanityId: string; slug: string; title: string } => Boolean(r))
    .map((r) => ({ title: r.title, href: localizedHref(lang, byLeaf.get(r.slug) ?? [r.slug]) }));
}

// ── Slug lists for generateStaticParams (ISR static generation) ──
export const ALL_LOCALES = ["en", "de", "pl", "ru"] as const;
// `published` adds status=PUBLISHED (so drafts aren't pre-rendered). Developer/Author/Category
// have no status column, so they pass published=false.
const slugList = (model: any, published: boolean) => async (lang: string): Promise<string[]> =>
  (await model.findMany({
    where: { language: lang as any, slug: { not: "" }, ...(published ? { status: "PUBLISHED" } : {}) },
    select: { slug: true },
  })).map((r: AnyRow) => r.slug);
export const getProjectSlugs = (lang: string) => slugList(prisma.project, true)(lang);
export const getBlogSlugs = (lang: string) => slugList(prisma.blog, true)(lang);
export const getCaseStudySlugs = (lang: string) => slugList(prisma.caseStudy, true)(lang);
export const getDeveloperSlugs = (lang: string) => slugList(prisma.developer, false)(lang);

// Single-page path items (current + parent slug) for generateStaticParams.
export async function getSinglePagePathItems(lang: string): Promise<{ current: string; parent?: string }[]> {
  const rows = await prisma.singlepage.findMany({
    where: { language: lang as any, status: "PUBLISHED" },
    select: { slug: true, parentSanityId: true, sanityId: true },
  });
  const slugById = new Map(rows.map((r) => [r.sanityId, r.slug]));
  return rows.map((r) => ({
    current: r.slug,
    parent: r.parentSanityId ? slugById.get(r.parentSanityId) ?? undefined : undefined,
  }));
}

// === Blog ===
async function _getBlogPostByLang(lang: string, slug: string): Promise<Blog> {
  const row = await prisma.blog.findFirst({
    where: { language: lang as any, slug, ...draftFilter() },
    include: { author: true, category: true },
  });
  if (!row) return null as unknown as Blog;

  // relatedArticles[]-> (blog or singlepage; slug full object)
  const relRefs: string[] = (row.relatedArticles as any[] | null)?.map((r) => r?._ref).filter(Boolean) ?? [];
  let related: any[] = [];
  if (relRefs.length) {
    const [blogs, pages] = await Promise.all([
      prisma.blog.findMany({ where: { sanityId: { in: relRefs } }, include: { category: true } }),
      prisma.singlepage.findMany({ where: { sanityId: { in: relRefs } } }),
    ]);
    const m = new Map<string, any>();
    blogs.forEach((b) => m.set(b.sanityId, {
      _id: b.sanityId, _type: "blog", title: b.title,
      category: b.category ? { _id: b.category.sanityId, _type: "category", title: b.category.title, slug: slugObj(b.category), language: b.category.language } : null,
      slug: slugObj(b), publishedAt: b.publishedAt?.toISOString?.() ?? null, previewImage: D(b.previewImage),
      // Blog posts live at /[lang]/blog/<slug> in their own language.
      href: localizedHref(b.language, ["blog", b.slug]),
    }));
    // Singlepages live at their canonical (possibly nested) path — NOT under /blog. Resolve the
    // full parent/child path per language so related links don't 404 (the old code always linked
    // /blog/<slug>) or bounce through the flat->nested redirect.
    const pathCache = new Map<string, Map<string, string[]>>();
    for (const p of pages) {
      if (!pathCache.has(p.language)) {
        const all = await getAllPathsForLang(p.language);
        pathCache.set(p.language, new Map(all.map((s) => [s[s.length - 1], s])));
      }
      const segs = pathCache.get(p.language)!.get(p.slug) ?? [p.slug];
      m.set(p.sanityId, {
        _id: p.sanityId, _type: "singlepage", title: p.title, slug: slugObj(p),
        previewImage: D(p.previewImage), href: localizedHref(p.language, segs),
      });
    }
    related = relRefs.map((id) => m.get(id)).filter(Boolean);
  }

  const out: AnyRow = {
    ...base(row, "blog"),
    title: row.title, slug: slugObj(row), seo: row.seo, publishedAt: row.publishedAt?.toISOString?.() ?? null,
    category: row.category ? { _id: row.category.sanityId, title: row.category.title, slug: slugObj(row.category) } : null,
    author: row.author ? {
      _id: row.author.sanityId, name: row.author.name, position: row.author.position,
      specialization: row.author.specialization, bio: row.author.bio, linkedin: row.author.linkedin,
      language: row.author.language, image: D(row.author.image),
    } : null,
    previewImage: await withBlur(D(row.previewImage)), excerpt: row.excerpt,
    contentBlocks: await resolveBlocks(row.contentBlocks as any[], lang),
    videoBlock: D(row.videoBlock), popularProperties: row.popularProperties,
    relatedArticles: related, language: row.language,
    _translations: await translationsFor(prisma.blog as any, row.translationGroupId),
  };
  return D(out) as unknown as Blog;
}

export async function getBlogPageByLang(lang: string): Promise<BlogPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "blogPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return {
    _id: row?.sanityId, title: d.title, metaTitle: d.metaTitle, metaDescription: d.metaDescription,
    content: d.content, language: row?.language,
    _translations: await siteTranslations("blogPage"),
  } as unknown as BlogPage;
}

export async function getBlogPostsByLang(lang: string): Promise<Blog[]> {
  const rows = await prisma.blog.findMany({
    where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" },
    include: { category: true }, orderBy: { publishedAt: "desc" },
  });
  return Promise.all(rows.map(async (b) => D({
    ...base(b, "blog"), title: b.title, slug: slugObj(b), previewImage: D(b.previewImage),
    category: b.category ? { title: b.category.title, slug: slugObj(b.category) } : null,
    publishedAt: b.publishedAt?.toISOString?.() ?? null, language: b.language,
    _translations: await translationsFor(prisma.blog as any, b.translationGroupId),
  }))) as unknown as Blog[];
}

export async function getBlogPostsByLangWithPagination(lang: string, limit: number, offset: number): Promise<Blog[]> {
  const rows = await prisma.blog.findMany({
    where: { language: lang as any, status: "PUBLISHED" }, include: { category: true },
    orderBy: { publishedAt: "desc" }, skip: offset, take: limit,
  });
  return Promise.all(rows.map(async (b) => D({
    _id: b.sanityId, title: b.title, excerpt: b.excerpt, slug: slugObj(b), previewImage: D(b.previewImage),
    category: b.category ? { title: b.category.title, slug: slugObj(b.category) } : null,
    publishedAt: b.publishedAt?.toISOString?.() ?? null, language: b.language,
    _translations: await translationsFor(prisma.blog as any, b.translationGroupId),
  }))) as unknown as Blog[];
}

export async function getTotalBlogPostsByLang(lang: string): Promise<number> {
  return prisma.blog.count({ where: { language: lang as any } });
}

// === Case Study ===
async function _getCaseStudyByLang(lang: string, slug: string): Promise<CaseStudy | null> {
  const row = await prisma.caseStudy.findFirst({ where: { language: lang as any, slug, ...draftFilter() } });
  if (!row) return null;
  const related = await prisma.caseStudyProject.findMany({ where: { caseStudyId: row.id }, include: { project: true } });
  // Related projects may be linked to a different language's row — map to the same-language
  // sibling so the slug matches `lang` (otherwise /<lang>/projects/<wrong-slug> 404s).
  const relatedMapped = await mapProjectRowsToLang(related.map((r) => r.project as AnyRow), lang);
  const out: AnyRow = {
    ...base(row, "caseStudy"),
    title: row.title, slug: slugObj(row), seo: row.seo, category: row.category, fullTitle: row.fullTitle,
    excerpt: row.excerpt, clientOverview: row.clientOverview, previewImage: D(row.previewImage),
    caseDetails: D(row.caseDetails), mainContent: await resolveBlocks(row.mainContent as any[], lang),
    relatedProjects: relatedMapped.map((p) => ({
      _id: p.sanityId, title: p.title, excerpt: p.excerpt, slug: p.slug,
      previewImage: D(p.previewImage), keyFeatures: p.keyFeatures, isSold: p.isSold,
    })),
    publishedAt: row.publishedAt?.toISOString?.() ?? null, language: row.language,
    _translations: await translationsFor(prisma.caseStudy as any, row.translationGroupId),
  };
  return D(out) as unknown as CaseStudy;
}

export async function getCaseStudiesByLang(lang: string): Promise<CaseStudy[]> {
  const rows = await prisma.caseStudy.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" } });
  return Promise.all(rows.map(async (c) => D({
    ...base(c, "caseStudy"), title: c.title, slug: slugObj(c), seo: c.seo, category: c.category,
    excerpt: c.excerpt, clientOverview: c.clientOverview, previewImage: D(c.previewImage),
    publishedAt: c.publishedAt?.toISOString?.() ?? null, language: c.language,
    _translations: await translationsFor(prisma.caseStudy as any, c.translationGroupId),
  }))) as unknown as CaseStudy[];
}

// Like getCaseStudiesByLang, but also includes fullTitle — neither existing
// list function selects it, only the single-case-study detail query
// (_getCaseStudyByLang) does. Added for the redesigned /preview-case-studies
// index, whose story headings use the fuller title. A dedicated function
// rather than extending the two above, since those also feed the live page
// and sitemap generation.
export async function getCaseStudiesByLangWithDetails(lang: string): Promise<CaseStudy[]> {
  const rows = await prisma.caseStudy.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" } });
  return Promise.all(rows.map(async (c) => D({
    ...base(c, "caseStudy"), title: c.title, fullTitle: c.fullTitle, slug: slugObj(c), seo: c.seo, category: c.category,
    excerpt: c.excerpt, clientOverview: c.clientOverview, previewImage: D(c.previewImage),
    publishedAt: c.publishedAt?.toISOString?.() ?? null, language: c.language,
    _translations: await translationsFor(prisma.caseStudy as any, c.translationGroupId),
  }))) as unknown as CaseStudy[];
}

export async function getCaseStudiesByLangWithPagination(lang: string, limit: number, offset: number): Promise<CaseStudy[]> {
  const rows = await prisma.caseStudy.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, skip: offset, take: limit });
  return Promise.all(rows.map(async (c) => D({
    _id: c.sanityId, _type: "caseStudy", title: c.title, excerpt: c.excerpt, slug: slugObj(c),
    previewImage: D(c.previewImage), category: c.category, clientOverview: c.clientOverview,
    publishedAt: c.publishedAt?.toISOString?.() ?? null, _updatedAt: c.updatedAt, language: c.language,
    _translations: await translationsFor(prisma.caseStudy as any, c.translationGroupId),
  }))) as unknown as CaseStudy[];
}

export async function getCaseStudiesPageByLang(lang: string): Promise<CaseStudiesPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "caseStudiesPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return {
    _id: row?.sanityId, title: d.title, metaTitle: d.metaTitle, metaDescription: d.metaDescription,
    content: d.content, language: row?.language,
    _translations: await siteTranslations("caseStudiesPage"),
  } as unknown as CaseStudiesPage;
}

export async function getTotalCaseStudiesByLang(lang: string): Promise<number> {
  return prisma.caseStudy.count({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" } });
}

// Redesigned FAQ page content (categories + Q&A items) — same SiteDocument
// pattern as caseStudiesPage above (one row per type+language), not the
// translationGroupId/per-item pattern used for blog/case-study/project: the
// FAQ page is a single fixed-path page (categories are in-page sections, not
// separately addressable URLs), so "type=faqPage, language=lang" is already
// the complete key — no slug or translationGroupId needed.
export async function getFaqPageByLang(lang: string): Promise<FaqPage | null> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "faqPage", language: lang as any } } });
  if (!row) return null;
  const d = (row.data as AnyRow) ?? {};
  return {
    categories: Array.isArray(d.categories) ? d.categories : [],
    language: row.language,
    _translations: await getFaqPageLanguages(),
  };
}

// Which languages currently have a published faqPage row — used by the page's
// LangSwitch (a language with no row yet falls back to the old Sanity FAQ via
// middleware, not a broken link, so the switcher must know to omit it).
async function getFaqPageLanguages(): Promise<{ language: string }[]> {
  const rows = await prisma.siteDocument.findMany({ where: { type: "faqPage" }, select: { language: true } });
  return rows.map((r) => ({ language: r.language }));
}

export async function getProjectsPageByLang(lang: string): Promise<ProjectsPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "projectsPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return {
    _id: row?.sanityId, seo: d.seo, title: d.title, language: row?.language,
    _translations: await siteTranslations("projectsPage"),
  } as unknown as ProjectsPage;
}

async function _getProjectByLang(lang: string, slug: string): Promise<Project | null> {
  const row = await prisma.project.findFirst({
    where: { language: lang as any, slug, ...draftFilter() },
    include: { developer: { select: { sanityId: true, title: true, slug: true, logo: true } } },
  });
  if (!row) return null;
  const out: AnyRow = {
    ...base(row, "project"),
    seo: row.seo, slug: slugObj(row), title: row.title, excerpt: row.excerpt,
    previewImage: await withBlur(D(row.previewImage)), videoId: row.videoId, videoPreview: D(row.videoPreview),
    images: D(row.images), description: D(row.description),
    location: row.latitude != null ? { _type: "geopoint", lat: row.latitude, lng: row.longitude } : null,
    developer: row.developer
      ? { _id: row.developer.sanityId, name: row.developer.title, slug: row.developer.slug, logo: D(row.developer.logo) }
      : null,
    keyFeatures: row.keyFeatures, investmentData: row.investmentData,
    distances: row.distances, fullDescription: D(row.fullDescription), faq: D(row.faq),
    isSold: row.isSold, language: row.language,
    _translations: await translationsFor(prisma.project as any, row.translationGroupId),
  };
  return D(out) as unknown as Project;
}

// Phase 5.5: when a legacy project's own lookup above returns null, check
// whether it exists but is ARCHIVED with a configured redirect target — if
// so, the detail page should 301 to that target instead of 404ing. Only
// matches ARCHIVED rows: an active redirect record on a project that's since
// been re-activated is dormant by design (see LegacyProjectRedirect in
// schema.prisma) rather than needing cleanup on re-activate.
export async function getLegacyProjectRedirect(lang: string, slug: string): Promise<string | null> {
  const row = await prisma.project.findFirst({
    where: { language: lang as any, slug, status: "ARCHIVED" },
    select: { redirectTarget: { select: { targetPath: true } } },
  });
  return row?.redirectTarget?.targetPath ?? null;
}

export async function getAllDevelopersByLang(lang: string): Promise<Developer[]> {
  const rows = await prisma.developer.findMany({ where: { language: lang as any, slug: { not: "" } }, orderBy: { title: "asc" } });
  return rows.map((d) => ({ _id: d.sanityId, _updatedAt: d.updatedAt, title: d.title, slug: slugObj(d), slugStr: d.slug, logo: D(d.logo), excerpt: d.excerpt })) as unknown as Developer[];
}

async function _getDeveloperByLang(lang: string, slug: string): Promise<Developer | null> {
  const row = await prisma.developer.findFirst({ where: { language: lang as any, slug } });
  if (!row) return null;
  const out: AnyRow = {
    _id: row.sanityId, seo: row.seo, slug: slugObj(row), title: row.title, titleFull: row.titleFull,
    excerpt: row.excerpt, logo: D(row.logo), description: D(row.description), language: row.language,
    _translations: await translationsFor(prisma.developer as any, row.translationGroupId, false),
  };
  return D(out) as unknown as Developer;
}

export async function getProjectsByDeveloper(lang: string, developerId: string): Promise<Project[]> {
  // developerId here is the original Sanity ref (developer._ref). Resolve to our row id.
  const dev = await prisma.developer.findUnique({ where: { sanityId: developerId }, select: { id: true } });
  if (!dev) return [];
  const rows = await prisma.project.findMany({
    where: { language: lang as any, developerId: dev.id, isSold: false },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((p) => p.previewImage).map((p) => D({
    _id: p.sanityId, title: p.title, slug: slugObj(p), previewImage: D(p.previewImage),
    keyFeatures: p.keyFeatures, language: p.language, isSold: p.isSold,
  })) as unknown as Project[];
}

export async function getThreeProjectsBySameCity(lang: string, city: string, excludeProjectId?: string): Promise<any[]> {
  const rows = await prisma.project.findMany({
    where: {
      language: lang as any, city, isSold: false,
      sanityId: { notIn: HIDDEN_PROJECT_IDS },
      ...(excludeProjectId ? { NOT: { sanityId: excludeProjectId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const list = rows.filter((p) => p.previewImage).map((p) => D({
    _id: p.sanityId, title: p.title, slug: { current: p.slug }, previewImage: D(p.previewImage), keyFeatures: p.keyFeatures,
  }));
  return list.sort(() => Math.random() - 0.5).slice(0, 3);
}

export async function getLastFiveProjectsByLang(lang: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: { language: lang as any, status: "PUBLISHED", sanityId: { notIn: HIDDEN_PROJECT_IDS } },
    orderBy: { createdAt: "desc" },
  });
  return rows.filter((p) => p.previewImage).slice(0, 5).map((p) => D({
    _id: p.sanityId, title: p.title, slug: slugObj(p), previewImage: D(p.previewImage), keyFeatures: p.keyFeatures,
  })) as unknown as Project[];
}

export type LatestDevelopmentCard = {
  _id: string;
  title: string;
  slug: string;
  previewImage: string | null;
  keyFeatures: { price: number };
  isSold: boolean;
};

// Homepage "Latest Developments" block — most recently published Developments,
// excluding fully sold-out ones, newest first. Development rows are language-
// agnostic (one slug for all locales — see developmentSeo.ts), so `lang` isn't a
// filter here, only unused by callers building the localized href.
export async function getLatestDevelopmentsByLang(limit = 5): Promise<LatestDevelopmentCard[]> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: "published", supersedesProjects: { none: { status: "PUBLISHED" } } },
    include: { override: true, units: { select: { status: true, price: true } } },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });

  return devs
    .filter((d) => !!d.slug)
    .map((d) => {
      const ov = d.override;
      const gallery: string[] = Array.isArray(ov?.gallery) && (ov!.gallery as string[]).length
        ? (ov!.gallery as string[])
        : Array.isArray(d.gallery) ? (d.gallery as string[]) : [];
      const previewImage = ov?.mainImage || gallery[0] || null;
      const { priceFrom } = resolveDevelopmentPrice(d.priceFrom, d.priceTo, d.units);
      const unitsAvailable = d.units.filter((u) => u.status === "available").length;
      return {
        _id: d.id,
        title: ov?.alias || d.publicName,
        slug: d.slug as string,
        previewImage,
        keyFeatures: { price: priceFrom ?? 0 },
        isSold: soldOutFromCounts(unitsAvailable, d.units.length),
      };
    })
    .filter((d) => !d.isSold)
    .filter((d) => !!d.previewImage)
    .slice(0, limit);
}

export async function getAllProjectsByLang(lang: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { createdAt: "desc" } });
  return rows.map((p) => D({
    ...base(p, "project"), title: p.title, slug: slugObj(p), previewImage: D(p.previewImage),
    keyFeatures: p.keyFeatures, language: p.language,
  })) as unknown as Project[];
}

// ── Filtered projects (DB where + existing JS sorting) ──
type ProjectListItem = {
  _id: string; title: string; excerpt?: string; slug: any; previewImage: any; images?: any[];
  keyFeatures?: { price?: number; city?: string; propertyType?: string; bedrooms?: string; coveredArea?: string; plotSize?: string; completionDate?: string; energyEfficiency?: string; vatApplies?: boolean | null };
  isSold?: boolean; videoId?: string; isNew?: boolean; isFeatured?: boolean; listingPriority?: number; _createdAt?: string;
  // "project" (default, legacy Sanity-origin) or "development" (the new Prisma-backed
  // pipeline, merged into this same listing — see queryFilteredDevelopmentRows below).
  // Both sources now share the same /projects/{slug} path (cutover 2026-07-17);
  // callers still key off this to pick the right card-field shape (e.g. distances).
  _source?: "project" | "development";
  // Development rows only — feeds the ScarcityBanner. undefined for legacy rows
  // (no unit data), which is exactly what tells the card to render no banner.
  unitsAvailable?: number;
  unitsTotal?: number;
  // Development rows only, already shaped for the legacy card-footer renderer
  // (see toCardDistances in developmentCard.ts). Legacy Project rows instead
  // get theirs from getProjectDistancesByIds's separate distMap lookup — the
  // page.tsx callers prefer THIS field only when _source === "development".
  distances?: Record<string, string> | null;
};
const getNumericPrice = (p: ProjectListItem) => Number(p?.keyFeatures?.price ?? 0);
const getCompletionTimestamp = (p: ProjectListItem) => { const r = p?.keyFeatures?.completionDate; if (!r) return null; const t = new Date(r).getTime(); return Number.isNaN(t) ? null : t; };
const getProjectScore = (p: ProjectListItem) => { let s = 0; if (p.isFeatured) s += 100000; s += (p.listingPriority ?? 0) * 1000; if (p.videoId) s += 200; if (p.isNew) s += 100; return s; };
const getPriceSegment = (price: number): "low" | "mid" | "high" | "luxury" => (price < 300000 ? "low" : price < 600000 ? "mid" : price < 1000000 ? "high" : "luxury");
function sortWithinBucket(ps: ProjectListItem[]) { return [...ps].sort((a, b) => { const s = getProjectScore(b) - getProjectScore(a); if (s) return s; const pr = getNumericPrice(b) - getNumericPrice(a); if (pr) return pr; return (a.title || "").localeCompare(b.title || ""); }); }
function interleaveByPriceSegments(ps: ProjectListItem[]) {
  const buckets: Record<"low" | "mid" | "high" | "luxury", ProjectListItem[]> = { low: [], mid: [], high: [], luxury: [] };
  for (const p of ps) buckets[getPriceSegment(getNumericPrice(p))].push(p);
  (Object.keys(buckets) as Array<keyof typeof buckets>).forEach((k) => (buckets[k] = sortWithinBucket(buckets[k])));
  const result: ProjectListItem[] = []; const pattern: Array<"mid" | "high" | "low" | "luxury"> = ["mid", "high", "low", "luxury", "mid", "high"];
  let added = true; while (added) { added = false; for (const b of pattern) { const n = buckets[b].shift(); if (n) { result.push(n); added = true; } } }
  return result;
}
// Sold-out cards sort last regardless of the active sort mode (Part 2b) —
// applied as a final partition rather than threaded into every sort branch
// below, so it can never be forgotten when a new sort mode is added later.
// Legacy Project rows (no unit data) are never sold-out by this check.
const isSoldOutItem = (p: ProjectListItem) => (p as any).unitsTotal != null && soldOutFromCounts((p as any).unitsAvailable ?? 0, (p as any).unitsTotal);
function pushSoldOutLast(items: ProjectListItem[]): ProjectListItem[] {
  const active = items.filter((p) => !isSoldOutItem(p));
  const soldOut = items.filter(isSoldOutItem);
  return [...active, ...soldOut];
}
function sortProjectsRecommended(ps: ProjectListItem[]) {
  return pushSoldOutLast([...interleaveByPriceSegments(ps.filter((p) => p.isFeatured)), ...interleaveByPriceSegments(ps.filter((p) => !p.isFeatured))]);
}
function sortProjectsStandard(ps: ProjectListItem[], sort: string) {
  const items = [...ps];
  switch (sort) {
    case "priceAsc": return pushSoldOutLast(items.sort((a, b) => getNumericPrice(a) - getNumericPrice(b)));
    case "priceDesc": return pushSoldOutLast(items.sort((a, b) => getNumericPrice(b) - getNumericPrice(a)));
    case "titleAsc": return pushSoldOutLast(items.sort((a, b) => (a.title || "").localeCompare(b.title || "")));
    case "titleDesc": return pushSoldOutLast(items.sort((a, b) => (b.title || "").localeCompare(a.title || "")));
    case "completionSoon": return pushSoldOutLast(items.sort((a, b) => { const x = getCompletionTimestamp(a); const y = getCompletionTimestamp(b); if (x !== null && y !== null) return x - y; if (x !== null) return -1; if (y !== null) return 1; return (a.title || "").localeCompare(b.title || ""); }));
    default: return pushSoldOutLast(items.sort((a, b) => { const x = a._createdAt ? new Date(a._createdAt).getTime() : 0; const y = b._createdAt ? new Date(b._createdAt).getTime() : 0; return y - x; }));
  }
}

type ProjectFilters = { city?: string; priceFrom?: number | null; priceTo?: number | null; propertyType?: string; bedrooms?: string; q?: string; sort?: string; north?: number | null; south?: number | null; east?: number | null; west?: number | null };

// Bedrooms are stored as ranges ("1-2", "2-3", "3" ...). A wanted value matches when it
// falls within the project's range; "5" means 5+.
function bedroomsMatch(range: string | null | undefined, want: string): boolean {
  const nums = String(range ?? "").match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return false;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (want === "5") return hi >= 5;
  const n = Number(want);
  return Number.isFinite(n) && lo <= n && n <= hi;
}

// The unified /projects listing (Part D): a published Development appears here
// UNLESS it supersedes a legacy Project that's still PUBLISHED — once that legacy
// project is deactivated (ARCHIVED) via the admin toggle, the Development takes its
// place automatically, findable through the same search/filters as legacy projects.
// Shaped to match prisma.project's raw row fields (sanityId/slug/title/keyFeatures/
// latitude/longitude/...) so the three consumers below (getFilteredProjects,
// getFilteredProjectsCount, getFilteredProjectLocationsByLang) need no special-casing
// beyond the _source tag used to build the right card link.
//
// Every derived field (price, beds, location, type) MUST come from the shared
// resolvers in @/lib/developmentCard — the same ones mapRowToVM() uses for the
// detail page. This card query previously re-derived these inline with weaker
// logic (no unit-price fallback, no min==max collapse, town-only location) and
// drifted from the detail page: a Development showed "Price on request" and
// "2-2 bed" on the card while its own detail page correctly showed a real price
// and per-unit beds. Do not reintroduce inline derivation here.
async function queryFilteredDevelopmentRows(f: ProjectFilters) {
  const { city = "", priceFrom = null, priceTo = null, propertyType = "", bedrooms = "", q = "", north = null, south = null, east = null, west = null } = f;
  const qActive = q && q.length >= 3 ? q.toLowerCase() : "";

  const devs = await prisma.development.findMany({
    where: { publishStatus: "published", supersedesProjects: { none: { status: "PUBLISHED" } } },
    include: { override: true, units: { select: { beds: true, status: true, price: true, type: true } } },
  });

  return devs
    .filter((d) => !!d.slug) // not yet SEO-slugged (see developmentSeo.ts) → not publicly linkable
    .map((d) => {
      const ov = d.override;
      const town = ov?.town || d.town || "";
      const district = ov?.district || d.district || "";
      const area = ov?.area || d.area || "";
      const gallery: string[] = (Array.isArray(ov?.gallery) && (ov!.gallery as string[]).length ? (ov!.gallery as string[]) : (Array.isArray(d.gallery) ? (d.gallery as string[]) : []));
      const previewImage = ov?.mainImage || gallery[0] || null;
      const bedRange = resolveBedRange(d.units);
      const { priceFrom: devPriceFrom, priceTo: devPriceTo } = resolveDevelopmentPrice(d.priceFrom, d.priceTo, d.units);
      return {
        sanityId: d.id, slug: d.slug as string, title: ov?.alias || d.publicName,
        excerpt: null as string | null, previewImage, images: gallery,
        keyFeatures: {
          city: resolveDevelopmentLocation(district, town, area), propertyType: resolveDevelopmentType(d.category, d.units),
          bedrooms: bedRange, completionDate: ov?.completion || d.completion || "", energyEfficiency: ov?.energy || d.energy || "",
          price: devPriceFrom, vatApplies: ov?.vatApplies ?? null,
        },
        isSold: false, videoId: null as string | null, isFeatured: false, listingPriority: 0, isNew: false,
        createdAt: d.createdAt, latitude: ov?.latitude ?? d.latitude, longitude: ov?.longitude ?? d.longitude,
        // For the scarcity banner (src/app/components/ScarcityBanner) — same unit
        // rows already loaded above, no extra query.
        unitsAvailable: d.units.filter((u) => u.status === "available").length,
        unitsTotal: d.units.length,
        // Compact-4 card footer (Beach/School/Golf/Airport) — reuses the
        // legacy renderer as-is; see toCardDistances for the shape adapter.
        distances: toCardDistances(d.distances as Record<string, number> | null),
        _matchLocations: [town, district, area].map((v) => v.toLowerCase()),
        _searchText: `${d.publicName} ${ov?.alias ?? ""}`.toLowerCase(),
        _priceFrom: devPriceFrom, _priceTo: devPriceTo,
        _source: "development" as const,
      };
    })
    .filter((d) => !city || d._matchLocations.includes(city.toLowerCase()))
    .filter((d) => !propertyType || d.keyFeatures.propertyType.toLowerCase().includes(propertyType.toLowerCase()))
    .filter((d) => !qActive || d._searchText.includes(qActive))
    .filter((d) => priceFrom == null || d._priceTo == null || d._priceTo >= priceFrom)
    .filter((d) => priceTo == null || d._priceFrom == null || d._priceFrom <= priceTo)
    .filter((d) => !bedrooms || bedroomsMatch(d.keyFeatures.bedrooms, bedrooms))
    .filter((d) => north == null || south == null || east == null || west == null || (d.latitude != null && d.longitude != null && d.latitude <= north && d.latitude >= south && d.longitude <= east && d.longitude >= west));
}

async function queryFilteredRows(lang: string, f: ProjectFilters) {
  const { city = "", priceFrom = null, priceTo = null, propertyType = "", bedrooms = "", q = "", north = null, south = null, east = null, west = null } = f;
  const qActive = q && q.length >= 3 ? q : "";
  const rows = await prisma.project.findMany({
    where: {
      language: lang as any, status: "PUBLISHED", isSold: false, sanityId: { notIn: HIDDEN_PROJECT_IDS },
      ...(city ? { city } : {}), ...(propertyType ? { propertyType } : {}),
      ...(priceFrom != null ? { price: { gte: priceFrom } } : {}),
      ...(priceTo != null ? { price: { ...(priceFrom != null ? { gte: priceFrom } : {}), lte: priceTo } } : {}),
      ...(qActive ? { OR: [{ title: { contains: qActive, mode: "insensitive" } }, { excerpt: { contains: qActive, mode: "insensitive" } }] } : {}),
      ...(north != null && south != null && east != null && west != null
        ? { latitude: { lte: north, gte: south }, longitude: { lte: east, gte: west } } : {}),
    },
  });
  const projectRows = rows
    .filter((p) => p.previewImage && (!bedrooms || bedroomsMatch(p.bedrooms, bedrooms)))
    .map((p) => ({ ...p, _source: "project" as const }));
  const devRows = await queryFilteredDevelopmentRows(f);
  return [...projectRows, ...devRows];
}

export async function getFilteredProjects(lang: string, skip: number, limit: number, filters: ProjectFilters) {
  // empty/missing sort → "recommended" (deterministic: featured → priority →
  // price-segment interleave → stable title tiebreak)
  const sort = filters.sort || "recommended";
  const rows = await queryFilteredRows(lang, filters);
  const items: ProjectListItem[] = rows.map((p) => ({
    _id: p.sanityId, _createdAt: p.createdAt?.toISOString?.(), title: p.title, excerpt: p.excerpt ?? undefined,
    slug: { current: p.slug }, previewImage: D(p.previewImage), images: Array.isArray(p.images) ? D((p.images as any[]).slice(0, 5)) : undefined,
    keyFeatures: (p.keyFeatures as any) ?? undefined, isSold: p.isSold, videoId: p.videoId ?? undefined,
    isFeatured: p.isFeatured, listingPriority: p.listingPriority, isNew: p.isNew, // manual flag (admin), default false
    _source: p._source, unitsAvailable: (p as any).unitsAvailable, unitsTotal: (p as any).unitsTotal,
    distances: (p as any).distances,
  }));
  const sorted = sort === "recommended" ? sortProjectsRecommended(items) : sortProjectsStandard(items, sort);
  return sorted.slice(skip, skip + limit);
}

export async function getFilteredProjectsCount(lang: string, filters: ProjectFilters) {
  const rows = await queryFilteredRows(lang, filters);
  return rows.length;
}

export async function getFilteredProjectLocationsByLang(lang: string, filters: ProjectFilters) {
  const rows = (await queryFilteredRows(lang, { ...filters }))
    .filter((p) => p.latitude != null && p.longitude != null)
    // Sold-out Developments get no map pin at all (Part 2a) — excluded at the
    // source so every consumer of this query is automatically covered, not
    // just the current map component. Legacy Project rows have no unit data
    // (_source !== "development") and are unaffected.
    .filter((p) => p._source !== "development" || !soldOutFromCounts((p as any).unitsAvailable ?? 0, (p as any).unitsTotal ?? 0));
  return rows.map((p) => ({
    _id: p.sanityId, title: p.title, slug: p.slug,
    location: { lat: p.latitude as number, lng: p.longitude as number },
    city: (p.keyFeatures as any)?.city, price: (p.keyFeatures as any)?.price,
    previewUrl: previewUrlOf(p), previewAlt: (p.previewImage as any)?.alt ?? p.title,
    _source: p._source,
  }));
}

function previewUrlOf(p: AnyRow): string | undefined {
  const pi = D(p.previewImage) as any;
  if (typeof pi === "string") return pi; // Development rows: previewImage is already a plain /uploads URL
  if (pi?.asset?.url) return pi.asset.url;
  const imgs = D(p.images) as any[];
  if (typeof imgs?.[0] === "string") return imgs[0];
  return imgs?.[0]?.asset?.url;
}

export async function getAllProjectsLocationsByLang(lang: string) {
  const rows = (await prisma.project.findMany({ where: { language: lang as any } })).filter((p) => p.latitude != null && p.longitude != null);
  return rows.map((p) => ({
    _id: p.sanityId, title: p.title, slug: p.slug, location: { lat: p.latitude!, lng: p.longitude! },
    city: (p.keyFeatures as any)?.city, price: (p.keyFeatures as any)?.price,
    previewUrl: previewUrlOf(p), previewAlt: (p.previewImage as any)?.alt ?? p.title,
  })) as any;
}

// Distances (minutes to beach/airport/school/… ) for a set of projects, by id.
// Used by the new /preview-projects explorer to enrich cards + map popups.
export async function getProjectDistancesByIds(ids: string[]): Promise<Record<string, any>> {
  if (!ids.length) return {};
  const rows = await prisma.project.findMany({ where: { sanityId: { in: ids } }, select: { sanityId: true, distances: true } });
  const map: Record<string, any> = {};
  for (const r of rows) if (r.distances) map[r.sanityId] = r.distances;
  return map;
}

export async function getFileBySlug(slug: string): Promise<SanityFile | null> {
  const row = await prisma.docFile.findUnique({ where: { slug } });
  if (!row) return null;
  const file = row.file as AnyRow;
  const url = file?.asset?._ref ? refToLocalUrl(file.asset._ref) : file?.asset?.url;
  return { _id: row.sanityId, title: row.title, slug: { current: row.slug }, file: { asset: { url } } } as unknown as SanityFile;
}

export async function getNotFoundPageByLang(lang: string): Promise<NotFoundPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "notFoundPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return D({
    _id: row?.sanityId, seo: d.seo, textStart: d.textStart, textEnd: d.textEnd, description: d.description,
    buttonText: d.buttonText, language: row?.language,
    _translations: await siteTranslations("notFoundPage"),
  }) as unknown as NotFoundPage;
}
