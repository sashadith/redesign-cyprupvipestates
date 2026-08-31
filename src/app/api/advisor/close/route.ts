import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { StoredSuggestion, SuggestionStatus } from "@/lib/seoAdvisor/types";

// Close out advisor suggestions without an admin session.
//
// The advisor's approve/dismiss buttons are server actions behind auth(), so
// an agent that does the work has no way to record it — and the operator who
// can click has not done the work. That gap is not hypothetical: on
// 2026-08-31 all five suggestions of the 2026-08-30 run still read "open"
// after they had been implemented in a separate session that morning, and the
// status had to be patched straight into the database. This is that patch,
// made a supported operation instead of a one-off script.
//
// Same auth shape as /api/dev/sync: an admin session OR a CRON_SECRET bearer
// token, compared in constant time.
function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const got = req.headers.get("authorization") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const STATUSES = new Set<SuggestionStatus>(["approved", "dismissed"]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session && !cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }

  const status = String(body?.status ?? "") as SuggestionStatus;
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: `status must be one of: ${Array.from(STATUSES).join(", ")}` }, { status: 400 });
  }

  const note = typeof body?.note === "string" ? body.note.trim() : "";
  // A note is required, not optional. The whole reason this endpoint exists is
  // that work happened somewhere the advisor cannot see; a status flipped with
  // no record of what was actually done recreates that blindness one level up.
  if (!note) return NextResponse.json({ error: "note is required — say what was done, and where" }, { status: 400 });

  // Default to the newest run, which is the one anyone closing out means.
  const run = body?.runId
    ? await prisma.advisorRun.findUnique({ where: { id: String(body.runId) } })
    : await prisma.advisorRun.findFirst({ orderBy: { runDate: "desc" } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const suggestions = (run.suggestions as unknown as StoredSuggestion[]) ?? [];
  const ids: string[] | "open" = Array.isArray(body?.ids) && body.ids.length ? body.ids.map(String) : "open";
  const targeted = new Set(ids === "open" ? suggestions.filter((s) => s.status === "open").map((s) => s.id) : ids);

  const unknown = ids === "open" ? [] : Array.from(targeted).filter((id) => !suggestions.some((s) => s.id === id));
  if (unknown.length) return NextResponse.json({ error: `unknown suggestion id(s): ${unknown.join(", ")}` }, { status: 400 });

  const now = new Date().toISOString();
  const changed: { id: string; title: string; from: SuggestionStatus }[] = [];
  const next = suggestions.map((s) => {
    if (!targeted.has(s.id) || s.status === status) return s;
    changed.push({ id: s.id, title: s.title, from: s.status });
    return {
      ...s,
      status,
      implementationNotes: note,
      ...(status === "approved" ? { approvedAt: now } : { dismissedAt: now, dismissalReason: note }),
    };
  });

  if (changed.length) await prisma.advisorRun.update({ where: { id: run.id }, data: { suggestions: next as any } });

  const remainingOpen = next.filter((s) => s.status === "open").length;
  return NextResponse.json({
    ok: true,
    runId: run.id,
    runDate: run.runDate,
    status,
    changed: changed.length,
    changedItems: changed,
    remainingOpen,
  });
}
