// WhatsApp gateway session watch (2026-10-18). Every 5 minutes:
//   curl -s -m 60 "http://127.0.0.1:3000/api/cron/whatsapp-health?key=$CRON_SECRET"
//
// Reads the OpenWA session status, restarts a failed/disconnected session with
// its saved credentials (POST /start, no QR), and tells the operator on
// Telegram when that did not help or when the phone is needed. One more message
// when it is healthy again. See src/lib/openwa/sessionHealth.ts for why.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logCronRun, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { createOpenWaClient } from "@/lib/openwa/client";
import { decideHealthAction, healthAlertText, type Observation } from "@/lib/openwa/sessionHealth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JOB = "whatsapp-health";
const RESTART_JOB = "whatsapp-health:restart";
// While it stays broken, repeat the alert every 6 hours, not every 5 minutes.
const REPEAT_ALERT_DAYS = 0.25;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = createOpenWaClient();
  let obs: Observation;
  try {
    obs = await client.getSession();
  } catch {
    obs = null;
  }
  const healthy = obs?.status === "ready";

  // History from our own log: how many runs in a row were bad, when we last restarted.
  const [recent, lastRestart, lastSuccess, lastNotified] = await Promise.all([
    prisma.cronRunLog.findMany({ where: { job: JOB }, orderBy: { ranAt: "desc" }, take: 12, select: { ok: true } }),
    prisma.cronRunLog.findFirst({ where: { job: RESTART_JOB }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
    prisma.cronRunLog.findFirst({ where: { job: JOB, ok: true }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
    prisma.cronRunLog.findFirst({ where: { job: `notified:${JOB}` }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
  ]);
  const priorBad = recent.findIndex((r) => r.ok);
  const consecutiveBad = healthy ? 0 : 1 + (priorBad === -1 ? recent.length : priorBad);
  const minutesSinceRestart = lastRestart ? (Date.now() - lastRestart.ranAt.getTime()) / 60_000 : null;

  const decision = decideHealthAction(obs, { consecutiveBad, minutesSinceRestart });

  let restarted = false;
  if (decision.restart) {
    try {
      await client.startSession();
      restarted = true;
      await logCronRun(RESTART_JOB, true, `restart from status ${obs?.status ?? "unreachable"}`);
    } catch (e) {
      await logCronRun(RESTART_JOB, false, e instanceof Error ? e.message : String(e));
    }
  }

  // Alerts. "Recovered" only if we had told the operator it was broken.
  let alerted: string | null = null;
  try {
    if (healthy && lastNotified && (!lastSuccess || lastNotified.ranAt > lastSuccess.ranAt)) {
      await sendTelegramMessage(healthAlertText("recovered", obs, false));
      alerted = "recovered";
    } else if (decision.alert && (await shouldNotifyFailureStreak(JOB, REPEAT_ALERT_DAYS))) {
      if (await sendTelegramMessage(healthAlertText(decision.alert, obs, restarted))) await markFailureStreakNotified(JOB);
      alerted = decision.alert;
    }
  } catch (e) {
    console.error("[whatsapp-health] telegram failed:", e instanceof Error ? e.message : e);
  }

  const summary = `${obs?.status ?? "unreachable"}${restarted ? ", restarted" : ""}${alerted ? `, alert=${alerted}` : ""}`;
  await logCronRun(JOB, decision.ok, summary);
  return NextResponse.json({ status: obs?.status ?? "unreachable", ok: decision.ok, consecutiveBad, restarted, alerted });
}
