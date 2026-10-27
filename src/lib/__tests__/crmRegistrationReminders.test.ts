import { test } from "node:test";
import assert from "node:assert/strict";
import { dueReminders, reminderMail, reminderRecipients, reminderTelegram, sendRegistrationReminders, type ReminderRow, type ReminderDeps } from "@/lib/crm/registration/reminders";

const now = new Date("2026-10-30T10:00:00Z");
const row = (o: Partial<ReminderRow> = {}): ReminderRow => ({
  id: "r1", status: "SENT", sentAt: new Date("2026-10-28T09:00:00Z"), reminderSentAt: null, developerName: "Marinakis",
  lead: { id: "L1", name: "Anna Muster", status: "COMMUNICATING", deletedAt: null, assignedTo: { id: "u2", email: "staff@cve.com", isActive: true } }, ...o,
});
const OWNERS = [{ id: "u1", email: "owner@cve.com", isActive: true }, { id: "u9", email: "old@cve.com", isActive: false }];

test("due after 2 days only, once, SENT only, live leads only", () => {
  assert.equal(dueReminders([row()], now).length, 1);
  assert.equal(dueReminders([row({ sentAt: new Date("2026-10-28T11:00:00Z") })], now).length, 0);
  assert.equal(dueReminders([row({ reminderSentAt: now })], now).length, 0);
  assert.equal(dueReminders([row({ status: "PRELIMINARY" })], now).length, 0);
  assert.equal(dueReminders([row({ sentAt: null })], now).length, 0);
  assert.equal(dueReminders([row({ lead: { ...row().lead, status: "LOST" } })], now).length, 0);
  assert.equal(dueReminders([row({ lead: { ...row().lead, deletedAt: now } })], now).length, 0);
});

test("recipients: active owners plus active non-owner assignee, deduped", () => {
  assert.deepEqual(reminderRecipients(OWNERS, { id: "u2", email: "staff@cve.com", isActive: true }), ["owner@cve.com", "staff@cve.com"]);
  assert.deepEqual(reminderRecipients(OWNERS, { id: "u1", email: "owner@cve.com", isActive: true }), ["owner@cve.com"]);
  assert.deepEqual(reminderRecipients(OWNERS, { id: "u3", email: "gone@cve.com", isActive: false }), ["owner@cve.com"]);
  assert.deepEqual(reminderRecipients(OWNERS, null), ["owner@cve.com"]);
});

test("mail and Telegram text", () => {
  const m = reminderMail(row(), "https://x");
  assert.equal(m.subject, "Registration not confirmed: Anna Muster – Marinakis");
  assert.match(m.text, /28\.10\.2026/);
  assert.match(m.text, /https:\/\/x\/crm\/leads\/L1/);
  assert.match(reminderTelegram([row({ lead: { ...row().lead, name: "A<b>" } })], "https://x"), /A&lt;b&gt;/);
});

function fake(over: Partial<ReminderDeps> = {}) {
  const rec = { mails: [] as string[], marked: [] as string[], telegrams: [] as string[] };
  const deps: ReminderDeps = {
    load: async () => [row()],
    owners: async () => OWNERS,
    sendEmail: async (m) => { rec.mails.push(m.to); },
    sendTelegram: async (t) => { rec.telegrams.push(t); },
    markReminded: async (id) => { rec.marked.push(id); },
    now: () => now,
    siteUrl: "https://x",
    ...over,
  };
  return { deps, rec };
}

test("sends one email per recipient, marks once, one Telegram per run", async () => {
  const { deps, rec } = fake();
  assert.deepEqual(await sendRegistrationReminders(deps), { reminded: 1, errors: [] });
  assert.deepEqual(rec.mails, ["owner@cve.com", "staff@cve.com"]);
  assert.deepEqual(rec.marked, ["r1"]);
  assert.equal(rec.telegrams.length, 1);
});

test("failed email → not marked, retried next run; Telegram failure does not block marking", async () => {
  const a = fake({ sendEmail: async () => { throw new Error("SMTP down"); } });
  const r = await sendRegistrationReminders(a.deps);
  assert.equal(r.reminded, 0);
  assert.equal(r.errors.length, 2);
  assert.deepEqual(a.rec.marked, []);
  const b = fake({ sendTelegram: async () => { throw new Error("tg"); } });
  assert.equal((await sendRegistrationReminders(b.deps)).reminded, 1);
  assert.deepEqual(b.rec.marked, ["r1"]);
});
