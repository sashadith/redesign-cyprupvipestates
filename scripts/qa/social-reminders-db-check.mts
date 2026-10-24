// Testbed verification for the social reminders + notify_owner_telegram
// (2026-10-09): the REAL ledger (social_reminders_sent) and the REAL audit
// count, against the disposable testbed DB — Typefully and Telegram stay fakes,
// so nothing leaves the machine:
//
//   cd /opt/cvp-testbed/repo && set -a && source /opt/cvp-testbed/.env.testbed && set +a
//   npx prisma migrate deploy && npx tsx scripts/qa/social-reminders-db-check.mts
//
// Exits 1 on the first failed assertion. The guard import below refuses to run
// against the production DB.
// @ts-expect-error — plain .mjs module without a declaration file
import { assertNotProdDb } from "../assert-not-prod-db.mjs";
assertNotProdDb();
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { realReminderDeps } from "@/lib/social/reminderDeps";
import { runSocialReminders, sentKey, RECOVERY_MESSAGE, type ReminderDeps } from "@/lib/social/socialReminders";
import { MONITOR_STATE_ID, readMonitorState, outageConfirmedNow } from "@/lib/social/monitorState";
import { realNotifyDeps, NOTIFY_TOOL } from "@/lib/mcp/tools/notifyOwnerTelegram";
import type { TypefullyDraft } from "@/lib/social/typefully";

const cy = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h - 3, m));
const ID = 990_000_001; // far from any real Typefully id
const draft: TypefullyDraft = {
  id: ID, status: "planned", scheduled_date: cy(13, 10).toISOString(), draft_title: "QA · Tue · LinkedIn · ledger check",
  linkedin_post_enabled: true, created_at: cy(10, 9).toISOString(),
};

const resetState = () => prisma.socialMonitorState.upsert({
  where: { id: MONITOR_STATE_ID },
  create: { id: MONITOR_STATE_ID },
  update: { consecutiveFailures: 0, firstFailureAt: null, lastFailureAt: null, lastError: null, alertedAt: null, recoveryPending: false, upcomingPlannedAt: [] },
});

async function main() {
  // The migration inserted the one state row and removed the old outage marker.
  assert.ok(await readMonitorState(), "social_monitor_state row exists after migrate deploy");
  assert.equal(await prisma.socialReminderSent.count({ where: { draftId: 0, kind: "api-unreachable" } }), 0, "old marker gone");
  await prisma.socialReminderSent.deleteMany({ where: { draftId: { in: [ID, 0] } } });
  const savedState = await prisma.socialMonitorState.findUnique({ where: { id: MONITOR_STATE_ID } });
  await resetState();
  const real = realReminderDeps();
  const sent: string[] = [];
  let clock = cy(13, 8, 33);
  let telegram: "sent" | "failed" = "sent";
  const deps: ReminderDeps = {
    ...real,
    listPlanned: async () => ({ ok: true, drafts: [draft], truncated: false }),
    send: async (t) => { if (telegram === "sent") sent.push(t); return telegram; },
    now: () => clock,
  };

  // 1. Claim is exactly-once in the DB: a second claim of the same row returns nothing.
  const first = await real.claim([{ draftId: ID, kind: "qa" }]);
  const second = await real.claim([{ draftId: ID, kind: "qa" }]);
  assert.equal(first.length, 1); assert.equal(second.length, 0);
  await real.release(first);
  assert.equal(await prisma.socialReminderSent.count({ where: { draftId: ID } }), 0, "release deletes the row");

  // 2. Telegram failure → row released → retried next run → sent once.
  telegram = "failed";
  await runSocialReminders(deps);
  assert.equal(await prisma.socialReminderSent.count({ where: { draftId: ID } }), 0);
  telegram = "sent";
  clock = cy(13, 8, 38);
  await runSocialReminders(deps);
  await runSocialReminders(deps);
  assert.equal(sent.length, 1);
  assert.deepEqual(Array.from(await real.sentKeys([ID])), [sentKey(ID, "t90")]);

  // 3. Concurrent runs (two pm2 workers / overlapping crons) send once.
  clock = cy(13, 9, 33);
  await Promise.all([runSocialReminders(deps), runSocialReminders(deps), runSocialReminders(deps)]);
  assert.equal(sent.filter((t) => t.startsWith("🚨 Last reminder")).length, 1);

  // 4. Outage threshold in the REAL state row: 3 failed checks in 10 minutes
  //    are logged only; the 4th (15 minutes) alerts once — also across a
  //    "restart" (fresh deps) and three overlapping runs.
  await resetState(); // forget the 10:00 draft remembered by the good runs above
  const down = (): ReminderDeps => ({ ...deps, ...realReminderDeps(), listPlanned: async () => ({ ok: false, status: 503, message: "down" }), send: deps.send, now: () => clock });
  const alerts = () => sent.filter((t) => t.startsWith("🚨 Typefully unreachable")).length;
  for (const m of [43, 48, 53]) { clock = cy(13, 9, m); await runSocialReminders(down()); }
  assert.equal(alerts(), 0, "below threshold: logged, no alert");
  assert.equal((await readMonitorState())!.consecutiveFailures, 3);
  assert.equal(await outageConfirmedNow(clock), false, "Action Center / digest stay quiet below the threshold");
  clock = cy(13, 9, 58);
  await Promise.all([runSocialReminders(down()), runSocialReminders(down()), runSocialReminders(down())]);
  assert.equal(alerts(), 1, "exactly one alert");
  assert.equal(await outageConfirmedNow(clock), true);
  clock = cy(13, 10, 3);
  await runSocialReminders(down());
  assert.equal(alerts(), 1);

  // 5. Recovery: exactly one message, even from overlapping runs; count reset.
  clock = cy(13, 10, 8);
  await Promise.all([runSocialReminders(deps), runSocialReminders(deps), runSocialReminders(deps)]);
  await runSocialReminders(deps);
  assert.equal(sent.filter((t) => t === RECOVERY_MESSAGE).length, 1, "exactly one recovery message");
  const after = (await readMonitorState())!;
  assert.equal(after.consecutiveFailures, 0); assert.equal(after.alertedAt, null); assert.equal(after.recoveryPending, false);

  // 6. Due-soon exception through the real row: a good check remembers a draft
  //    due at 12:00; the first failed check at 10:13 alerts at once.
  await resetState();
  const soon: TypefullyDraft = { ...draft, id: ID + 1, scheduled_date: cy(13, 12).toISOString() };
  clock = cy(13, 10, 13);
  await runSocialReminders({ ...deps, listPlanned: async () => ({ ok: true, drafts: [soon], truncated: false }) });
  assert.deepEqual((await readMonitorState())!.upcomingPlannedAt.map((d) => d.toISOString()), [soon.scheduled_date]);
  clock = cy(13, 10, 18);
  await runSocialReminders(down());
  assert.equal(alerts(), 2, "due within 2 h → alert after the first failed check");
  assert.ok(sent.some((t) => /due at 12:00/.test(t)));

  // 7. The notify rate-limit count reads the real audit table (ok rows of this tool only).
  const since = new Date(Date.now() - 3_600_000);
  const before = await realNotifyDeps().countSentSince(since);
  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "testbed DB has a user");
  await prisma.mcpToolCall.createMany({ data: [
    { userId: user.id, tool: NOTIFY_TOOL, ok: true, durationMs: 1, detail: { length: 3, telegramMessageId: 1 } },
    { userId: user.id, tool: NOTIFY_TOOL, ok: false, errorCode: "rate_limited", durationMs: 1, detail: { length: 3 } },
    { userId: user.id, tool: "crm_worklist", ok: true, durationMs: 1 },
  ] });
  assert.equal(await realNotifyDeps().countSentSince(since), before + 1, "only successful notify calls count");

  await prisma.socialReminderSent.deleteMany({ where: { draftId: { in: [ID, ID + 1, 0] } } });
  if (savedState) await prisma.socialMonitorState.update({ where: { id: MONITOR_STATE_ID }, data: savedState });
  console.log(`OK — ${sent.length} fake sends:\n${sent.map((s) => s.split("\n")[0]).join("\n")}`);
}

main().then(() => prisma.$disconnect(), async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
