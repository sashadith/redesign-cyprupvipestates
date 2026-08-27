// Payload builders for the public blog API (/api/public/v1/posts).
//
// The site's own render path (sanity.utils.ts → getBlogPostByLang) resolves
// project listings, related articles and form documents — none of which a
// foreign portal can use. This module goes to Prisma directly and produces a
// self-contained, HTML-first document instead:
//
//   • article body   → semantic HTML (portableTextHtml.ts)
//   • images         → absolute https://cyprusvipestates.com/uploads/… URLs
//   • projectsSectionBlock / formMinimalBlock → empty placeholder <div>s the
//     consumer replaces with ITS OWN projects / lead form (our project data is
//     deliberately not exported), plus a machine-readable `embeds` descriptor
//   • canonicalUrl   → always points back here, so republished copies don't
//     compete with the original in search
import "server-only";
import { prisma } from "@/lib/prisma";
import { loadBlurMap } from "@/lib/blur";
import { localizedHref, LOCALES } from "@/lib/locale";
import { abs } from "@/lib/seo";
import {
  ApiImage,
  Heading,
  SerializeContext,
  createContext,
  escapeHtml,
  estimateReadingTime,
  portableTextToHtml,
  portableTextToPlainText,
  resolveImage,
} from "./portableTextHtml";

export const EXPORTED_LOCALES = LOCALES;

export type ProjectsEmbed = {
  id: string;
  kind: "projects";
  title: string | null;
  /** Where the criteria came from: the block's own filters, or inferred from
   *  the (unexported) hand-picked projects, or nothing at all. */
  criteriaSource: "filters" | "inferred" | "none";
  criteria: {
    city: string | null;
    propertyType: string | null;
    priceMin: number | null;
    priceMax: number | null;
    limit: number | null;
  };
};

export type LeadFormEmbed = {
  id: string;
  kind: "lead-form";
  title: string | null;
  buttonText: string | null;
};

export type Embed = ProjectsEmbed | LeadFormEmbed;

export type FaqEntry = { question: string; answerHtml: string; answerText: string };

export type PostSummary = {
  id: string;
  slug: string;
  lang: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  readingTime: number | null;
  canonicalUrl: string;
  category: { title: string; slug: string } | null;
  author: { name: string; position: string | null; image: ApiImage | null } | null;
  previewImage: ApiImage | null;
  seo: { metaTitle: string | null; metaDescription: string | null };
  translations: Record<string, { slug: string; canonicalUrl: string }>;
};

export type PostDetail = PostSummary & {
  html: string;
  headings: Heading[];
  images: ApiImage[];
  embeds: Embed[];
  faq: FaqEntry[];
  video: { provider: "youtube"; videoId: string; posterImage: ApiImage | null } | null;
  authorBio: string | null;
  /** Block types we did not know how to render — empty in normal operation.
   *  A non-empty array means the CMS grew a block type this API needs teaching. */
  unsupportedBlockTypes: string[];
};

const BLOG_SELECT = {
  id: true,
  slug: true,
  language: true,
  title: true,
  excerpt: true,
  previewImage: true,
  seo: true,
  readingTime: true,
  publishedAt: true,
  updatedAt: true,
  translationGroupId: true,
  author: { select: { name: true, position: true, bio: true, image: true } },
  category: { select: { title: true, slug: true } },
} as const;

const DETAIL_SELECT = { ...BLOG_SELECT, contentBlocks: true, videoBlock: true } as const;

function canonicalFor(lang: string, slug: string): string {
  return abs(localizedHref(lang, ["blog", slug]));
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

/** Sibling-language versions of one article, keyed by locale. */
async function translationsFor(
  translationGroupId: string | null,
  selfLang: string,
): Promise<Record<string, { slug: string; canonicalUrl: string }>> {
  if (!translationGroupId) return {};
  const siblings = await prisma.blog.findMany({
    where: { translationGroupId, status: "PUBLISHED", language: { not: selfLang as any } },
    select: { language: true, slug: true },
  });
  const out: Record<string, { slug: string; canonicalUrl: string }> = {};
  for (const s of siblings) {
    out[s.language] = { slug: s.slug, canonicalUrl: canonicalFor(s.language, s.slug) };
  }
  return out;
}

export function buildSummary(
  row: any,
  translations: Record<string, { slug: string; canonicalUrl: string }>,
  readingTime: number | null,
): PostSummary {
  const seo = asRecord(row.seo);
  return {
    id: row.id,
    slug: row.slug,
    lang: row.language,
    title: row.title,
    excerpt: row.excerpt ?? null,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
    readingTime,
    canonicalUrl: canonicalFor(row.language, row.slug),
    category: row.category ? { title: row.category.title, slug: row.category.slug } : null,
    author: row.author
      ? {
          name: row.author.name,
          position: row.author.position ?? null,
          image: resolveImage(row.author.image, row.author.name),
        }
      : null,
    previewImage: resolveImage(row.previewImage, row.title),
    seo: {
      metaTitle: typeof seo.metaTitle === "string" ? seo.metaTitle : null,
      metaDescription: typeof seo.metaDescription === "string" ? seo.metaDescription : null,
    },
    translations,
  };
}

// ─── Reading time ────────────────────────────────────────────────────────────
// The `readingTime` column is only populated for articles saved since it was
// added, so most rows are null and the site computes the number at render time
// from the article body. Doing that in the list endpoint would mean pulling
// every article's contentBlocks (~38 KB each) on every sync, so results are
// memoized per article version and only uncached rows get their body fetched.
const readingTimeCache = new Map<string, number>();
const READING_TIME_CACHE_MAX = 2000;

function readingTimeKey(id: string, updatedAt: Date | string): string {
  return `${id}:${new Date(updatedAt).getTime()}`;
}

async function resolveReadingTimes(
  rows: { id: string; updatedAt: Date; readingTime: number | null }[],
): Promise<Map<string, number>> {
  const resolved = new Map<string, number>();
  const missing: string[] = [];

  for (const row of rows) {
    if (typeof row.readingTime === "number" && row.readingTime > 0) {
      resolved.set(row.id, row.readingTime);
      continue;
    }
    const cached = readingTimeCache.get(readingTimeKey(row.id, row.updatedAt));
    if (cached != null) resolved.set(row.id, cached);
    else missing.push(row.id);
  }

  if (missing.length) {
    const bodies = await prisma.blog.findMany({
      where: { id: { in: missing } },
      select: { id: true, updatedAt: true, contentBlocks: true },
    });
    if (readingTimeCache.size > READING_TIME_CACHE_MAX) readingTimeCache.clear();
    for (const body of bodies) {
      const minutes = estimateReadingTime(body.contentBlocks);
      readingTimeCache.set(readingTimeKey(body.id, body.updatedAt), minutes);
      resolved.set(body.id, minutes);
    }
  }

  return resolved;
}

// ─── Article body ────────────────────────────────────────────────────────────

type ProjectHint = { city: string | null; propertyType: string | null; price: number | null };

/**
 * Hand-picked projectsSectionBlocks carry only opaque project refs. We do not
 * export those projects, but we DO look them up to derive what kind of listing
 * the editor meant (city / property type / price range) so the consumer can run
 * the equivalent query against its own inventory. Nothing project-identifying
 * leaves the building — only aggregate criteria.
 */
async function inferCriteriaHints(contentBlocks: any[]): Promise<Map<string, ProjectHint[]>> {
  const refsByBlock = new Map<string, string[]>();
  const allRefs = new Set<string>();

  for (const block of contentBlocks) {
    if (block?._type !== "projectsSectionBlock") continue;
    const refs: string[] = [
      ...(Array.isArray(block.projects) ? block.projects : []),
      ...(Array.isArray(block.pinnedRefs) ? block.pinnedRefs : []),
    ]
      .map((p: any) => (typeof p === "string" ? p : p?._ref))
      .filter((r: any): r is string => typeof r === "string" && !!r);
    if (!refs.length) continue;
    refsByBlock.set(block._key, refs);
    refs.forEach((r) => allRefs.add(r));
  }

  if (!allRefs.size) return new Map();

  const projects = await prisma.project.findMany({
    where: { sanityId: { in: Array.from(allRefs) } },
    select: { sanityId: true, city: true, propertyType: true, price: true },
  });
  const byRef = new Map(projects.map((p) => [p.sanityId, p]));

  const out = new Map<string, ProjectHint[]>();
  refsByBlock.forEach((refs, blockKey) => {
    const hints: ProjectHint[] = [];
    for (const ref of refs) {
      const project = byRef.get(ref);
      if (!project) continue;
      hints.push({ city: project.city ?? null, propertyType: project.propertyType ?? null, price: project.price ?? null });
    }
    if (hints.length) out.set(blockKey, hints);
  });
  return out;
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (!counts.size) return null;
  const [best] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  // Only a clear majority is a useful hint — a mixed bag means "no filter".
  return best[1] >= Math.ceil(values.filter(Boolean).length / 2) ? best[0] : null;
}

function buildProjectsEmbed(block: any, id: string, hints: ProjectHint[] | undefined): ProjectsEmbed {
  const filterCity = typeof block.filterCity === "string" ? block.filterCity : null;
  const filterType = typeof block.filterPropertyType === "string" ? block.filterPropertyType : null;
  const priceMin = Number.isFinite(block.priceMin) ? Number(block.priceMin) : null;
  const priceMax = Number.isFinite(block.priceMax) ? Number(block.priceMax) : null;
  const limit = Number.isFinite(block.pageSize) ? Number(block.pageSize) : null;

  const hasFilters = !!(filterCity || filterType || priceMin != null || priceMax != null);
  if (hasFilters) {
    return {
      id,
      kind: "projects",
      title: typeof block.title === "string" && block.title.trim() ? block.title.trim() : null,
      criteriaSource: "filters",
      criteria: { city: filterCity, propertyType: filterType, priceMin, priceMax, limit },
    };
  }

  if (hints?.length) {
    const prices = hints.map((h) => h.price).filter((p): p is number => typeof p === "number" && p > 0);
    return {
      id,
      kind: "projects",
      title: typeof block.title === "string" && block.title.trim() ? block.title.trim() : null,
      criteriaSource: "inferred",
      criteria: {
        city: mostCommon(hints.map((h) => h.city)),
        propertyType: mostCommon(hints.map((h) => h.propertyType)),
        priceMin: prices.length ? Math.min(...prices) : null,
        priceMax: prices.length ? Math.max(...prices) : null,
        limit: limit ?? hints.length,
      },
    };
  }

  return {
    id,
    kind: "projects",
    title: typeof block.title === "string" && block.title.trim() ? block.title.trim() : null,
    criteriaSource: "none",
    criteria: { city: null, propertyType: null, priceMin: null, priceMax: null, limit },
  };
}

function dataAttr(name: string, value: string | number | null): string {
  if (value === null || value === "") return "";
  return ` ${name}="${escapeHtml(String(value))}"`;
}

function embedHtml(embed: Embed): string {
  if (embed.kind === "projects") {
    return (
      `<div class="cvp-embed cvp-embed--projects" data-cvp-embed="projects"` +
      dataAttr("data-cvp-embed-id", embed.id) +
      dataAttr("data-title", embed.title) +
      dataAttr("data-criteria-source", embed.criteriaSource) +
      dataAttr("data-city", embed.criteria.city) +
      dataAttr("data-property-type", embed.criteria.propertyType) +
      dataAttr("data-price-min", embed.criteria.priceMin) +
      dataAttr("data-price-max", embed.criteria.priceMax) +
      dataAttr("data-limit", embed.criteria.limit) +
      `></div>`
    );
  }
  return (
    `<div class="cvp-embed cvp-embed--lead-form" data-cvp-embed="lead-form"` +
    dataAttr("data-cvp-embed-id", embed.id) +
    dataAttr("data-title", embed.title) +
    dataAttr("data-button-text", embed.buttonText) +
    `></div>`
  );
}

function tableHtml(block: any): string {
  const columns: string[] = Array.isArray(block.columns) ? block.columns : [];
  const rows: any[] = Array.isArray(block.rows) ? block.rows : [];
  if (!columns.length && !rows.length) return "";

  const head = columns.length
    ? `<thead><tr>${columns.map((c) => `<th>${escapeHtml(String(c ?? ""))}</th>`).join("")}</tr></thead>`
    : "";
  const body = rows
    .map((row) => {
      const cells: any[] = Array.isArray(row?.cells) ? row.cells : [];
      return `<tr>${cells.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<div class="cvp-table-wrap"><table class="cvp-table">${head}<tbody>${body}</tbody></table></div>`;
}

function faqHtml(block: any, ctx: SerializeContext, collected: FaqEntry[]): string {
  const items: any[] = Array.isArray(block?.faq?.items) ? block.faq.items : [];
  if (!items.length) return "";

  const rendered = items
    .map((item) => {
      const question = String(item?.question ?? "").trim();
      if (!question) return "";
      const answerHtml = portableTextToHtml(item?.answer, ctx);
      const answerText = portableTextToPlainText(item?.answer);
      collected.push({ question, answerHtml, answerText });
      return (
        `<details class="cvp-faq__item">` +
        `<summary class="cvp-faq__question">${escapeHtml(question)}</summary>` +
        `<div class="cvp-faq__answer">${answerHtml}</div>` +
        `</details>`
      );
    })
    .filter(Boolean)
    .join("");

  return rendered ? `<section class="cvp-faq">${rendered}</section>` : "";
}

export type RenderedBody = {
  html: string;
  headings: Heading[];
  images: ApiImage[];
  embeds: Embed[];
  faq: FaqEntry[];
  unsupportedBlockTypes: string[];
};

export async function renderArticleBody(contentBlocks: unknown): Promise<RenderedBody> {
  const blocks: any[] = Array.isArray(contentBlocks) ? contentBlocks : [];
  const ctx = createContext();
  const embeds: Embed[] = [];
  const faq: FaqEntry[] = [];
  const unsupported = new Set<string>();
  const hints = await inferCriteriaHints(blocks);
  const parts: string[] = [];

  blocks.forEach((block, index) => {
    switch (block?._type) {
      case "textContent": {
        const html = portableTextToHtml(block.content, ctx);
        if (html) parts.push(html);
        break;
      }
      case "tableBlock": {
        const html = tableHtml(block);
        if (html) parts.push(html);
        break;
      }
      case "faqBlock": {
        const html = faqHtml(block, ctx, faq);
        if (html) parts.push(html);
        break;
      }
      case "projectsSectionBlock": {
        const embed = buildProjectsEmbed(block, `embed-${index}`, hints.get(block._key));
        embeds.push(embed);
        parts.push(embedHtml(embed));
        break;
      }
      case "formMinimalBlock": {
        const embed: LeadFormEmbed = {
          id: `embed-${index}`,
          kind: "lead-form",
          title: typeof block.title === "string" && block.title.trim() ? block.title.trim() : null,
          buttonText: typeof block.buttonText === "string" && block.buttonText.trim() ? block.buttonText.trim() : null,
        };
        embeds.push(embed);
        parts.push(embedHtml(embed));
        break;
      }
      case "image": {
        const img = resolveImage(block);
        if (img) {
          ctx.images.push(img);
          parts.push(
            `<figure class="cvp-figure"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}"` +
              (img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "") +
              ` loading="lazy" decoding="async"></figure>`,
          );
        }
        break;
      }
      default:
        if (block?._type) unsupported.add(String(block._type));
    }
  });

  // Dedupe the image manifest by URL while keeping document order.
  const seen = new Set<string>();
  const images = ctx.images.filter((img) => (seen.has(img.url) ? false : (seen.add(img.url), true)));

  return {
    html: parts.filter(Boolean).join("\n"),
    headings: ctx.headings,
    images,
    embeds,
    faq,
    unsupportedBlockTypes: Array.from(unsupported),
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export type ListParams = {
  lang?: string;
  since?: Date;
  page: number;
  limit: number;
};

export async function listPosts(params: ListParams): Promise<{ total: number; posts: PostSummary[] }> {
  await loadBlurMap();
  const where: any = { status: "PUBLISHED" };
  if (params.lang) where.language = params.lang;
  if (params.since) where.updatedAt = { gte: params.since };

  const [total, rows] = await Promise.all([
    prisma.blog.count({ where }),
    prisma.blog.findMany({
      where,
      select: BLOG_SELECT,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
  ]);

  const readingTimes = await resolveReadingTimes(rows);
  const posts = await Promise.all(
    rows.map(async (row) =>
      buildSummary(row, await translationsFor(row.translationGroupId, row.language), readingTimes.get(row.id) ?? null),
    ),
  );
  return { total, posts };
}

export async function getPostDetail(lang: string, slug: string): Promise<PostDetail | null> {
  await loadBlurMap();
  const row = await prisma.blog.findFirst({
    where: { language: lang as any, slug, status: "PUBLISHED" },
    select: DETAIL_SELECT,
  });
  if (!row) return null;

  const body = await renderArticleBody(row.contentBlocks);
  const readingTime =
    typeof row.readingTime === "number" && row.readingTime > 0
      ? row.readingTime
      : estimateReadingTime(row.contentBlocks);
  const summary = buildSummary(row, await translationsFor(row.translationGroupId, row.language), readingTime);
  const video = asRecord(row.videoBlock);

  return {
    ...summary,
    html: body.html,
    headings: body.headings,
    images: body.images,
    embeds: body.embeds,
    faq: body.faq,
    video: video.videoId
      ? {
          provider: "youtube",
          videoId: String(video.videoId),
          posterImage: resolveImage(video.posterImage, row.title),
        }
      : null,
    authorBio: (row as any).author?.bio ?? null,
    unsupportedBlockTypes: body.unsupportedBlockTypes,
  };
}
