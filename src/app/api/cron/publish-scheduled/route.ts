// Scheduled-publishing worker. A system cron on the VPS calls this every few
// minutes (secured by CRON_SECRET). It flips any SCHEDULED content whose
// scheduledAt has arrived to PUBLISHED and revalidates the affected public
// paths so it appears immediately. Runs for all four schedulable content types.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { withCronLog } from "@/lib/cronLog";

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

  const [blogs, projects, pages, caseStudies] = await Promise.all([
    prisma.blog.findMany({ where, select }),
    prisma.project.findMany({ where, select }),
    prisma.singlepage.findMany({ where, select }),
    prisma.caseStudy.findMany({ where, select }),
  ]);

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
  await flip(prisma.project, projects, (l, s) => { revalidatePath(`/${l}/projects/${s}`); revalidatePath(`/${l}/projects`); revalidatePath(`/${l}`); }, "project");
  await flip(prisma.singlepage, pages, (l, s) => { revalidatePath(`/${l}/${s}`); }, "singlepage");
  await flip(prisma.caseStudy, caseStudies, (l, s) => { revalidatePath(`/${l}/case-studies/${s}`); revalidatePath(`/${l}/case-studies`); }, "caseStudy");

  const total = Object.values(published).reduce((a, b) => a + b, 0);
  return { ranAt: now.toISOString(), total, published };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await withCronLog("publish-scheduled", run, (r) => `${r.total} item(s) published`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
export const POST = GET;
