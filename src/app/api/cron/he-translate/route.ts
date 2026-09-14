import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateHe } from "@/lib/ai/translateHe";
import { processQueue, HE_ENTITY_TYPES, type QueuePrisma, type QueueRow } from "@/lib/ai/heTranslateQueue";

/* Drains the EN→HE translation queue (src/lib/ai/heTranslateQueue.ts).
 *
 * Called by cron: curl -s "http://127.0.0.1:3200/api/cron/he-translate?key=$CRON_SECRET&limit=10"
 * Auth is the same string compare as psi-sync: no CRON_SECRET set, or a wrong
 * key, is a 401 — the route must not be reachable from the open internet, since
 * every processed row costs two Anthropic calls.
 *
 * The batch is deliberately small (10 rows, 25 max): each row is two model calls
 * and can retry once, so 25 rows is up to 100 calls inside one 300s invocation.
 * The operator drains a few hundred rows by calling this on a minute-schedule,
 * not by raising the limit. */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_LIMIT));

  try {
    const where = { status: "PENDING", locale: "he" as const, entityType: { in: HE_ENTITY_TYPES } };
    const rows = (await prisma.aiGenerationQueue.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, entityType: true, entityId: true, prompt: true },
    })) as QueueRow[];

    const summary = await processQueue(rows, {
      prisma: prisma as unknown as QueuePrisma,
      translate: translateHe,
    });
    const remaining = await prisma.aiGenerationQueue.count({ where });

    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...summary, remaining });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
