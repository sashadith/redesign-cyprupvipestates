import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSkipReason, computeDue, dueTelegram, reminderDue, sendDueReminders, type DueLead, type DueSelection } from "@/lib/crm/registration/due";

const NOW = new Date("2026-10-28T10:00:00Z"); // 12:00 Nicosia
const h = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
const DEVS = [
  { id: "K", name: "Korantina Homes", channel: "WHATSAPP" as const, registrable: true },
  { id: "L", name: "Leptos Estates", channel: "EMAIL" as const, registrable: true },
  { id: "Q", name: "Quality Home", channel: "NONE" as const, registrable: false },
];
const sel = (over: Partial<DueSelection> = {}): DueSelection => ({
  createdAt: h(5), expiresAt: new Date(NOW.getTime() + 86_400_000), status: "active",
  items: [
    { developmentId: "k1", publicName: "Hill View", newAddedAt: null, developerAccountId: "K" },
    { developmentId: "k2", publicName: "Sea Line", newAddedAt: null, developerAccountId: "K" },
    { developmentId: "l1", publicName: "Marina", newAddedAt: h(1), developerAccountId: "L" },
    { developmentId: "q1", publicName: "Q Villas", newAddedAt: null, developerAccountId: "Q" },
  ],
  ...over,
});
const base = { leadStatus: "CONTACTED", selections: [sel()], registrations: [], followUps: [], developers: DEVS };

test("every developer of a live selection is due once, with all its projects; channel-less ones too", () => {
  const r = computeDue(base, NOW);
  assert.deepEqual(r.due.map((d) => [d.developerAccountId, d.projects, d.registrable]), [
    ["K", ["Hill View", "Sea Line"], true], ["Q", ["Q Villas"], false], ["L", ["Marina"], true],
  ]);
  assert.equal(r.due[2].since.getTime(), h(1).getTime(), "a project added later counts from when it was added");
});

test("registered, rejected and skipped developers are not due; a failed registration still is", () => {
  const r = computeDue({
    ...base,
    registrations: [{ developerAccountId: "K", status: "PRELIMINARY" }, { developerAccountId: "L", status: "FAILED" }, { developerAccountId: "Q", status: "REJECTED" }],
  }, NOW);
  assert.deepEqual(r.due.map((d) => d.developerAccountId), ["L"]);
  const s = computeDue({ ...base, followUps: [{ developerAccountId: "K", skippedAt: h(1), skippedByName: "Sascha", skipReason: "old client", lastRemindedAt: null }] }, NOW);
  assert.deepEqual(s.due.map((d) => d.developerAccountId), ["Q", "L"]);
  assert.equal(s.skipped[0].skipReason, "old client");
});

test("expired, revoked selections and closed leads produce nothing", () => {
  assert.equal(computeDue({ ...base, selections: [sel({ expiresAt: h(1) })] }, NOW).due.length, 0);
  assert.equal(computeDue({ ...base, selections: [sel({ status: "revoked" })] }, NOW).due.length, 0);
  assert.equal(computeDue({ ...base, leadStatus: "LOST" }, NOW).due.length, 0);
});

test("reminder: first after 2 h during the day, then once a day from 09:00 Nicosia", () => {
  assert.equal(reminderDue({ since: h(1), lastRemindedAt: null }, NOW), false);
  assert.equal(reminderDue({ since: h(3), lastRemindedAt: null }, NOW), true);
  const night = new Date("2026-10-28T21:30:00Z"); // 23:30 Nicosia
  assert.equal(reminderDue({ since: h(3), lastRemindedAt: null }, night), false);
  const yesterday = new Date("2026-10-27T15:00:00Z");
  assert.equal(reminderDue({ since: h(30), lastRemindedAt: yesterday }, NOW), true);
  assert.equal(reminderDue({ since: h(30), lastRemindedAt: yesterday }, new Date("2026-10-28T05:30:00Z")), false, "07:30 Nicosia is before 09:00");
  assert.equal(reminderDue({ since: h(30), lastRemindedAt: h(1) }, NOW), false, "already reminded today");
});

test("Telegram groups per client and shortens long developer lists", () => {
  const pairs = computeDue(base, NOW).due;
  const many = Array.from({ length: 7 }, (_, i) => ({ ...pairs[0], developerName: `Dev ${i}` }));
  const t = dueTelegram([{ leadId: "A1", leadName: "Anke <Varga>", ownerName: "Sascha Dith", pairs: many }], NOW, "https://x");
  assert.match(t, /You still didn't register <a href="https:\/\/x\/crm\/leads\/A1">Anke &lt;Varga&gt;<\/a> \(Sascha Dith\) at Dev 0, Dev 1, Dev 2, Dev 3, Dev 4 \+2 more — selection sent 5 h ago/);
});

test("sendDueReminders marks only what it sent and nothing when Telegram is off", async () => {
  const lead: DueLead = { leadId: "A1", leadName: "Anke", ownerId: null, ownerName: null, due: computeDue(base, NOW).due, skipped: [] };
  const marked: unknown[] = [];
  const deps = { load: async () => [lead], markReminded: async (p: unknown[]) => { marked.push(...p); }, now: () => NOW, siteUrl: "https://x" };
  const off = await sendDueReminders({ ...deps, sendTelegram: async () => null });
  assert.deepEqual([off.reminded, marked.length], [0, 0]);
  let text = "";
  const on = await sendDueReminders({ ...deps, sendTelegram: async (t) => { text = t; return {}; } });
  assert.equal(on.reminded, 1);
  assert.deepEqual(marked, [{ leadId: "A1", developerAccountId: "K" }, { leadId: "A1", developerAccountId: "Q" }], "Leptos is only 1 h old");
  assert.doesNotMatch(text, /Leptos/);
});

test("skip reason is required and capped", () => {
  assert.equal(cleanSkipReason("  ").ok, false);
  assert.equal(cleanSkipReason("x".repeat(201)).ok, false);
  assert.deepEqual(cleanSkipReason(" already   with   Remax "), { ok: true, reason: "already with Remax" });
});
