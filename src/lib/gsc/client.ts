import { google } from "googleapis";
import type { Locale } from "@prisma/client";

// Google Search Console API client — server-to-server via a service account
// (no OAuth/user consent flow; the service account is added as a GSC user
// with Restricted permission, read-only). Two env vars gate everything here:
//   GSC_SERVICE_ACCOUNT_KEY_PATH — absolute path to the downloaded JSON key
//                                  on the VPS filesystem (never in git/env value).
//   GSC_SITE_PROPERTY            — the exact property identifier as registered
//                                  in Search Console, e.g. "sc-domain:cyprusvipestates.com"
//                                  (domain property) or "https://cyprusvipestates.com/"
//                                  (URL-prefix property). Passed straight through
//                                  to the API — no special-casing needed either way.
const SITE_URL = "https://cyprusvipestates.com";

export function isGscConfigured(): boolean {
  return !!(process.env.GSC_SERVICE_ACCOUNT_KEY_PATH && process.env.GSC_SITE_PROPERTY);
}

function requireConfig() {
  const keyFile = process.env.GSC_SERVICE_ACCOUNT_KEY_PATH;
  const siteUrl = process.env.GSC_SITE_PROPERTY;
  if (!keyFile || !siteUrl) {
    throw new Error(
      "GSC not configured — set GSC_SERVICE_ACCOUNT_KEY_PATH and GSC_SITE_PROPERTY (see docs/ setup guide).",
    );
  }
  return { keyFile, siteUrl };
}

let cachedClient: ReturnType<typeof google.searchconsole> | null = null;

async function getSearchConsoleClient() {
  if (cachedClient) return cachedClient;
  const { keyFile } = requireConfig();
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  cachedClient = google.searchconsole({ version: "v1", auth: await auth.getClient() as any });
  return cachedClient;
}

// Derives our own locale from GSC's raw page path — matches the same convention
// used throughout this codebase and the earlier manual-export analysis:
// /de/... -> de, /pl/... -> pl, /ru/... -> ru, anything else -> en (default,
// unprefixed locale).
export function deriveLocale(pagePath: string): Locale {
  if (pagePath.startsWith("/de/")) return "de" as Locale;
  if (pagePath.startsWith("/pl/")) return "pl" as Locale;
  if (pagePath.startsWith("/ru/")) return "ru" as Locale;
  return "en" as Locale;
}

// GSC returns the page dimension as a full URL — strip the site origin to get
// just the path, which is what we store/compare against everywhere else.
function pathFromGscUrl(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) || "/" : url;
  }
}

export type PageLevelRow = {
  date: string; // YYYY-MM-DD
  page: string; // path only
  locale: Locale;
  clicks: number;
  impressions: number;
  ctr: number; // 0-100
  position: number;
};

export type QueryLevelRow = PageLevelRow & { query: string };

const ROW_LIMIT = 25000;

// Paginated raw fetch — a single call covers the WHOLE date range (GSC groups
// by every requested dimension including 'date' internally), so a 90-day
// backfill is a handful of paginated calls, not 90 separate ones.
async function fetchRows(dimensions: string[], startDate: string, endDate: string) {
  const sc = await getSearchConsoleClient();
  const { siteUrl } = requireConfig();
  const rows: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] = [];
  let startRow = 0;
  for (;;) {
    const { data } = await sc.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions, rowLimit: ROW_LIMIT, startRow, type: "web" },
    });
    const batch = data.rows ?? [];
    for (const r of batch) {
      rows.push({
        keys: r.keys ?? [],
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: (r.ctr ?? 0) * 100,
        position: r.position ?? 0,
      });
    }
    if (batch.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
  }
  return rows;
}

// pathFromGscUrl() above keeps only the URL's path — GSC's raw "page"
// dimension is the full URL, so https://site/x, https://site/x?utm_source=y
// and https://site/x#section are three DISTINCT rows to GSC (each with its
// own real impressions/clicks/position) that all map to the same stored
// `page` string here. A single fetch can therefore legitimately contain
// several raw rows for what becomes one (date, page, locale[, query]) key.
//
// This merges them in memory, before any row reaches the database: sums
// impressions and clicks, recomputes position as the impression-weighted
// average, recomputes ctr from the merged totals. Confirmed in production
// (2026-08-31): 350 of 438 duplicate page-level groups found in
// search_metrics had DIVERGED values across their rows — i.e. were exactly
// this, not a write race — see scripts/cleanup-searchmetric-duplicates.mjs
// for the investigation and the one-time cleanup of what had already
// accumulated.
//
// Doing this here, not at the upsert layer, is what guarantees a single
// sync run can never hand upsertOne (gsc-sync/route.ts) two rows for the
// same key: by the time fetchPageLevelMetrics/fetchQueryLevelMetrics
// return, each key appears at most once. That guarantee is *why* the
// partial unique index on search_metrics (date, page, locale WHERE query
// IS NULL — see schema.prisma) is safe to have: without this
// pre-aggregation, that index would just turn silent duplicate rows into a
// silent last-write-wins overwrite of whichever URL variant GSC happened
// to return first in the batch, discarding the rest — worse than today,
// not better. Do not remove this step, and do not move it to run after
// the index exists instead of before every upsert.
function aggregateRows<T extends PageLevelRow | QueryLevelRow>(rows: T[]): T[] {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const key = "query" in row ? `${row.date}|${row.page}|${row.locale}|${row.query}` : `${row.date}|${row.page}|${row.locale}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, row);
      continue;
    }
    const impressions = existing.impressions + row.impressions;
    const clicks = existing.clicks + row.clicks;
    const position = impressions > 0
      ? (existing.position * existing.impressions + row.position * row.impressions) / impressions
      : row.position;
    const ctr = impressions > 0 ? (100 * clicks) / impressions : 0;
    merged.set(key, { ...existing, impressions, clicks, position, ctr });
  }
  return Array.from(merged.values());
}

// Page-level rows: dims [date, page] — GSC's own aggregate position/CTR for
// each page, which is NOT the same as summing/averaging query-level rows.
export async function fetchPageLevelMetrics(startDate: string, endDate: string): Promise<PageLevelRow[]> {
  const rows = await fetchRows(["date", "page"], startDate, endDate);
  return aggregateRows(rows.map((r) => {
    const [date, url] = r.keys;
    const page = pathFromGscUrl(url);
    return { date, page, locale: deriveLocale(page), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
  }));
}

// Query-level rows: dims [date, page, query] — finer breakdown, stored for
// future use (not consumed by any current Action Center rule or admin view).
export async function fetchQueryLevelMetrics(startDate: string, endDate: string): Promise<QueryLevelRow[]> {
  const rows = await fetchRows(["date", "page", "query"], startDate, endDate);
  return aggregateRows(rows.map((r) => {
    const [date, url, query] = r.keys;
    const page = pathFromGscUrl(url);
    return { date, page, locale: deriveLocale(page), query, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
  }));
}
