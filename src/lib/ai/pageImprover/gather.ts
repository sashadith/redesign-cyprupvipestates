import { prisma } from "@/lib/prisma";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import type { PageVerdict, ClassVerdict } from "@/lib/seo/pagePower/types";
import { REMEASURE_WINDOW_DAYS } from "@/lib/seo/titleSweepRemeasure";
import { pagesInSuppressionWindow } from "@/lib/seo/titleSweepLog";
import { templateClassOf } from "@/lib/seo/templateClass";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { getInventory, type InventoryPage } from "@/lib/seo/pagePower/inventory";
import { resolveTarget, readTargetSeo, isSeoTable } from "./target";
import { IMPROVER_WINDOW_DAYS, MAX_QUERIES, type CurrentSeo } from "./types";

const SITE_URL = "https://cyprusvipestates.com";
const DAY = 86_400_000;

export type QueryRow = { query: string; impressions: number; clicks: number; position: number };
export type PageText = {
  title: string;
  headings: string[];
  bodyText: string;
  internalLinks: string[];
};
export type SiblingPattern = { path: string; metaTitle: string; metaDescription: string };

export type ImprovementInput = {
  page: InventoryPage;
  verdict: PageVerdict | null;
  /** The verdict of this page's template class — for a blog page, "repelling"
   *  and its evidence steer sections toward routing readers onward, which no
   *  page-level number would say. */
  classVerdict: ClassVerdict | null;
  queries: QueryRow[];
  pageText: PageText;
  currentSeo: CurrentSeo | null;
  siblings: SiblingPattern[];
  /** True when the page sits in a live re-measurement window — generation must
   *  REFUSE, not warn (spec rule; three other surfaces already enforce this and
   *  the improver must not become the fourth to forget). */
  suppressed: boolean;
};

// Every historical URL whose GSC history belongs to this page, resolved through
// the SAME redirect map Page Power's own totals go through (urlCanonical.ts)
// instead of by guessing at prefix shapes. GSC keeps every URL variant it has
// ever seen as its own series, so matching one URL exactly loses most of the
// baseline: the title-sweep re-measurement made that mistake and reported 234
// of 2,698 impressions for the biggest page in its batch. Measured here
// 2026-08-24 over the 90-day window, /de/blog/wo-leben-die-meisten-deutschen-
// auf-zypern draws 497 queries and 1,734 impressions at its current URL and
// 914 queries and 3,871 impressions across both of them.
//
// Deriving the second variant by STRIPPING the locale prefix — the obvious
// shape, and the one this function had when the plan was written — is wrong in
// the other direction, and wrong quietly. Only two migrations ever happened
// (redirect-mapping.csv: 358 EN-strip rows, 74 DE-to-/de); Polish and Russian
// never moved at all, and German pages created after the flip never lived at a
// bare URL either. For all of those the bare path is not an old URL of this
// page, it is a DIFFERENT LIVE PAGE — English ever since the flip. Measured
// 2026-08-24, the strip pooled another page's data into 84 de/pl/ru pages
// worth 7,757 impressions: the Russian homepage would have been handed the
// English homepage's 833 impressions on top of its own 357, and
// /ru/developers/agg-luxury-homes would have gone to the model as 12 of its
// own impressions and 611 borrowed, every borrowed query in the wrong
// language. The map also earns 358 impressions across 55 archived legacy
// project URLs that no prefix rule would ever have found.
//
// The two pattern-only redirects urlCanonical.ts handles (preview-project/*,
// properties/*) are not inverted here: measured 2026-08-24 they carry 1
// impression and 0 rows respectively in the window, which is not worth
// enumerating an unbounded pattern's preimage for.
export async function urlVariants(locale: string, path: string): Promise<string[]> {
  const map = await buildCanonicalMap();
  const variants = new Set<string>([path]);
  // Safe for English in a way the prefix strip is not for the others: /en/* is
  // a dead prefix serving nothing of its own, and all 358 EN rows in the CSV
  // target exactly the bare strip. Kept alongside the map because the map's
  // CSV half is a one-time migration snapshot — 2 of the 230 /en URLs still
  // drawing impressions are missing from it.
  if (locale === "en") variants.add(path === "/" ? "/en" : `/en${path}`);
  for (const from of Array.from(map.keys())) {
    if (canonicalize(map, localeOfPath(from), from).page === path) variants.add(from);
  }
  return Array.from(variants);
}

async function fetchQueries(locale: string, path: string): Promise<QueryRow[]> {
  const since = new Date(Date.now() - IMPROVER_WINDOW_DAYS * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: { not: null }, date: { gte: since }, page: { in: await urlVariants(locale, path) } },
    select: { query: true, impressions: true, clicks: true, position: true },
  });
  const byQuery = new Map<string, { impressions: number; clicks: number; posWeighted: number }>();
  for (const r of rows) {
    const q = r.query as string;
    const a = byQuery.get(q) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a.posWeighted += r.position * r.impressions;
    byQuery.set(q, a);
  }
  return Array.from(byQuery.entries())
    .map(([query, a]) => ({ query, impressions: a.impressions, clicks: a.clicks, position: a.impressions ? a.posWeighted / a.impressions : 0 }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_QUERIES);
}

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// The page as SERVED, not as stored: fetching the live URL is uniform across
// all six kinds and sees exactly what Google sees, portable-text quirks and
// rendering bugs included. The cost is one GET per generation, which is
// nothing next to the model call it feeds.
export async function fetchPageText(path: string): Promise<PageText> {
  const res = await fetch(`${SITE_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Live page fetch failed: ${res.status} for ${path}`);
  const html = await res.text();
  const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const headings = Array.from(html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((m) => strip(m[2]))
    .filter(Boolean)
    .slice(0, 40);
  const internalLinks = Array.from(new Set(
    Array.from(html.matchAll(/href="(\/[^"#?]*)"/g))
      .map((m) => m[1])
      .filter((h) => !h.startsWith("/_next") && !h.startsWith("/uploads") && !h.startsWith("/api")),
  )).slice(0, 80);
  const bodySource = html.split(/<\/head>/i)[1] ?? html;
  const bodyText = strip(bodySource).slice(0, 6000);
  return { title, headings, bodyText, internalLinks };
}

export async function gatherImprovementInput(pageKey: string): Promise<ImprovementInput> {
  // One inventory for the whole call, threaded into every resolveTarget below.
  // This function resolves up to five keys (the page plus four healthy
  // siblings) and resolveTarget loads the inventory per call otherwise —
  // getInventory() reads six tables for 1,696 pages, 1,965 ms cold and ~250 ms
  // warm. Measured against production 2026-08-24 in this function's exact call
  // shape (one resolve, then four in parallel), four repetitions on a warm
  // pool: 775 ms average un-memoised against 246 ms memoised. Half a second
  // and ~6,800 redundant rows off every Improve click for one extra parameter.
  // Loaded alongside the verdicts rather than before them because neither needs
  // the other, and the unknown-key throw below is an admin-typo path, not a hot
  // one worth serialising for.
  const [inventory, { verdicts }, classes, suppressedPaths] = await Promise.all([
    getInventory(),
    getPageVerdicts(),
    getClassVerdicts(),
    pagesInSuppressionWindow(REMEASURE_WINDOW_DAYS),
  ]);
  const page = await resolveTarget(pageKey, inventory);
  if (!page) throw new Error(`Unknown page: ${pageKey}`);
  const verdict = verdicts.find((v) => v.key === pageKey) ?? null;

  // Healthy siblings of the same template class, as working patterns FROM THIS
  // SITE — labelled that way in the prompt, not as targets to copy: the
  // healthy pool is 39 pages and a thin pool can encode a habit as a pattern.
  const cls = templateClassOf(page.path);
  const healthySiblings = verdicts
    .filter((v) => v.diagnosis === "healthy" && v.key !== pageKey && templateClassOf(v.path) === cls)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 4);
  const siblingSeo = await Promise.all(healthySiblings.map(async (s) => {
    const t = await resolveTarget(s.key, inventory);
    if (!t?.source || !isSeoTable(t.source.table)) return null;
    const seo = await readTargetSeo(t.source.table, t.source.id);
    if (!seo || (!seo.metaTitle && !seo.metaDescription)) return null;
    return { path: s.path, metaTitle: seo.metaTitle, metaDescription: seo.metaDescription };
  }));
  const siblings = siblingSeo.filter((s): s is SiblingPattern => s !== null).slice(0, 2);

  const [queries, pageText, currentSeo] = await Promise.all([
    fetchQueries(String(page.locale), page.path),
    fetchPageText(page.path),
    page.source && isSeoTable(page.source.table) ? readTargetSeo(page.source.table, page.source.id) : Promise.resolve(null),
  ]);

  const classVerdict = classes.find((c) => c.templateClass === cls) ?? null;
  return { page, verdict, classVerdict, queries, pageText, currentSeo, siblings, suppressed: suppressedPaths.has(page.path) };
}
