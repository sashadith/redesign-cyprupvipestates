// Nightly IndexNow sweep. Admin saves and scheduled publishing already ping
// IndexNow themselves (src/app/admin/actions.ts, publish-scheduled), but any
// content changed OUTSIDE those paths — scripts, direct DB edits, bulk fixes —
// never told the search engines. This job closes that gap: every night it
// finds PUBLISHED blog posts and landing pages whose updatedAt moved since the
// last SUCCESSFUL sweep and submits their public URLs.
//
// - "since" is the ranAt of the last ok run (minus a 10-minute overlap), so a
//   failed night is retried automatically the next night; first run looks back
//   26 hours. The window only advances when the submission succeeded.
// - URLs are checked with a HEAD request first: anything that does not answer
//   200 (a page that redirects, a retired slug) is skipped, IndexNow wants
//   final URLs only.
// - Pages the admin or the scheduler already pinged will be sent once more at
//   night. IndexNow tolerates repeats; skipping them would need per-row state.
//
// Schedule (VPS crontab, after plus-sync 02:30 and before the 04:xx jobs):
//   45 3 * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3000/api/cron/indexnow-sweep
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { submitIndexNow, absUrl } from "@/lib/indexnow";
import { localizedHref } from "@/lib/locale";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB = "indexnow-sweep";
const FIRST_RUN_LOOKBACK_MS = 26 * 3_600_000;
const OVERLAP_MS = 10 * 60_000;
const MAX_URLS = 2000;
const HEAD_CONCURRENCY = 8;
const HEAD_TIMEOUT_MS = 8000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function returns200(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function run() {
  const lastOk = await prisma.cronRunLog.findFirst({ where: { job: JOB, ok: true }, orderBy: { ranAt: "desc" }, select: { ranAt: true } });
  const since = new Date((lastOk ? lastOk.ranAt.getTime() - OVERLAP_MS : Date.now() - FIRST_RUN_LOOKBACK_MS));

  const where = { status: "PUBLISHED" as const, updatedAt: { gte: since } };
  const [blogs, pages] = await Promise.all([
    prisma.blog.findMany({ where, select: { language: true, slug: true } }),
    prisma.singlepage.findMany({ where, select: { language: true, slug: true } }),
  ]);
  const candidates = [
    ...blogs.map((b) => absUrl(localizedHref(b.language, ["blog", b.slug]))),
    ...pages.map((p) => absUrl(localizedHref(p.language, [p.slug]))),
  ];
  const unique = [...new Set(candidates)].slice(0, MAX_URLS);

  const live: string[] = [];
  for (let i = 0; i < unique.length; i += HEAD_CONCURRENCY) {
    const batch = unique.slice(i, i + HEAD_CONCURRENCY);
    const results = await Promise.all(batch.map(returns200));
    batch.forEach((u, k) => { if (results[k]) live.push(u); });
  }

  const sent = await submitIndexNow(live);
  return {
    since: since.toISOString(),
    changed: candidates.length,
    checked: unique.length,
    skippedNot200: unique.length - live.length,
    submitted: sent.submitted,
    ok: sent.ok,
    error: sent.error,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await withCronLog(
      JOB,
      run,
      (r) => (r.ok ? `${r.submitted} URL(s) submitted (${r.changed} changed since ${r.since}, ${r.skippedNot200} skipped: not 200)` : `FAILED after ${r.submitted} URL(s): ${r.error}`),
      (r) => r.ok,
    );
    return NextResponse.json({ ok: result.ok, ...result }, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak(JOB)) {
      const msg = buildCronFailureMessage(JOB, message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified(JOB);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
