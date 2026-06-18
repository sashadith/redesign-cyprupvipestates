// Phase 3 — data layer rewritten to read from Postgres via Prisma (was Sanity/GROQ).
// Public function names, signatures, and RETURN SHAPES are preserved so page components
// and types need no changes. Rich JSON fields were migrated faithfully (Sanity shape);
// asset refs are dereferenced on read via dereferenceAssets(), and relations are resolved
// with targeted Prisma joins. See DECISIONS.md (Decisions 1, 2, 6, 7).
import { prisma } from "@/lib/prisma";
import { dereferenceAssets, refToLocalUrl } from "@/lib/sanityRefs";
import { Homepage } from "@/types/homepage";
import { Header } from "@/types/header";
import { FormStandardDocument } from "@/types/formStandardDocument";
import { Singlepage } from "@/types/singlepage";
import { Property } from "@/types/property";
import { SanityFile } from "@/types/sanityFile";
import { PropertiesPage } from "@/types/propertiesPage";
import { Project } from "@/types/project";
import { ProjectsPage } from "@/types/projectsPage";
import { Developer } from "@/types/developer";
import { Blog } from "@/types/blog";
import { BlogPage } from "@/types/blogPage";
import { NotFoundPage } from "@/types/notFoundPage";
import { CaseStudy } from "@/types/caseStudy";
import { CaseStudiesPage } from "@/types/caseStudiesPage";

type AnyRow = Record<string, any>;
const D = <T>(v: T): T => dereferenceAssets(v);

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
): Promise<{ slug: any }[]> {
  if (!groupId) return [];
  const siblings = await model.findMany({
    where: { translationGroupId: groupId },
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

// Resolve project refs inside a block to the card projection.
async function resolveProjectRefs(refs: any[], lang: string) {
  const ids = (refs || []).map((r) => r?._ref).filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.project.findMany({ where: { sanityId: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.sanityId, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((p) => projectCardString(p as AnyRow));
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

export async function getHomePageByLang(lang: string): Promise<Homepage> {
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
      publishedAt: c.publishedAt, _updatedAt: c.updatedAt,
    }));
  }

  const out: AnyRow = {
    ...base(row, "homepage"),
    ...d,
    featuredProjectsBlock: fpb,
    featuredCaseStudiesBlock: fcb,
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

export async function getSinglePageByLang(lang: string, slug: string): Promise<Singlepage | null> {
  const row = await prisma.singlepage.findFirst({ where: { language: lang as any, slug, status: "PUBLISHED" } });
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
export const getPropertySlugs = (lang: string) => slugList(prisma.property, true)(lang);

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
export async function getBlogPostByLang(lang: string, slug: string): Promise<Blog> {
  const row = await prisma.blog.findFirst({
    where: { language: lang as any, slug, status: "PUBLISHED" },
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
      _id: b.sanityId, title: b.title,
      category: b.category ? { _id: b.category.sanityId, _type: "category", title: b.category.title, slug: slugObj(b.category), language: b.category.language } : null,
      slug: slugObj(b), publishedAt: b.publishedAt, previewImage: D(b.previewImage),
    }));
    pages.forEach((p) => m.set(p.sanityId, { _id: p.sanityId, title: p.title, slug: slugObj(p), previewImage: D(p.previewImage) }));
    related = relRefs.map((id) => m.get(id)).filter(Boolean);
  }

  const out: AnyRow = {
    ...base(row, "blog"),
    title: row.title, slug: slugObj(row), seo: row.seo, publishedAt: row.publishedAt,
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
    publishedAt: b.publishedAt, language: b.language,
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
    publishedAt: b.publishedAt, language: b.language,
    _translations: await translationsFor(prisma.blog as any, b.translationGroupId),
  }))) as unknown as Blog[];
}

export async function getTotalBlogPostsByLang(lang: string): Promise<number> {
  return prisma.blog.count({ where: { language: lang as any } });
}

// === Case Study ===
export async function getCaseStudyByLang(lang: string, slug: string): Promise<CaseStudy | null> {
  const row = await prisma.caseStudy.findFirst({ where: { language: lang as any, slug, status: "PUBLISHED" } });
  if (!row) return null;
  const related = await prisma.caseStudyProject.findMany({ where: { caseStudyId: row.id }, include: { project: true } });
  const out: AnyRow = {
    ...base(row, "caseStudy"),
    title: row.title, slug: slugObj(row), seo: row.seo, category: row.category, fullTitle: row.fullTitle,
    excerpt: row.excerpt, clientOverview: row.clientOverview, previewImage: D(row.previewImage),
    caseDetails: D(row.caseDetails), mainContent: await resolveBlocks(row.mainContent as any[], lang),
    relatedProjects: related.map(({ project: p }) => ({
      _id: p.sanityId, title: p.title, excerpt: p.excerpt, slug: p.slug,
      previewImage: D(p.previewImage), keyFeatures: p.keyFeatures, isSold: p.isSold,
    })),
    publishedAt: row.publishedAt, language: row.language,
    _translations: await translationsFor(prisma.caseStudy as any, row.translationGroupId),
  };
  return D(out) as unknown as CaseStudy;
}

export async function getCaseStudiesByLang(lang: string): Promise<CaseStudy[]> {
  const rows = await prisma.caseStudy.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" } });
  return Promise.all(rows.map(async (c) => D({
    ...base(c, "caseStudy"), title: c.title, slug: slugObj(c), seo: c.seo, category: c.category,
    excerpt: c.excerpt, clientOverview: c.clientOverview, previewImage: D(c.previewImage),
    publishedAt: c.publishedAt, language: c.language,
    _translations: await translationsFor(prisma.caseStudy as any, c.translationGroupId),
  }))) as unknown as CaseStudy[];
}

export async function getCaseStudiesByLangWithPagination(lang: string, limit: number, offset: number): Promise<CaseStudy[]> {
  const rows = await prisma.caseStudy.findMany({ where: { language: lang as any, slug: { not: "" }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, skip: offset, take: limit });
  return Promise.all(rows.map(async (c) => D({
    _id: c.sanityId, _type: "caseStudy", title: c.title, excerpt: c.excerpt, slug: slugObj(c),
    previewImage: D(c.previewImage), category: c.category, clientOverview: c.clientOverview,
    publishedAt: c.publishedAt, _updatedAt: c.updatedAt, language: c.language,
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

export async function getPropertyByLang(lang: string, slug: string): Promise<Property | null> {
  const row = await prisma.property.findFirst({ where: { language: lang as any, slug, status: "PUBLISHED" } });
  if (!row) return null;
  const out: AnyRow = {
    ...base(row, "property"),
    seo: row.seo, slug: slugObj(row), title: row.title, excerpt: row.excerpt, previewImage: D(row.previewImage),
    price: row.price, videoId: row.videoId, videoPreview: D(row.videoPreview), images: D(row.images),
    address: row.address, city: row.city, district: row.district, description: D(row.description),
    type: row.type, purpose: row.purpose, propertyType: row.propertyType,
    location: row.latitude != null ? { _type: "geopoint", lat: row.latitude, lng: row.longitude } : null,
    floorSize: row.floorSize, rooms: row.rooms, hasParking: row.hasParking, hasPool: row.hasPool,
    distances: row.distances, marketType: row.marketType, isActual: row.isActual, language: row.language,
    _translations: await translationsFor(prisma.property as any, row.translationGroupId),
  };
  return D(out) as unknown as Property;
}

export async function getProjectsPageByLang(lang: string): Promise<ProjectsPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "projectsPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return {
    _id: row?.sanityId, seo: d.seo, title: d.title, language: row?.language,
    _translations: await siteTranslations("projectsPage"),
  } as unknown as ProjectsPage;
}

export async function getProjectByLang(lang: string, slug: string): Promise<Project | null> {
  const row = await prisma.project.findFirst({
    where: { language: lang as any, slug, status: "PUBLISHED" },
    include: { developer: { select: { sanityId: true } } },
  });
  if (!row) return null;
  const out: AnyRow = {
    ...base(row, "project"),
    seo: row.seo, slug: slugObj(row), title: row.title, excerpt: row.excerpt,
    previewImage: await withBlur(D(row.previewImage)), videoId: row.videoId, videoPreview: D(row.videoPreview),
    images: D(row.images), description: D(row.description),
    location: row.latitude != null ? { _type: "geopoint", lat: row.latitude, lng: row.longitude } : null,
    developer: ref(row.developer?.sanityId), keyFeatures: row.keyFeatures, investmentData: row.investmentData,
    distances: row.distances, fullDescription: D(row.fullDescription), faq: D(row.faq),
    isSold: row.isSold, language: row.language,
    _translations: await translationsFor(prisma.project as any, row.translationGroupId),
  };
  return D(out) as unknown as Project;
}

export async function getAllDevelopersByLang(lang: string): Promise<Developer[]> {
  const rows = await prisma.developer.findMany({ where: { language: lang as any, slug: { not: "" } }, orderBy: { createdAt: "desc" } });
  return rows.map((d) => ({ _id: d.sanityId, _updatedAt: d.updatedAt, title: d.title, slug: slugObj(d) })) as unknown as Developer[];
}

export async function getDeveloperByLang(lang: string, slug: string): Promise<Developer | null> {
  const row = await prisma.developer.findFirst({ where: { language: lang as any, slug } });
  if (!row) return null;
  const out: AnyRow = {
    _id: row.sanityId, seo: row.seo, slug: slugObj(row), title: row.title, titleFull: row.titleFull,
    excerpt: row.excerpt, logo: D(row.logo), description: D(row.description), language: row.language,
    _translations: await translationsFor(prisma.developer as any, row.translationGroupId),
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
  keyFeatures?: { price?: number; city?: string; propertyType?: string; bedrooms?: string; coveredArea?: string; plotSize?: string; completionDate?: string };
  isSold?: boolean; videoId?: string; isNew?: boolean; isFeatured?: boolean; listingPriority?: number; _createdAt?: string;
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
function sortProjectsRecommended(ps: ProjectListItem[]) { return [...interleaveByPriceSegments(ps.filter((p) => p.isFeatured)), ...interleaveByPriceSegments(ps.filter((p) => !p.isFeatured))]; }
function sortProjectsStandard(ps: ProjectListItem[], sort: string) {
  const items = [...ps];
  switch (sort) {
    case "priceAsc": return items.sort((a, b) => getNumericPrice(a) - getNumericPrice(b));
    case "priceDesc": return items.sort((a, b) => getNumericPrice(b) - getNumericPrice(a));
    case "titleAsc": return items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "titleDesc": return items.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    case "completionSoon": return items.sort((a, b) => { const x = getCompletionTimestamp(a); const y = getCompletionTimestamp(b); if (x !== null && y !== null) return x - y; if (x !== null) return -1; if (y !== null) return 1; return (a.title || "").localeCompare(b.title || ""); });
    default: return items.sort((a, b) => { const x = a._createdAt ? new Date(a._createdAt).getTime() : 0; const y = b._createdAt ? new Date(b._createdAt).getTime() : 0; return y - x; });
  }
}

type ProjectFilters = { city?: string; priceFrom?: number | null; priceTo?: number | null; propertyType?: string; q?: string; sort?: string; north?: number | null; south?: number | null; east?: number | null; west?: number | null };

async function queryFilteredRows(lang: string, f: ProjectFilters) {
  const { city = "", priceFrom = null, priceTo = null, propertyType = "", q = "", north = null, south = null, east = null, west = null } = f;
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
  return rows.filter((p) => p.previewImage);
}

export async function getFilteredProjects(lang: string, skip: number, limit: number, filters: ProjectFilters) {
  const sort = filters.sort ?? "recommended";
  const rows = await queryFilteredRows(lang, filters);
  // isNew = within latest 20 by createdAt
  const latest = await prisma.project.findMany({ where: { language: lang as any }, orderBy: { createdAt: "desc" }, take: 20, select: { sanityId: true } });
  const newIds = new Set(latest.map((r) => r.sanityId));
  const items: ProjectListItem[] = rows.map((p) => ({
    _id: p.sanityId, _createdAt: p.createdAt?.toISOString?.(), title: p.title, excerpt: p.excerpt ?? undefined,
    slug: { current: p.slug }, previewImage: D(p.previewImage), images: Array.isArray(p.images) ? D((p.images as any[]).slice(0, 5)) : undefined,
    keyFeatures: (p.keyFeatures as any) ?? undefined, isSold: p.isSold, videoId: p.videoId ?? undefined,
    isFeatured: p.isFeatured, listingPriority: p.listingPriority, isNew: newIds.has(p.sanityId),
  }));
  const sorted = sort === "recommended" ? sortProjectsRecommended(items) : sortProjectsStandard(items, sort);
  return sorted.slice(skip, skip + limit);
}

export async function getFilteredProjectsCount(lang: string, filters: ProjectFilters) {
  const rows = await queryFilteredRows(lang, filters);
  return rows.length;
}

export async function getFilteredProjectLocationsByLang(lang: string, filters: ProjectFilters) {
  const rows = (await queryFilteredRows(lang, { ...filters })).filter((p) => p.latitude != null && p.longitude != null);
  return rows.map((p) => ({
    _id: p.sanityId, title: p.title, slug: p.slug,
    location: { lat: p.latitude as number, lng: p.longitude as number },
    city: (p.keyFeatures as any)?.city, price: (p.keyFeatures as any)?.price,
    previewUrl: previewUrlOf(p), previewAlt: (p.previewImage as any)?.alt ?? p.title,
  }));
}

function previewUrlOf(p: AnyRow): string | undefined {
  const pi = D(p.previewImage) as any;
  if (pi?.asset?.url) return pi.asset.url;
  const imgs = D(p.images) as any[];
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

export async function getAllProperties(lang: string): Promise<any[]> {
  const rows = await prisma.property.findMany({ where: { language: lang as any, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  return rows.map((p) => D({ _id: p.sanityId, title: p.title, price: p.price, city: p.city, images: D(p.images), slug: slugObj(p) }));
}

export async function getFileBySlug(slug: string): Promise<SanityFile | null> {
  const row = await prisma.docFile.findUnique({ where: { slug } });
  if (!row) return null;
  const file = row.file as AnyRow;
  const url = file?.asset?._ref ? refToLocalUrl(file.asset._ref) : file?.asset?.url;
  return { _id: row.sanityId, title: row.title, slug: { current: row.slug }, file: { asset: { url } } } as unknown as SanityFile;
}

export async function getPropertiesPageByLang(lang: string): Promise<PropertiesPage> {
  const row = await prisma.siteDocument.findUnique({ where: { type_language: { type: "propertiesPage", language: lang as any } } });
  const d = (row?.data as AnyRow) ?? {};
  return {
    _id: row?.sanityId, metaTitle: d.metaTitle, metaDescription: d.metaDescription, title: d.title, language: row?.language,
    _translations: await siteTranslations("propertiesPage"),
  } as unknown as PropertiesPage;
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
