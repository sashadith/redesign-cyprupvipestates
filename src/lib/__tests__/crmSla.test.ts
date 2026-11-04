import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SLA, dueSlaNotices, slaStartFromEnv, slaThresholdsFromEnv, slaNoticesFromRows,
  unassignedTelegram, escalateTelegram, uncontactedEmail, latestAssignedAt, sendSlaNotices, type SlaLead, type SlaRule,
} from "../crm/sla";

const START = new Date("2026-10-18T06:00:00Z");
const NOW = new Date("2026-10-18T12:00:00Z");
const min = (n: number) => new Date(NOW.getTime() - n * 60_000);

function lead(id: string, over: Partial<SlaLead> = {}): SlaLead {
  return {
    id, name: id, status: "NEW", createdAt: min(350), assignedToId: null, ownerName: null, ownerEmail: null,
    assignedAt: null, lastOutboundContactAt: null, notified: [], ...over,
  };
}
const owned = (id: string, assignedMinAgo: number, over: Partial<SlaLead> = {}) =>
  lead(id, { assignedToId: "u1", ownerName: "Anna", ownerEmail: "anna@example.com", assignedAt: min(assignedMinAgo), ...over });
const due = (leads: SlaLead[]) => dueSlaNotices(leads, NOW, START, DEFAULT_SLA).map((n) => `${n.rule}:${n.lead.id}`);

test("leads created before CRM_SLA_START are ignored entirely", () => {
  const before = new Date(START.getTime() - 1);
  assert.deepEqual(due([lead("old", { createdAt: before }), owned("old-owned", 500, { createdAt: before })]), []);
  assert.deepEqual(due([lead("edge", { createdAt: START })]), ["UNASSIGNED:edge"]);
});

test("unassigned: 29 minutes is not due, 31 minutes is", () => {
  assert.deepEqual(due([lead("a", { createdAt: min(29) }), lead("b", { createdAt: min(31) })]), ["UNASSIGNED:b"]);
  assert.deepEqual(due([lead("c", { createdAt: min(30) })]), ["UNASSIGNED:c"]);
});

test("UNASSIGNED is sent only once per lead", () => {
  assert.deepEqual(due([lead("a", { createdAt: min(300), notified: [{ rule: "UNASSIGNED", at: min(200) }] })]), []);
});

test("uncontacted after 120 min, escalation after 240 min; both at once only if neither was sent", () => {
  assert.deepEqual(due([owned("a", 119)]), []);
  assert.deepEqual(due([owned("b", 121)]), ["UNCONTACTED:b"]);
  assert.deepEqual(due([owned("c", 241)]), ["UNCONTACTED:c", "ESCALATE:c"]);
  assert.deepEqual(due([owned("d", 241, { notified: [{ rule: "UNCONTACTED", at: min(120) }] })]), ["ESCALATE:d"]);
  assert.deepEqual(due([owned("e", 300, { notified: [{ rule: "UNCONTACTED", at: min(170) }, { rule: "ESCALATE", at: min(50) }] })]), []);
});

test("reassignment re-arms the owner rules: a notice from before the new assignment does not count", () => {
  const notified = [{ rule: "UNCONTACTED" as const, at: min(400) }, { rule: "ESCALATE" as const, at: min(300) }];
  assert.deepEqual(due([owned("a", 130, { notified })]), ["UNCONTACTED:a"]);
  // A notice written at the very moment of assignment still counts for that assignment.
  assert.deepEqual(due([owned("b", 130, { notified: [{ rule: "UNCONTACTED", at: min(130) }] })]), []);
});

test("outbound contact after the assignment clears the owner rules; contact before it does not", () => {
  assert.deepEqual(due([owned("a", 300, { lastOutboundContactAt: min(200) })]), []);
  assert.deepEqual(due([owned("b", 300, { lastOutboundContactAt: min(400) })]), ["UNCONTACTED:b", "ESCALATE:b"]);
});

test("closed, lost and keep-contact leads are ignored", () => {
  for (const status of ["CLOSED", "LOST", "KEEP_CONTACT"]) {
    assert.deepEqual(due([lead("u", { status, createdAt: min(60) }), owned("o", 300, { status })]), [], status);
  }
  assert.deepEqual(due([owned("r", 300, { status: "RESERVED" })]), ["UNCONTACTED:r", "ESCALATE:r"]);
});

test("assigned lead without a known assignment time gets no owner notice (never guessed)", () => {
  assert.deepEqual(due([owned("a", 0, { assignedAt: null })]), []);
});

test("thresholds come from the env; garbage falls back to the default per value", () => {
  assert.deepEqual(slaThresholdsFromEnv({}), DEFAULT_SLA);
  assert.deepEqual(slaThresholdsFromEnv({ CRM_SLA_UNASSIGNED_MIN: "45", CRM_SLA_UNCONTACTED_MIN: "90", CRM_SLA_ESCALATE_MIN: "180" }),
    { unassignedMin: 45, uncontactedMin: 90, escalateMin: 180 });
  assert.deepEqual(slaThresholdsFromEnv({ CRM_SLA_UNASSIGNED_MIN: "abc", CRM_SLA_UNCONTACTED_MIN: "-5", CRM_SLA_ESCALATE_MIN: "0" }), DEFAULT_SLA);
  assert.deepEqual(slaThresholdsFromEnv({ CRM_SLA_UNASSIGNED_MIN: "12abc", CRM_SLA_UNCONTACTED_MIN: "", CRM_SLA_ESCALATE_MIN: "Infinity" }), DEFAULT_SLA);
});

test("CRM_SLA_START must be a real ISO timestamp", () => {
  assert.equal(slaStartFromEnv({}), null);
  assert.equal(slaStartFromEnv({ CRM_SLA_START: "" }), null);
  assert.equal(slaStartFromEnv({ CRM_SLA_START: "yesterday" }), null);
  assert.equal(slaStartFromEnv({ CRM_SLA_START: "1700000000" }), null);
  assert.equal(slaStartFromEnv({ CRM_SLA_START: "2026-10-18T06:00:00Z" })?.toISOString(), START.toISOString());
  assert.equal(slaStartFromEnv({ CRM_SLA_START: " 2026-10-18 " })?.toISOString(), "2026-10-18T00:00:00.000Z");
});

test("SLA rows are read back from metadata.sla only", () => {
  const rows = [
    { body: "SLA reminder: UNASSIGNED", metadata: { sla: "UNASSIGNED" }, occurredAt: min(10) },
    { body: "SLA reminder: ESCALATE", metadata: null, occurredAt: min(10) },
    { body: "SLA reminder: X", metadata: { sla: "BOGUS" }, occurredAt: min(10) },
    { body: "Assigned to Anna", metadata: { assignedToId: "u1" }, occurredAt: min(10) },
  ];
  assert.deepEqual(slaNoticesFromRows(rows), [{ rule: "UNASSIGNED", at: min(10) }]);
});

test("assignment time is the latest assignment row, and only if it names the current owner", () => {
  const owner = { id: "u1", name: "Anna" };
  const rows = [
    { body: "Assigned to Anna", metadata: { assignedToId: "u1" }, occurredAt: min(50) },
    { body: "Assigned to Bob", metadata: null, occurredAt: min(100) },
    { body: "Assigned to Anna", metadata: null, occurredAt: min(200) },
  ];
  assert.equal(latestAssignedAt(rows, owner)?.getTime(), min(50).getTime());
  assert.equal(latestAssignedAt([...rows].reverse(), owner)?.getTime(), min(50).getTime(), "order of input does not matter");
  assert.equal(latestAssignedAt([{ body: "Assigned to Bob", metadata: null, occurredAt: min(5) }, ...rows], owner), null);
  assert.equal(latestAssignedAt([], owner), null);
});

test("UNASSIGNED Telegram lists up to 10 escaped names, then 'and N more'", () => {
  const leads = Array.from({ length: 12 }, (_, i) => lead(`l${i}`, { name: i === 0 ? "Tom <b>&</b> Jerry" : `Lead ${i}` }));
  const text = unassignedTelegram(leads, "https://x.test");
  assert.match(text, /Tom &lt;b&gt;&amp;&lt;\/b&gt; Jerry/);
  assert.doesNotMatch(text, /<b>&<\/b>/);
  assert.match(text, /Lead 9\b/);
  assert.doesNotMatch(text, /Lead 10\b/);
  assert.match(text, /and 2 more/);
  assert.match(text, /https:\/\/x\.test\/crm\/inbox/);
  assert.doesNotMatch(unassignedTelegram(leads.slice(0, 3), "https://x.test"), /more/);
});

test("ESCALATE Telegram names owner, lead and the lead link, escaped", () => {
  const text = escalateTelegram([owned("abc", 300, { name: "A&B", ownerName: "<Anna>" })], NOW, "https://x.test");
  assert.match(text, /&lt;Anna&gt;/);
  assert.match(text, /A&amp;B/);
  assert.match(text, /https:\/\/x\.test\/crm\/leads\/abc/);
  assert.match(text, /5 h/);
  assert.match(text.split("\n")[0], /not contacted<\/b>$/);
  assert.match(text, /<i>Reassign in the inbox or on the lead page if needed<\/i>/);
});

test("UNCONTACTED email subject carries the lead and the whole hours since assignment", () => {
  const mail = uncontactedEmail(owned("abc", 150, { name: "Maria K" }), NOW, "https://x.test");
  assert.equal(mail.subject, "Please contact Maria K — assigned 2 h ago");
  assert.match(mail.text, /https:\/\/x\.test\/crm\/leads\/abc/);
});

test("an owner id pointing at no user counts as unassigned", () => {
  assert.deepEqual(due([lead("ghost", { assignedToId: "deleted-user", ownerName: null, createdAt: min(60) })]), ["UNASSIGNED:ghost"]);
});

test("ESCALATE line marks a deactivated owner", () => {
  assert.match(escalateTelegram([owned("a", 300, { ownerActive: false })], NOW, "https://x.test"), /<i>Anna \(inactive\)/);
  assert.doesNotMatch(escalateTelegram([owned("a", 300)], NOW, "https://x.test"), /inactive/);
});

function fakeDeps(telegramResult: unknown) {
  const calls = { telegram: [] as string[], email: [] as string[], marked: [] as string[] };
  return {
    calls,
    deps: {
      sendTelegram: async (text: string) => { calls.telegram.push(text); return telegramResult; },
      sendEmail: async (m: { to: string }) => { calls.email.push(m.to); },
      markSent: async (leads: SlaLead[], rule: SlaRule) => { for (const l of leads) calls.marked.push(`${rule}:${l.id}`); },
    },
  };
}

test("send: Telegram not configured marks nothing and is a skip, not an error", async () => {
  const { calls, deps } = fakeDeps(null);
  const r = await sendSlaNotices([{ rule: "UNASSIGNED", lead: lead("a") }, { rule: "ESCALATE", lead: owned("b", 300) }], NOW, "https://x.test", deps);
  assert.equal(calls.telegram.length, 2);
  assert.deepEqual(calls.marked, []);
  assert.deepEqual(r.sent, { UNASSIGNED: 0, UNCONTACTED: 0, ESCALATE: 0 });
  assert.equal(r.errors.length, 0);
  assert.equal(r.skipped.length, 2);
});

test("send: inactive or email-less owners get no email; others are emailed and marked; ESCALATE still fires", async () => {
  const { calls, deps } = fakeDeps({ ok: true });
  const r = await sendSlaNotices([
    { rule: "UNCONTACTED", lead: owned("gone", 300, { ownerActive: false }) },
    { rule: "UNCONTACTED", lead: owned("noemail", 300, { ownerEmail: null }) },
    { rule: "UNCONTACTED", lead: owned("ok", 300) },
    { rule: "ESCALATE", lead: owned("gone", 300, { ownerActive: false }) },
  ], NOW, "https://x.test", deps);
  assert.deepEqual(calls.email, ["anna@example.com"]);
  assert.deepEqual(calls.marked, ["UNCONTACTED:ok", "ESCALATE:gone"]);
  assert.match(calls.telegram[0], /\(inactive\)/);
  assert.deepEqual(r.sent, { UNASSIGNED: 0, UNCONTACTED: 1, ESCALATE: 1 });
  assert.equal(r.errors.length, 0);
  assert.equal(r.skipped.length, 2);
});

test("send: a failing email is an error and does not block the rest", async () => {
  const { calls, deps } = fakeDeps({ ok: true });
  let n = 0;
  deps.sendEmail = async (m: { to: string }) => { if (n++ === 0) throw new Error("smtp down"); calls.email.push(m.to); };
  const r = await sendSlaNotices([{ rule: "UNCONTACTED", lead: owned("x", 300) }, { rule: "UNCONTACTED", lead: owned("y", 300) }], NOW, "https://x.test", deps);
  assert.deepEqual(calls.marked, ["UNCONTACTED:y"]);
  assert.deepEqual(r.errors, ["UNCONTACTED x: smtp down"]);
});

test("owner rules stay silent when the current owner contacted the lead themselves, even before the assignment (2026-11-01)", () => {
  // Babs Bhavon: WhatsApp sent a day earlier by the same person the lead was assigned to later.
  assert.deepEqual(due([owned("babs", 300, { lastOutboundContactAt: min(1440), ownerContacted: true })]), []);
  // Contacted before the assignment by someone else: the new owner still owes a contact.
  assert.deepEqual(due([owned("other", 300, { lastOutboundContactAt: min(1440), ownerContacted: false })]), ["UNCONTACTED:other", "ESCALATE:other"]);
});
