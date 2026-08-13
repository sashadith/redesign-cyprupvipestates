// Scheduled-publishing worker. A system cron on the VPS calls this every few
// minutes (secured by CRON_SECRET). It flips any SCHEDULED content whose
// scheduledAt has arrived to PUBLISHED and revalidates the affected public
// paths so it appears immediately. Runs for all four schedulable content types.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { pingIndexNow, absUrl } from "@/lib/indexnow";
import { localizedHref } from "@/lib/locale";
import { findEmptyProjectsBlock } from "@/lib/projectsBlockValidation";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Header-only auth (never a query param — those leak into access logs), with a
// constant-time comparison to avoid timing leaks.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const got = req.headers.get("authorization") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run() {
  const now = new Date();
  const where = { status: "SCHEDULED" as const, scheduledAt: { lte: now } };
  const select = { id: true, language: true, slug: true, scheduledAt: true, publishedAt: true };

  const [blogsRaw, projects, pages, caseStudies] = await Promise.all([
    // contentBlocks is only fetched here — needed to run the empty-projects-
    // block gate below, and the other three content types either don't carry
    // this block type (Project) or aren't in scope for the gate yet
    // (Singlepage/CaseStudy — see findEmptyProjectsBlock's own scope note).
    prisma.blog.findMany({ where, select: { ...select, contentBlocks: true } }),
    prisma.project.findMany({ where, select }),
    prisma.singlepage.findMany({ where, select }),
    prisma.caseStudy.findMany({ where, select }),
  ]);

  // Same gate as saveBlogAll (src/app/admin/actions.ts) — a scheduled post
  // whose projectsSectionBlock has neither a filter nor pins would otherwise
  // auto-publish silently broken. Leave it SCHEDULED (not flipped) and log
  // loudly; it's re-checked and re-logged on every future cron run until
  // someone fixes the block in the admin.
  const blogsSkipped: Array<{ id: string; language: string; slug: string; blockTitle: string }> = [];
  const blogs = blogsRaw.filter((b) => {
    const empty = findEmptyProjectsBlock(b.contentBlocks as any[]);
    if (!empty) return true;
    blogsSkipped.push({ id: b.id, language: b.language, slug: b.slug, blockTitle: empty.title });
    console.error(
      `[publish-scheduled] Held back "${b.slug}" (${b.language}, id=${b.id}): projects block "${empty.title}" has no filter and no pinned projects — would publish empty. Fix in admin, it stays SCHEDULED.`,
    );
    return false;
  });

  const published: Record<string, number> = {};

  async function flip(
    model: { update: (args: any) => Promise<unknown> },
    rows: Array<{ id: string; language: string; slug: string; scheduledAt: Date | null; publishedAt: Date | null }>,
    revalidate: (lang: string, slug: string) => void,
    key: string,
  ) {
    for (const r of rows) {
      await model.update({
        where: { id: r.id },
        data: { status: "PUBLISHED", publishedAt: r.publishedAt ?? r.scheduledAt ?? now },
      });
      revalidate(r.language, r.slug);
    }
    published[key] = rows.length;
  }

  await flip(prisma.blog, blogs, (l, s) => { revalidatePath(`/${l}/blog/${s}`); revalidatePath(`/${l}/blog`); }, "blog");
  // Fire-and-forget, one per post that just went live via schedule.
  for (const b of blogs) void pingIndexNow("blog-published-scheduled", [absUrl(localizedHref(b.language, ["blog", b.slug]))]);
  await flip(prisma.project, projects, (l, s) => { revalidatePath(`/${l}/projects/${s}`); revalidatePath(`/${l}/projects`); revalidatePath(`/${l}`); }, "project");
  await flip(prisma.singlepage, pages, (l, s) => { revalidatePath(`/${l}/${s}`); }, "singlepage");
  await flip(prisma.caseStudy, caseStudies, (l, s) => { revalidatePath(`/${l}/case-studies/${s}`); revalidatePath(`/${l}/case-studies`); }, "caseStudy");

  const total = Object.values(published).reduce((a, b) => a + b, 0);
  return { ranAt: now.toISOString(), total, published, blogsSkipped };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await withCronLog("publish-scheduled", run, (r) =>
      r.blogsSkipped.length
        ? `${r.total} item(s) published; ${r.blogsSkipped.length} blog(s) held back (empty projects block): ${r.blogsSkipped.map((s) => `${s.slug} (${s.language})`).join(", ")}`
        : `${r.total} item(s) published`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 2026-08-13 (GROSSER AUFTRAG Teil 4) — this cron runs every few minutes;
    // a crash here means scheduled content silently stops publishing on
    // time, previously with zero alerting at all.
    if (await shouldNotifyFailureStreak("publish-scheduled")) {
      const msg = buildCronFailureMessage("publish-scheduled", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("publish-scheduled");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
export const POST = GET;
