// Phase 2 — content migration: Sanity → Postgres (one row per language).
// Idempotent (upsert by sanityId). Run from app root:  node --env-file=.env migration/02-content.mjs
import { PrismaClient } from "@prisma/client";

const PROJECT = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET;
const TOKEN = process.env.SANITY_API_TOKEN;
const API = `https://${PROJECT}.api.sanity.io/v2021-10-21/data/query/${DATASET}`;
const LOCALES = new Set(["en", "de", "pl", "ru"]);
const prisma = new PrismaClient();

async function sq(query) {
  const res = await fetch(`${API}?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Sanity ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).result;
}

// Fetch every published doc of a type, paged.
async function fetchAll(type) {
  const PAGE = 200;
  let all = [];
  for (let s = 0; ; s += PAGE) {
    const page = await sq(
      `*[_type=="${type}" && !(_id in path("drafts.**"))] | order(_id asc) [${s}...${s + PAGE}]`
    );
    all = all.concat(page);
    if (page.length < PAGE) break;
  }
  return all;
}

const slugOf = (d) => d?.slug?.[d.language]?.current
  ?? (d?.slug && typeof d.slug === "object"
      ? Object.values(d.slug).find((v) => v?.current)?.current
      : undefined)
  ?? null;
const refId = (r) => (r && r._ref) ? r._ref : null;
const geo = (d) => ({ latitude: d?.location?.lat ?? null, longitude: d?.location?.lng ?? null });
const okLang = (d) => LOCALES.has(d.language);

// ── translation-group map: sanityDocId -> metadata._id (stable group id) ──
async function buildGroupMap() {
  const meta = await sq(`*[_type=="translation.metadata"]{_id, "refs": translations[].value._ref}`);
  const map = new Map();
  for (const m of meta) for (const r of (m.refs || [])) if (r) map.set(r, m._id);
  return map;
}

// ── reference maps: sanityId -> new row id (built after a type is migrated) ──
async function idMap(model) {
  const rows = await prisma[model].findMany({ select: { id: true, sanityId: true } });
  const m = new Map();
  for (const r of rows) m.set(r.sanityId, r.id);
  return m;
}

const stats = {};
function tally(type, r) { (stats[type] ??= { ok: 0, skip: 0, err: 0 })[r]++; }

async function main() {
  const G = await buildGroupMap();
  console.log(`translation groups: links for ${G.size} docs`);

  // 1) Independent / referenced-first types
  // AUTHOR
  for (const d of await fetchAll("author")) {
    if (!okLang(d)) { tally("author", "skip"); continue; }
    const data = {
      language: d.language, name: d.name ?? "", position: d.position ?? null,
      specialization: Array.isArray(d.specialization) ? d.specialization : [],
      bio: d.bio ?? null, image: d.image ?? null, linkedin: d.linkedin ?? null,
      translationGroupId: G.get(d._id) ?? null,
    };
    await prisma.author.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
    tally("author", "ok");
  }
  // CATEGORY
  for (const d of await fetchAll("category")) {
    if (!okLang(d)) { tally("category", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("category", "skip"); continue; }
    const data = { language: d.language, title: d.title ?? "", slug, translationGroupId: G.get(d._id) ?? null };
    await prisma.category.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
    tally("category", "ok");
  }
  // DEVELOPER
  for (const d of await fetchAll("developer")) {
    if (!okLang(d)) { tally("developer", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("developer", "skip"); continue; }
    const data = {
      language: d.language, slug, title: d.title ?? "", titleFull: d.titleFull ?? null,
      excerpt: d.excerpt ?? null, logo: d.logo ?? null, description: d.description ?? null,
      seo: d.seo ?? null, translationGroupId: G.get(d._id) ?? null,
    };
    await prisma.developer.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
    tally("developer", "ok");
  }

  const devMap = await idMap("developer");
  const authorMap = await idMap("author");
  const catMap = await idMap("category");

  // 2) PROJECT (refs developer)
  for (const d of await fetchAll("project")) {
    if (!okLang(d)) { tally("project", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("project", "skip"); continue; }
    const kf = d.keyFeatures || {};
    const data = {
      language: d.language, slug, title: d.title ?? "", excerpt: d.excerpt ?? null,
      status: "PUBLISHED",
      city: kf.city ?? null, propertyType: kf.propertyType ?? null,
      price: Number.isFinite(kf.price) ? Math.round(kf.price) : null,
      bedrooms: kf.bedrooms ?? null, completionDate: kf.completionDate ?? null,
      isFeatured: !!d.isFeatured, isSold: !!d.isSold,
      listingPriority: Number.isFinite(d.listingPriority) ? d.listingPriority : 0,
      ...geo(d),
      developerId: devMap.get(refId(d.developer)) ?? null,
      previewImage: d.previewImage ?? null, images: d.images ?? null,
      videoId: d.videoId ?? null, videoPreview: d.videoPreview ?? null,
      description: d.description ?? null, fullDescription: d.fullDescription ?? null,
      faq: d.faq ?? null, keyFeatures: d.keyFeatures ?? null, distances: d.distances ?? null,
      investmentData: d.investmentData ?? null, seo: d.seo ?? null,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      translationGroupId: G.get(d._id) ?? null,
    };
    try {
      await prisma.project.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("project", "ok");
    } catch (e) { tally("project", "err"); console.log("  project ERR", d._id, slug, e.code || e.message); }
  }

  // 3) BLOG (refs author, category)
  for (const d of await fetchAll("blog")) {
    if (!okLang(d)) { tally("blog", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("blog", "skip"); continue; }
    const data = {
      language: d.language, slug, title: d.title ?? "", excerpt: d.excerpt ?? null, status: "PUBLISHED",
      authorId: authorMap.get(refId(d.author)) ?? null,
      categoryId: catMap.get(refId(d.category)) ?? null,
      previewImage: d.previewImage ?? null, seo: d.seo ?? null,
      contentBlocks: d.contentBlocks ?? null, videoBlock: d.videoBlock ?? null,
      popularProperties: d.popularProperties ?? null, relatedArticles: d.relatedArticles ?? null,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      translationGroupId: G.get(d._id) ?? null,
    };
    try {
      await prisma.blog.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("blog", "ok");
    } catch (e) { tally("blog", "err"); console.log("  blog ERR", d._id, slug, e.code || e.message); }
  }

  // 4) SINGLEPAGE (self-ref parentPage -> store parentSanityId)
  for (const d of await fetchAll("singlepage")) {
    if (!okLang(d)) { tally("singlepage", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("singlepage", "skip"); continue; }
    const data = {
      language: d.language, slug, title: d.title ?? "", excerpt: d.excerpt ?? null, status: "PUBLISHED",
      allowIntroBlock: !!d.allowIntroBlock, parentSanityId: refId(d.parentPage),
      previewImage: d.previewImage ?? null, seo: d.seo ?? null, contentBlocks: d.contentBlocks ?? null,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      translationGroupId: G.get(d._id) ?? null,
    };
    try {
      await prisma.singlepage.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("singlepage", "ok");
    } catch (e) { tally("singlepage", "err"); console.log("  singlepage ERR", d._id, slug, e.code || e.message); }
  }

  // 5) PROPERTY
  for (const d of await fetchAll("property")) {
    if (!okLang(d)) { tally("property", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("property", "skip"); continue; }
    const data = {
      language: d.language, slug, title: d.title ?? "", excerpt: d.excerpt ?? null, status: "PUBLISHED",
      price: Number.isFinite(d.price) ? Math.round(d.price) : null,
      address: d.address ?? null, city: d.city ?? null, district: d.district ?? null,
      type: d.type ?? null, purpose: d.purpose ?? null, propertyType: d.propertyType ?? null,
      marketType: d.marketType ?? null,
      floorSize: Number.isFinite(d.floorSize) ? Math.round(d.floorSize) : null,
      rooms: Number.isFinite(d.rooms) ? Math.round(d.rooms) : null,
      hasParking: d.hasParking ?? null, hasPool: d.hasPool ?? null, isActual: d.isActual ?? true,
      ...geo(d),
      previewImage: d.previewImage ?? null, images: d.images ?? null,
      videoId: d.videoId ?? null, videoPreview: d.videoPreview ?? null,
      description: d.description ?? null, distances: d.distances ?? null, seo: d.seo ?? null,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      translationGroupId: G.get(d._id) ?? null,
    };
    try {
      await prisma.property.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("property", "ok");
    } catch (e) { tally("property", "err"); console.log("  property ERR", d._id, slug, e.code || e.message); }
  }

  // 6) CASE STUDY (refs project via relatedProjects)
  for (const d of await fetchAll("caseStudy")) {
    if (!okLang(d)) { tally("caseStudy", "skip"); continue; }
    const slug = slugOf(d); if (!slug) { tally("caseStudy", "skip"); continue; }
    const data = {
      language: d.language, slug, title: d.title ?? "", fullTitle: d.fullTitle ?? null,
      excerpt: d.excerpt ?? null, category: d.category ?? null, status: "PUBLISHED",
      previewImage: d.previewImage ?? null, seo: d.seo ?? null,
      clientOverview: d.clientOverview ?? null, caseDetails: d.caseDetails ?? null,
      mainContent: d.mainContent ?? null,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
      translationGroupId: G.get(d._id) ?? null,
    };
    try {
      await prisma.caseStudy.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("caseStudy", "ok");
    } catch (e) { tally("caseStudy", "err"); console.log("  caseStudy ERR", d._id, slug, e.code || e.message); }
  }
  // case-study ↔ project links (best-effort)
  const projMap = await idMap("project");
  const csRows = await prisma.caseStudy.findMany({ select: { id: true, sanityId: true } });
  const csIdMap = new Map(csRows.map((r) => [r.sanityId, r.id]));
  let links = 0;
  for (const d of await fetchAll("caseStudy")) {
    const csId = csIdMap.get(d._id); if (!csId) continue;
    for (const r of (d.relatedProjects || [])) {
      const pid = projMap.get(refId(r)); if (!pid) continue;
      try { await prisma.caseStudyProject.upsert({ where: { caseStudyId_projectId: { caseStudyId: csId, projectId: pid } }, update: {}, create: { caseStudyId: csId, projectId: pid } }); links++; } catch {}
    }
  }
  console.log(`caseStudy↔project links: ${links}`);

  // 7) DOC FILE (not localized)
  for (const d of await fetchAll("docFile")) {
    const slug = d?.slug?.current ?? null; if (!slug) { tally("docFile", "skip"); continue; }
    const data = { title: d.title ?? "", slug, file: d.file ?? null };
    try {
      await prisma.docFile.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
      tally("docFile", "ok");
    } catch (e) { tally("docFile", "err"); console.log("  docFile ERR", d._id, slug, e.code || e.message); }
  }

  // 8) SINGLETONS -> SiteDocument
  const SINGLETONS = ["homepage","header","footer","blogPage","projectsPage","caseStudiesPage","propertiesPage","notFoundPage","formStandardDocument"];
  for (const type of SINGLETONS) {
    for (const d of await fetchAll(type)) {
      if (!okLang(d)) { tally("site:"+type, "skip"); continue; }
      const { _id, _type, _rev, _createdAt, _updatedAt, _system, _i18nBase, language, ...rest } = d;
      const data = { type, language, data: rest };
      try {
        await prisma.siteDocument.upsert({ where: { sanityId: d._id }, update: data, create: { sanityId: d._id, ...data } });
        tally("site:"+type, "ok");
      } catch (e) { tally("site:"+type, "err"); console.log("  site ERR", type, d._id, e.code || e.message); }
    }
  }

  console.log("\n=== migration tally ===");
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(24)} ok=${v.ok} skip=${v.skip} err=${v.err}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
