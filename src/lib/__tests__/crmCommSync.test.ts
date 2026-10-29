// WhatsApp both directions + mail from the Sent folder → lead timeline (2026-10-29).
//
// What went wrong before this: WhatsApp started naming private chats by privacy id ("…@lid"), the
// inbound path only accepted "…@c.us", and 646 customer messages in two weeks were dropped as
// "not-a-chat". The tests below pin the cases that would write the WRONG row or none: a lid that
// must be resolved, our own message vs the customer's, a CRM send echoed back, a group, a burst
// that would use up the cadence chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { counterpartJid, messageKey, messageText, trackWhatsAppMessage, type NewWaRow, type TrackDeps, type WaMessage } from "@/lib/openwa/trackMessage";
import { leadForRecipients, type LeadEmailIndex } from "@/lib/emailInbound/sentMail";
import { syncSummary } from "@/lib/crm/commSyncSummary";
import { dryRunDeps } from "@/lib/crm/commSync";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const OUR = "35799278285@c.us";
const LEAD_PHONE = "491705583988";
const T = 1793267693; // seconds

function fakeDeps(over: Partial<TrackDeps> = {}, firstContact = true) {
  const created: NewWaRow[] = [];
  const linked: [string, string][] = [];
  const cadence: string[] = [];
  const cadenceSince: (Date | null)[] = [];
  const resolved: string[] = [];
  const deps: TrackDeps = {
    resolvePhone: async (jid) => { resolved.push(jid); return jid === "244430917374045@lid" ? LEAD_PHONE : null; },
    messageIdExists: async () => false,
    matchLead: async (msisdn) => (msisdn === LEAD_PHONE ? { leadId: "L1", ambiguous: false } : null),
    unlinkedRows: async () => [],
    linkMessageId: async (id, mid) => { linked.push([id, mid]); return true; },
    create: async (row, since) => { created.push(row); cadenceSince.push(since); return { created: true, firstContact: !!since && firstContact }; },
    applyCadence: async (leadId) => { cadence.push(leadId); },
    ...over,
  };
  return { deps, created, linked, cadence, cadenceSince, resolved };
}

const inbound = (over: Partial<WaMessage> = {}): WaMessage => ({
  id: "false_244430917374045@lid_A1", from: "244430917374045@lid", to: OUR, chatId: "244430917374045@lid",
  body: "Is the villa still available?", type: "text", fromMe: false, timestamp: T, ...over,
});
const outbound = (over: Partial<WaMessage> = {}): WaMessage => ({
  id: "true_244430917374045@lid_B1", from: OUR, to: "244430917374045@lid", chatId: "244430917374045@lid",
  body: "Yes — I'll send you the plans tonight.", type: "text", fromMe: true, timestamp: T, ...over,
});

test("a customer message from a privacy id is resolved to the phone and logged as WHATSAPP_IN", async () => {
  const f = fakeDeps();
  const r = await trackWhatsAppMessage(inbound(), { live: true, via: "openwa-webhook" }, f.deps);
  assert.deepEqual(r, { status: "logged", leadId: "L1", direction: "INBOUND" });
  assert.deepEqual(f.resolved, ["244430917374045@lid"]);
  assert.equal(f.created[0].type, "WHATSAPP_IN");
  assert.equal(f.created[0].occurredAt.getTime(), T * 1000, "gateway seconds, not milliseconds");
  assert.deepEqual(f.cadence, [], "a customer writing first is not us contacting them: no cadence, no NEW → CONTACTED");
  assert.equal(f.created[0].metadata.leadReacted, true);
});

test("the gateway's own senderPhone is used before asking it again", async () => {
  const f = fakeDeps();
  await trackWhatsAppMessage(inbound({ senderPhone: LEAD_PHONE }), { live: true, via: "openwa-webhook" }, f.deps);
  assert.deepEqual(f.resolved, []);
  assert.equal(f.created.length, 1);
});

test("the operator's own message (phone or CRM) is WHATSAPP_OUT on the customer's lead, never 'lead reacted'", async () => {
  const f = fakeDeps();
  const r = await trackWhatsAppMessage(outbound(), { live: true, via: "openwa-webhook" }, f.deps);
  assert.deepEqual(r, { status: "logged", leadId: "L1", direction: "OUTBOUND" });
  assert.equal(f.created[0].type, "WHATSAPP_OUT");
  assert.equal(f.created[0].metadata.leadReacted, undefined);
  assert.deepEqual(f.cadence, ["L1"]);
  assert.equal(f.cadenceSince[0]?.getTime(), (T - 12 * 3600) * 1000, "throttle window: 12 h before the message");
});

test("a message the CRM already logged (no WhatsApp id yet) is linked, not doubled", async () => {
  const f = fakeDeps({ unlinkedRows: async () => [{ id: "I9", body: "Yes —  I'll send you the plans tonight.\n" }] });
  const r = await trackWhatsAppMessage(outbound(), { live: true, via: "openwa-webhook" }, f.deps);
  assert.equal(r.status, "linked");
  assert.deepEqual(f.linked, [["I9", "true_244430917374045@lid_B1"]]);
  assert.equal(f.created.length, 0);
  assert.equal(f.cadence.length, 0, "the CRM send already moved the cadence");
});

test("a burst of messages moves the cadence once, not once per message", async () => {
  const f = fakeDeps({}, false);
  await trackWhatsAppMessage(outbound(), { live: true, via: "openwa-webhook" }, f.deps);
  assert.equal(f.created.length, 1);
  assert.equal(f.cadence.length, 0);
});

test("sync and backfill write history only: no cadence", async () => {
  const f = fakeDeps();
  await trackWhatsAppMessage(inbound(), { live: false, via: "openwa-sync" }, f.deps);
  assert.equal(f.created[0].metadata.via, "openwa-sync");
  assert.equal(f.cadence.length, 0);
});

test("a parallel delivery that wins the insert or the link makes this one a duplicate, not an error", async () => {
  const lost = fakeDeps({ create: async () => ({ created: false, firstContact: false }) });
  assert.deepEqual(await trackWhatsAppMessage(outbound(), { live: true, via: "openwa-webhook" }, lost.deps), { status: "skipped", reason: "duplicate" });
  assert.equal(lost.cadence.length, 0);
  const linkLost = fakeDeps({ unlinkedRows: async () => [{ id: "I9", body: "Yes — I'll send you the plans tonight." }], linkMessageId: async () => false });
  assert.deepEqual(await trackWhatsAppMessage(outbound(), { live: true, via: "openwa-webhook" }, linkLost.deps), { status: "skipped", reason: "duplicate" });
});

test("a message is recognised by its key whichever chat id names it", () => {
  assert.equal(messageKey("true_244430917374045@lid_3EB0A6BF00A0DB9F3C8F01"), "3EB0A6BF00A0DB9F3C8F01");
  assert.equal(messageKey("true_491705583988@c.us_3EB0A6BF00A0DB9F3C8F01"), "3EB0A6BF00A0DB9F3C8F01");
});

test("groups, broadcasts, duplicates, strangers and unresolvable ids write nothing", async () => {
  const cases: [WaMessage, Partial<TrackDeps>, string][] = [
    [inbound({ chatId: "120363227287526834@g.us", from: "120363227287526834@g.us" }), {}, "not-a-chat"],
    [inbound({ isGroup: true }), {}, "not-a-chat"],
    [inbound({ chatId: "status@broadcast" }), {}, "not-a-chat"],
    [inbound(), { messageIdExists: async () => true }, "duplicate"],
    [inbound({ from: "35700000000@c.us", chatId: "35700000000@c.us" }), {}, "no-lead"],
    [inbound({ from: "999@lid", chatId: "999@lid" }), {}, "unresolved"],
    [inbound({ body: "  ", type: "revoked" }), {}, "empty"],
  ];
  for (const [msg, over, reason] of cases) {
    const f = fakeDeps(over);
    const r = await trackWhatsAppMessage(msg, { live: true, via: "openwa-webhook" }, f.deps);
    assert.deepEqual(r, { status: "skipped", reason }, `${reason}: ${JSON.stringify(msg).slice(0, 80)}`);
    assert.equal(f.created.length + f.linked.length, 0);
  }
});

test("a dropped chat id falls back to from/to; history's phone chat id wins over a lid", () => {
  assert.equal(counterpartJid({ from: "1@lid", to: OUR, chatId: "4917@c.us", fromMe: false }), "4917@c.us");
  assert.equal(counterpartJid({ from: OUR, to: "1@lid", chatId: null, fromMe: true }), "1@lid");
  assert.equal(counterpartJid({ from: "1@lid", to: OUR, chatId: null, fromMe: false }), "1@lid");
});

test("a photo without caption still counts as a message; captions win", () => {
  assert.equal(messageText({ body: "", type: "image" }), "[Photo]");
  assert.equal(messageText({ body: "the view", type: "image" }), "the view");
  assert.equal(messageText({ body: null, type: "e2e_notification" }), null);
});

test("dry run counts but never writes", async () => {
  const f = fakeDeps();
  const dry = dryRunDeps(f.deps);
  const r = await trackWhatsAppMessage(inbound(), { live: true, via: "openwa-webhook" }, dry);
  assert.equal(r.status, "logged");
  assert.equal(f.created.length + f.cadence.length, 0);
});

test("sent mail goes to the lead in To, else Cc; never to our own address", () => {
  const index: LeadEmailIndex = new Map([
    ["anke@example.de", [{ leadId: "A", rank: 2 }]],
    ["partner@agency.pl", [{ leadId: "P", rank: 1 }]],
    ["sascha.dith@cyprusvipestates.com", [{ leadId: "SELF", rank: 3 }]],
    ["couple@mail.com", [{ leadId: "C2", rank: 5 }, { leadId: "C1", rank: 1 }]],
  ]);
  const own = "sascha.dith@cyprusvipestates.com";
  assert.deepEqual(leadForRecipients([{ address: "Anke@Example.de" }], [{ address: "partner@agency.pl" }], index, own), { leadId: "A", ambiguous: false });
  assert.deepEqual(leadForRecipients([{ address: "office@x.com" }], [{ address: "partner@agency.pl" }], index, own), { leadId: "P", ambiguous: false });
  assert.equal(leadForRecipients([{ address: own }], [], index, own), null);
  assert.deepEqual(leadForRecipients([{ address: "couple@mail.com" }], [], index, own), { leadId: "C2", ambiguous: true });
  assert.equal(leadForRecipients([{ address: "stranger@x.com" }], undefined, index, own), null);
});

test("the Sync toast says what happened, including failures", () => {
  assert.equal(syncSummary({ ok: true, logged: 3, linked: 1 }, { ok: true, inbound: 1, outbound: 0, mailboxes: 1 }), "WhatsApp: 3 new, 1 matched · Email: 1 new");
  assert.equal(syncSummary({ ok: true, logged: 0, linked: 0 }, null), "WhatsApp: nothing new");
  assert.equal(syncSummary({ ok: false, error: "WhatsApp gateway unreachable." }, { ok: true, inbound: 0, outbound: 0, mailboxes: 0 }), "WhatsApp failed (WhatsApp gateway unreachable.) · Email: no mailbox connected");
  assert.equal(syncSummary(null, null), "No phone number or email on this lead.");
});

test("wiring: the webhook tracks both directions live; the cron polls Sent; Sent is opened read-only", () => {
  const route = read("src/app/api/webhooks/whatsapp-inbound/route.ts");
  assert.ok(route.includes('trackWhatsAppMessage(msg, { live: true, via: "openwa-webhook" }'));
  assert.ok(route.includes("senderPhone: str(p.senderPhone)"));
  assert.ok(read("src/app/api/cron/email-inbound/route.ts").includes("await pollSentForUser(userId, fromAddress)"));
  const imap = read("src/lib/emailInbound/imapClient.ts");
  assert.ok(imap.includes("const mailbox = await client.mailboxOpen(path, { readOnly: true });"));
  assert.ok(imap.includes('return withReadOnlyMailbox(creds, async () => "INBOX", fn);'));
  const action = read("src/app/crm/leads/commSyncActions.ts");
  assert.ok(action.indexOf("canEditLead(user, lead)") < action.indexOf("syncLeadWhatsApp(lead.phone)"), "guard before any sync");
  assert.ok(route.includes('fromMe: p.fromMe === true || body?.event === "message.sent"'), "message.sent is ours even without the flag");
  const log = read("src/lib/crm/logInteraction.ts");
  assert.ok(log.indexOf("trackedWhatsAppTwin(") < log.indexOf("prisma.leadInteraction.create("), "a hand log of a tracked message returns the tracked row");
  const backfill = read("src/app/api/cron/comm-backfill/route.ts");
  assert.ok(backfill.includes("timingSafeEqual") && !backfill.includes('p.get("key")'), "backfill secret in a header, compared in constant time");
});
