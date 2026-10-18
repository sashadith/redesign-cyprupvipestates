// Partner notification outbox (partner portal phase 3b). ENGLISH (internal).
// 1. collect: STATUS_CHANGE rows on leads with an ACTIVE claim become STAGE outbox rows
//    (debounced 10 min, several changes of one lead collapse into one mail with the latest stage).
// 2. send: up to 50 unsent rows (STAGE / MESSAGE / CLAIM_OUTCOME), oldest first, as localized e-mails
//    to the partner's first user. sentAt is set only after a successful send; a failed send is retried
//    on the next run, up to 3 attempts. Rows that must not be mailed (partner suspended/pending, claim
//    no longer active, lead trashed, protection ended) are marked sent with the reason in `error`.
// Builders/planner: src/lib/partner/notify.ts; DB side: src/lib/partner/notifySend.ts.
//
// Set PARTNER_NOTIFY_START to the deploy time first (ISO, e.g. 2026-10-19T12:00:00Z): no stage change
// before it is ever mailed, and without it the job does nothing. PARTNER_HOST must be set in production.
// Crontab:
//   */10 * * * * curl -s "http://127.0.0.1:3000/api/cron/partner-notify?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { collectStageEvents, notifyStartFromEnv, sendPendingNotifications, type CollectResult, type SendResult } from "@/lib/partner/notifySend";

export const dynamic = "force-dynamic";

type NotifyResult =
  | { skipped: string }
  | { ok: true; collected: CollectResult; send: SendResult };

async function runNotify(): Promise<NotifyResult> {
  const start = notifyStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_NOTIFY_START not set" };
  const now = new Date();
  const collected = await collectStageEvents(now, start);
  const send = await sendPendingNotifications(now);
  if (send.errors.length) console.error("[partner-notify]", send.errors);
  return { ok: true, collected, send };
}

const summarize = (r: NotifyResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  const skipped = Object.values(r.send.skipped).reduce((a, b) => a + b, 0);
  return `collected ${r.collected.inserted} (${r.collected.pending} pending, ${r.collected.collapsed} collapsed, ${r.collected.settlingLeads} settling), ` +
    `sent ${r.send.sent}${skipped ? `, ${skipped} skipped` : ""}${r.send.failed ? `, ${r.send.failed} failed` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("partner-notify", runNotify, summarize, (r) => !("ok" in r) || r.send.failed === 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
