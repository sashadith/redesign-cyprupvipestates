import { readFile } from "fs/promises";
import path from "path";
import type { Locale } from "@prisma/client";

// Parses docs/SEO-TITLE-SWEEP-LOG.md — the change log written when the Part 1
// CTR title/meta sweep shipped (2026-07-18) — so the Action Center can (a)
// suppress CTR-outlier alerts for pages still inside their re-measurement
// window, and (d) auto-generate the before/after comparison once that window
// has passed. Deliberately reads the doc itself rather than duplicating its
// data in code/DB — one source of truth, and future sweep batches just need a
// new "## YYYY-MM-DD — ..." section in the same table shapes to be picked up.
const LOG_PATH = path.join(process.cwd(), "docs", "SEO-TITLE-SWEEP-LOG.md");

export type SweepEntry = {
  page: string; // path, e.g. "/de/blog/wo-leben..." or "/developers/mito-developers"
  locale: Locale;
  batchDate: Date;
  baselinePosition?: number;
  baselineCtr?: number; // 0-100
};

let cache: { mtimeMs: number; entries: SweepEntry[] } | null = null;

function parse(text: string): SweepEntry[] {
  const entries: SweepEntry[] = [];
  let batchDate: Date | null = null;
  for (const line of text.split("\n")) {
    const batchMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})/);
    if (batchMatch) {
      batchDate = new Date(`${batchMatch[1]}T00:00:00Z`);
      continue;
    }
    if (!batchDate) continue;

    // 17-row table: | # | locale | `/path` | pos | ctr% |
    const contentRow = line.match(/^\|\s*\d+\s*\|\s*(en|de|pl|ru)\s*\|\s*`([^`]+)`\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)%\s*\|/);
    if (contentRow) {
      const [, locale, page, pos, ctr] = contentRow;
      entries.push({ page, locale: locale as Locale, batchDate, baselinePosition: parseFloat(pos), baselineCtr: parseFloat(ctr) });
      continue;
    }

    // 13-row developer table: | # | `slug` | New title | Projects | City |
    const devRow = line.match(/^\|\s*\d+\s*\|\s*`([a-z0-9-]+)`\s*\|\s*[^|]+\|\s*\d+\s*\|\s*\w+/);
    if (devRow) {
      entries.push({ page: `/developers/${devRow[1]}`, locale: "en" as Locale, batchDate });
    }
  }
  return entries;
}

export async function loadSweepEntries(): Promise<SweepEntry[]> {
  try {
    const stat = await import("fs/promises").then((m) => m.stat(LOG_PATH));
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.entries;
    const text = await readFile(LOG_PATH, "utf8");
    const entries = parse(text);
    cache = { mtimeMs: stat.mtimeMs, entries };
    return entries;
  } catch (e) {
    console.error("Failed to read/parse SEO-TITLE-SWEEP-LOG.md:", e);
    return [];
  }
}

// Pages still inside their re-measurement window (batchDate + windowDays)
// should not also trigger a fresh CTR-outlier alert — they're already being
// tracked as a sweep, not a new, unaddressed problem.
export async function pagesInSuppressionWindow(windowDays: number): Promise<Set<string>> {
  const entries = await loadSweepEntries();
  const now = Date.now();
  const active = entries.filter((e) => now - e.batchDate.getTime() < windowDays * 86_400_000);
  return new Set(active.map((e) => e.page));
}
