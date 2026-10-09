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
import { runSocialReminders, sentKey, type ReminderDeps } from "@/lib/social/socialReminders";
import { realNotifyDeps, NOTIFY_TOOL } from "@/lib/mcp/tools/notifyOwnerTelegram";
import type { TypefullyDraft } from "@/lib/social/typefully";

const cy = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h - 3, m));
const ID = 990_000_001; // far from any real Typefully id
const draft: TypefullyDraft = {
  id: ID, status: "planned", scheduled_date: cy(13, 10).toISOString(), draft_title: "QA · Tue · LinkedIn · ledger check",
  linkedin_post_enabled: true, created_at: cy(10, 9).toISOString(),
};

async function main() {
  await prisma.socialReminderSent.deleteMany({ where: { draftId: { in: [ID, 0] } } });
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

  // 4. Outage marker: claimed once, cleared by a successful read.
  const downDeps: ReminderDeps = { ...deps, listPlanned: async () => ({ ok: false, status: 503, message: "down" }) };
  clock = cy(13, 9, 43);
  await runSocialReminders(downDeps); await runSocialReminders(downDeps);
  assert.equal(sent.filter((t) => t.startsWith("🚨 Typefully unreachable")).length, 1);
  await runSocialReminders(deps);
  assert.equal(await prisma.socialReminderSent.count({ where: { draftId: 0 } }), 0, "marker cleared on recovery");

  // 5. The notify rate-limit count reads the real audit table (ok rows of this tool only).
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

  await prisma.socialReminderSent.deleteMany({ where: { draftId: { in: [ID, 0] } } });
  console.log(`OK — ${sent.length} fake sends:\n${sent.map((s) => s.split("\n")[0]).join("\n")}`);
}

main().then(() => prisma.$disconnect(), async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
