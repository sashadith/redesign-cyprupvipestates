import { NextRequest, NextResponse } from "next/server";
import { syncAll } from "@/lib/feedSync";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TRASH_RETENTION_DAYS = 90;

// Hard-delete leads that have sat in the trash (soft-deleted, see
// admin/actions.ts's softDeleteLeadAction) for over 90 days. Piggybacks on
// this existing daily cron rather than provisioning a new VPS crontab entry.
// Best-effort: a failure here must never block the actual feed sync.
async function purgeOldTrash() {
  try {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
    const { count } = await prisma.lead.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    return { purged: count };
  } catch (e) {
    console.error("Trash purge failed:", e);
    return { purged: 0, error: String(e) };
  }
}

// Daily data+image sync for every XML/API feed developer (Island Blue, INEX, BBF,
// Aristo, Pafilia, Domenica, Medousa, AGG, Square One) — mirrors images to our own
// storage (src/lib/imageMirror.ts), same as cron/drive-sync already does for
// Drive-folder developers. The admin "Sync now" button stays fast/data-only on
// purpose (mirroring many projects' images can take minutes); this cron is the
// "own job" referenced in feedSync.ts's runSync() comment, which never existed
// until now — images were silently staying hotlinked on the developers' own
// servers instead.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/feed-sync?key=$CRON_SECRET"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await syncAll({ mirror: true });
  const trash = await purgeOldTrash();
  return NextResponse.json({ ok: true, at: new Date().toISOString(), results, trash });
}
