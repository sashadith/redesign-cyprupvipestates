import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { isPsiConfigured, fetchCwv, sleep } from "@/lib/psi/client";

export const dynamic = "force-dynamic";
export const maxDuration = 200;

const SITE_URL = "https://cyprusvipestates.com";
const RETENTION_MONTHS = 12;
const REQUEST_DELAY_MS = 2500; // spaces ~30 requests over ~75s — well under PSI's quota, considerate of shared free tier
const TOP_CLICKS_COUNT = 20;
const RANDOM_DEV_COUNT = 5;
const DAY = 86_400_000;

const LOCALE_HOME: Record<string, string> = { en: "/", de: "/de", pl: "/pl", ru: "/ru" };

async function buildTargetUrls(): Promise<string[]> {
  const urls = new Set<string>();

  for (const home of Object.values(LOCALE_HOME)) urls.add(home);
  urls.add("/projects");

  const since = new Date(Date.now() - 28 * DAY);
  const clickRows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since } },
    select: { page: true, clicks: true },
  });
  const clicksByPage = new Map<string, number>();
  for (const r of clickRows) clicksByPage.set(r.page, (clicksByPage.get(r.page) ?? 0) + r.clicks);
  const topPages = Array.from(clicksByPage.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_CLICKS_COUNT);
  for (const [page] of topPages) urls.add(page);

  const published = await prisma.development.findMany({ where: { publishStatus: "published", slug: { not: null } }, select: { slug: true } });
  const shuffled = [...published].sort(() => Math.random() - 0.5).slice(0, RANDOM_DEV_COUNT);
  for (const d of shuffled) if (d.slug) urls.add(`/projects/${d.slug}`);

  return Array.from(urls);
}

async function purgeOldCwv() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MONTHS * 30.44 * DAY);
    const { count } = await prisma.cwvMetric.deleteMany({ where: { date: { lt: cutoff } } });
    return { purged: count };
  } catch (e) {
    console.error("CwvMetric purge failed:", e);
    return { purged: 0, error: String(e) };
  }
}

async function runSync() {
  if (!isPsiConfigured()) {
    return { skipped: true, reason: "PSI not configured (PSI_API_KEY unset)" };
  }

  const urls = await buildTargetUrls();
  const date = new Date(new Date().toISOString().slice(0, 10));
  const results: { url: string; ok: boolean; source?: string; error?: string }[] = [];

  for (const path of urls) {
    const fullUrl = `${SITE_URL}${path}`;
    try {
      const reading = await fetchCwv(fullUrl);
      await prisma.cwvMetric.upsert({
        where: { date_url: { date, url: path } },
        create: { date, url: path, ...reading },
        update: { lcp: reading.lcp, cls: reading.cls, inp: reading.inp, perfScore: reading.perfScore, source: reading.source },
      });
      results.push({ url: path, ok: true, source: reading.source });
    } catch (e) {
      results.push({ url: path, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const purge = await purgeOldCwv();
  const okCount = results.filter((r) => r.ok).length;
  return { skipped: false, total: urls.length, ok: okCount, failed: urls.length - okCount, results, purge };
}

// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/psi-sync?key=$CRON_SECRET"
// Expected schedule: daily 02:00 UTC, before the GSC sync window (05:30).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog(
      "psi-sync",
      runSync,
      (r) => (r.skipped ? `skipped: ${r.reason}` : `${r.ok}/${r.total} URLs synced, purged ${r.purge?.purged ?? 0}`),
    );
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
