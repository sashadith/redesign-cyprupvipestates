import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { isGscConfigured, fetchPageLevelMetrics, fetchQueryLevelMetrics, type PageLevelRow, type QueryLevelRow } from "@/lib/gsc/client";
import { maybeSendTitleSweepTelegram } from "@/lib/seo/titleSweepRemeasure";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GSC's own data lags ~2 days behind real time — pulling "today" or
// "yesterday" would just get zero/partial rows overwritten again tomorrow.
const LAG_DAYS = 2;
const DAILY_WINDOW_DAYS = 3; // re-upsert the last 3 available days each run
const BACKFILL_WINDOW_DAYS = 90;
const RETENTION_MONTHS = 16; // matches GSC's own retention
const UPSERT_CONCURRENCY = 20;

const DAY = 86_400_000;
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

// Prisma's compound-unique shorthand (date_page_locale_query) types `query` as
// plain `string`, not `string | null`, even though the field is nullable in
// the schema — a known Prisma limitation for nullable members of a composite
// unique index. A plain `where` filter DOES accept null, so upsert manually
// (find, then create/update) instead of the `.upsert()` shorthand.
async function upsertOne(r: PageLevelRow | QueryLevelRow) {
  const query: string | null = "query" in r ? r.query : null;
  const date = new Date(r.date);
  const data = { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
  const existing = await prisma.searchMetric.findFirst({ where: { date, page: r.page, locale: r.locale, query }, select: { id: true } });
  if (existing) await prisma.searchMetric.update({ where: { id: existing.id }, data });
  else await prisma.searchMetric.create({ data: { date, page: r.page, locale: r.locale, query, ...data } });
}

async function upsertInBatches(rows: (PageLevelRow | QueryLevelRow)[]) {
  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CONCURRENCY) {
    const chunk = rows.slice(i, i + UPSERT_CONCURRENCY);
    await Promise.all(chunk.map(upsertOne));
    count += chunk.length;
  }
  return count;
}

async function purgeOldMetrics() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MONTHS * 30.44 * DAY);
    const { count } = await prisma.searchMetric.deleteMany({ where: { date: { lt: cutoff } } });
    return { purged: count };
  } catch (e) {
    console.error("SearchMetric purge failed:", e);
    return { purged: 0, error: String(e) };
  }
}

async function runSync() {
  if (!isGscConfigured()) {
    return { skipped: true, reason: "GSC not configured (GSC_SERVICE_ACCOUNT_KEY_PATH / GSC_SITE_PROPERTY unset)" };
  }

  const existingCount = await prisma.searchMetric.count();
  const isFirstRun = existingCount === 0;
  const windowDays = isFirstRun ? BACKFILL_WINDOW_DAYS : DAILY_WINDOW_DAYS;

  const end = new Date(Date.now() - LAG_DAYS * DAY);
  const start = new Date(end.getTime() - (windowDays - 1) * DAY);
  const startDate = dateKey(start);
  const endDate = dateKey(end);

  const [pageRows, queryRows] = await Promise.all([
    fetchPageLevelMetrics(startDate, endDate),
    fetchQueryLevelMetrics(startDate, endDate),
  ]);

  const pageCount = await upsertInBatches(pageRows);
  const queryCount = await upsertInBatches(queryRows);
  const purge = await purgeOldMetrics();
  const titleSweepTelegram = await maybeSendTitleSweepTelegram().catch((e) => {
    console.error("Title-sweep Telegram check failed:", e);
    return { sent: false };
  });

  return { skipped: false, mode: isFirstRun ? "backfill" : "daily", startDate, endDate, pageRows: pageCount, queryRows: queryCount, purge, titleSweepTelegram };
}

// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/gsc-sync?key=$CRON_SECRET"
// Expected schedule: daily 05:30 UTC, after drive-sync (04:30) and feed-sync (04:00).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog(
      "gsc-sync",
      runSync,
      (r) => (r.skipped ? `skipped: ${r.reason}` : `${r.mode}: ${r.pageRows} page rows, ${r.queryRows} query rows, purged ${r.purge?.purged ?? 0}`),
    );
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
