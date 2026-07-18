import fs from "fs";
import path from "path";
import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveLocale } from "@/lib/gsc/client";

// Redirect-aware URL canonicalization for the SEO Advisor's data layer.
//
// GSC tracks every URL variant it has ever seen as its OWN "page" row, even
// once that URL 301s elsewhere. A page that's been through a locale-prefix
// migration (or a legacy-project deactivation, or the preview-project→projects
// route rename) shows up as TWO separate SearchMetric series — the old,
// still-indexed URL slowly losing clicks/impressions as Google re-crawls, and
// the new canonical URL slowly gaining them. Read naively, that split reads
// as a traffic collapse on the old URL; it's actually just index migration.
// (Found 2026-07-19: the Advisor flagged "/blog/wo-leben-die-meisten-..." as
// a -96 click collapse — it's a 301 to "/de/blog/wo-leben-die-meisten-...",
// which was gaining exactly what the old URL was losing.)
//
// This module builds a map from every known redirect-source URL to its
// canonical target, so callers can fold a page's historical data into the
// SAME bucket as its current canonical URL before computing any delta.
//
// Sources merged (see docs/SEO-GROWTH-ROADMAP-2026.md investigation,
// 2026-07-19, for the full redirect inventory this was built from):
//  1. redirect-mapping.csv — the one-time locale-migration audit (2026-07-xx):
//     358 "EN-strip" (/en/X -> /X) + 74 "DE-to-/de" (/X -> /de/X) rows. Static
//     snapshot — won't cover German-only content created after that migration.
//  2. legacy_project_redirects DB table — live, grows over time as admins
//     archive legacy Sanity projects in favor of a Development.
//  3. /properties[/...] -> /projects (any locale) — fixed pattern, middleware.
//  4. /preview-project/{slug} -> /projects/{slug} (any locale) — fixed
//     pattern, the pre-cutover (2026-07-17) indexed route shim.
// NOT covered (known gap, low value): nestedPageRedirects.json's wrong-parent
// singlepage canonicalization — rare, unlikely to carry meaningful GSC volume.

export type CanonicalTarget = { locale: Locale; page: string };

let cached: { map: Map<string, string>; builtAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function loadCsvRedirects(): Array<[string, string]> {
  const csvPath = path.join(process.cwd(), "redirect-mapping.csv");
  let text: string;
  try {
    text = fs.readFileSync(csvPath, "utf-8");
  } catch {
    return []; // missing (e.g. some local dev setups) — degrade to no CSV-sourced merges rather than crash
  }
  const pairs: Array<[string, string]> = [];
  for (const line of text.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const [oldUrl, newUrl, redirectType] = line.split(",");
    if (redirectType?.trim() !== "301") continue;
    if (!oldUrl?.trim() || !newUrl?.trim() || oldUrl === newUrl) continue;
    pairs.push([oldUrl.trim(), newUrl.trim()]);
  }
  return pairs;
}

async function loadLegacyProjectRedirects(): Promise<Array<[string, string]>> {
  const rows = await prisma.project.findMany({
    where: { status: "ARCHIVED", redirectTarget: { isNot: null } },
    select: { language: true, slug: true, redirectTarget: { select: { targetPath: true } } },
  });
  return rows
    .filter((r) => r.redirectTarget)
    .map((r) => {
      const oldPath = r.language === "en" ? `/projects/${r.slug}` : `/${r.language}/projects/${r.slug}`;
      return [oldPath, r.redirectTarget!.targetPath] as [string, string];
    });
}

function previewProjectPattern(oldPath: string): string | null {
  const m = oldPath.match(/^((?:\/(?:de|pl|ru))?)\/preview-project\/([^/?]+)$/);
  return m ? `${m[1]}/projects/${m[2]}` : null;
}

function propertiesPattern(oldPath: string): string | null {
  const m = oldPath.match(/^((?:\/(?:de|pl|ru))?)\/properties(?:\/.*)?$/);
  return m ? `${m[1]}/projects` : null;
}

async function buildRawMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const set = (oldPath: string, newPath: string) => {
    if (oldPath !== newPath) map.set(oldPath, newPath);
  };
  const [csvPairs, legacyPairs] = await Promise.all([
    Promise.resolve(loadCsvRedirects()),
    loadLegacyProjectRedirects(),
  ]);
  for (const [o, n] of csvPairs) set(o, n);
  for (const [o, n] of legacyPairs) set(o, n);
  return map;
}

export async function buildCanonicalMap(): Promise<Map<string, string>> {
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) return cached.map;
  const map = await buildRawMap();
  cached = { map, builtAt: Date.now() };
  return map;
}

// Resolves a (locale, page) pair to its canonical form — follows chained
// redirects up to 5 hops (the migration snapshot + a later legacy-project
// redirect could in principle stack) and re-derives locale from the final
// path so the two never disagree.
export function canonicalize(map: Map<string, string>, locale: Locale, page: string): CanonicalTarget {
  let curPage = page;
  for (let i = 0; i < 5; i++) {
    const next = map.get(curPage) ?? previewProjectPattern(curPage) ?? propertiesPattern(curPage);
    if (!next || next === curPage) break;
    curPage = next;
  }
  return curPage === page ? { locale, page } : { locale: deriveLocale(curPage), page: curPage };
}
