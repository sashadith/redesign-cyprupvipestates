// WhatsApp gateway session watch (2026-10-18). Every 5 minutes:
//   curl -s -m 90 "http://127.0.0.1:3000/api/cron/whatsapp-health?key=$CRON_SECRET"
//
// Reads the OpenWA session status, restarts a failed/disconnected session with
// its saved credentials (POST /start, no QR), and tells the operator on
// Telegram when that did not help or when the phone is needed. One more message
// when it is healthy again. See src/lib/openwa/sessionHealth.ts for why.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logCronRun } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { createOpenWaClient } from "@/lib/openwa/client";
import { decideHealthAction, healthAlertText, type Observation } from "@/lib/openwa/sessionHealth";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const JOB = "whatsapp-health";
const RESTART_JOB = "whatsapp-health:restart";
// While it stays broken, repeat the alert every 6 hours, not every 5 minutes.
const REPEAT_ALERT_MS = 6 * 3_600_000;
// Throttled per KIND: a "phone needed" alert must not wait 6 hours behind an
// earlier "down" alert — scanning the QR code is then the only fix.
const notifiedJob = (kind: "down" | "pairing") => `notified:${JOB}:${kind}`;

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
  const [recent, lastRestart, lastSuccess, notifiedDown, notifiedPairing] = await Promise.all([
    prisma.cronRunLog.findMany({ where: { job: JOB }, orderBy: { ranAt: "desc" }, take: 12, select: { ok: true } }),
    prisma.cronRunLog.findFirst({ where: { job: RESTART_JOB }, orderBy: { ranAt: "desc" }, select: { ranAt: true, ok: true, message: true } }),
    prisma.cronRunLog.findFirst({ where: { job: JOB, ok: true }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
    prisma.cronRunLog.findFirst({ where: { job: notifiedJob("down") }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
    prisma.cronRunLog.findFirst({ where: { job: notifiedJob("pairing") }, orderBy: { ranAt: "desc" }, select: { ranAt: true } }),
  ]);
  // A notification belongs to the current outage when it is newer than the last healthy run.
  const inStreak = (n: { ranAt: Date } | null) => !!n && (!lastSuccess || n.ranAt > lastSuccess.ranAt);
  const priorBad = recent.findIndex((r) => r.ok);
  const consecutiveBad = healthy ? 0 : 1 + (priorBad === -1 ? recent.length : priorBad);
  const minutesSinceRestart = lastRestart ? (Date.now() - lastRestart.ranAt.getTime()) / 60_000 : null;

  const decision = decideHealthAction(obs, { consecutiveBad, minutesSinceRestart });

  let restarted = false;
  let restartError: string | null = lastRestart && !lastRestart.ok ? lastRestart.message : null;
  if (decision.restart) {
    try {
      await client.startSession();
      restarted = true;
      restartError = null;
      await logCronRun(RESTART_JOB, true, `restart from status ${obs?.status ?? "unreachable"}`);
    } catch (e) {
      restartError = e instanceof Error ? e.message : String(e);
      await logCronRun(RESTART_JOB, false, restartError);
    }
  }

  // Alerts. "Recovered" only if we had told the operator it was broken.
  let alerted: string | null = null;
  try {
    if (healthy && (inStreak(notifiedDown) || inStreak(notifiedPairing))) {
      await sendTelegramMessage(healthAlertText("recovered", obs, false));
      alerted = "recovered";
    } else if (decision.alert) {
      const last = decision.alert === "down" ? notifiedDown : notifiedPairing;
      const due = !inStreak(last) || Date.now() - last!.ranAt.getTime() >= REPEAT_ALERT_MS;
      if (due && (await sendTelegramMessage(healthAlertText(decision.alert, obs, restarted, restartError)))) {
        await logCronRun(notifiedJob(decision.alert), true);
        alerted = decision.alert;
      }
    }
  } catch (e) {
    console.error("[whatsapp-health] telegram failed:", e instanceof Error ? e.message : e);
  }

  const summary = `${obs?.status ?? "unreachable"}${restarted ? ", restarted" : ""}${alerted ? `, alert=${alerted}` : ""}`;
  await logCronRun(JOB, decision.ok, summary);
  return NextResponse.json({ status: obs?.status ?? "unreachable", ok: decision.ok, consecutiveBad, restarted, alerted });
}
