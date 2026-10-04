import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;

async function cleanup() {
  const now = new Date();
  const [codes, tokens, expiredDrafts] = await Promise.all([
    prisma.mcpAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } }),
    prisma.mcpToken.deleteMany({ where: { OR: [{ refreshExpiresAt: { lt: new Date(now.getTime() - 30 * DAY) } }, { revokedAt: { lt: new Date(now.getTime() - 30 * DAY) } }] } }),
    prisma.leadEmailDraft.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "EXPIRED" } }),
  ]);
  // A draft stuck in SENDING means the process died mid-send (Phase 2). A
  // human has to check the mailbox's Sent folder before anything is retried.
  const stuck = await prisma.leadEmailDraft.findMany({ where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }, select: { id: true, leadId: true } });
  if (stuck.length) {
    await sendTelegramMessage(`⚠️ MCP: ${stuck.length} email draft(s) stuck in SENDING for >10 min — check the Sent folder before retrying. Draft ids: ${stuck.map((s) => s.id).join(", ")}`).catch(() => {});
  }
  return { codes: codes.count, tokens: tokens.count, expiredDrafts: expiredDrafts.count, stuck: stuck.length };
}

// Called by cron: curl -s "http://127.0.0.1:3000/api/cron/mcp-cleanup?key=$CRON_SECRET"
// Suggested schedule: 15 5 * * * (after action-digest, before gsc-sync).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await withCronLog("mcp-cleanup", cleanup, (r) => `${r.codes} codes, ${r.tokens} tokens deleted; ${r.expiredDrafts} drafts expired; ${r.stuck} stuck`);
  return NextResponse.json(result);
}
