import { test } from "node:test";
import assert from "node:assert/strict";
import { pickBySender, type RegCandidate } from "@/lib/emailInbound/registrationMatch";
import { handleOfficeMessage, officeImapCredentials, type OfficeMessage, type OfficeReplyDeps } from "@/lib/emailInbound/officeInbound";
import { inboundDisposition } from "@/lib/emailInbound/processInbound";
import type { ReplyVerdict } from "@/lib/crm/registration/classify";

const C = (id: string, lead: string, dev: string, addrs: string[]): RegCandidate => ({ registrationId: id, leadId: lead, developerAccountId: dev, developerName: dev, addresses: addrs });

test("pickBySender: exact address, then company domain", () => {
  const cs = [C("r1", "L1", "D1", ["sales@marinakisproperty.com"])];
  assert.equal(pickBySender("Sales@MarinakisProperty.com", cs)?.kind, "single");
  assert.equal(pickBySender("maria@marinakisproperty.com", cs)?.kind, "single");
  assert.equal(pickBySender("x@other.com", cs), null);
  assert.equal(pickBySender("", cs), null);
});

test("pickBySender: public mail domain never matches by domain (Review Focus 2)", () => {
  const cs = [C("r1", "L1", "D1", ["devsales@gmail.com"])];
  assert.equal(pickBySender("random.buyer@gmail.com", cs), null);
  assert.equal(pickBySender("devsales@gmail.com", cs)?.kind, "single");
});

test("pickBySender: two SENT registrations with the same developer → several", () => {
  const cs = [C("r1", "L1", "D1", ["s@dev.com"]), C("r2", "L2", "D1", ["s@dev.com"])];
  assert.equal(pickBySender("s@dev.com", cs)?.kind, "several");
});

type Rec = { stored: any[]; marked: [string, string][]; alerts: string[]; classified: number };

function deps(over: Partial<OfficeReplyDeps> & { verdict?: ReplyVerdict; status?: "SENT" | "PRELIMINARY" } = {}): { d: OfficeReplyDeps; rec: Rec } {
  const rec: Rec = { stored: [], marked: [], alerts: [], classified: 0 };
  const d: OfficeReplyDeps = {
    match: async () => ({ kind: "single", registrationId: "R1", leadId: "L1", developerName: "Marinakis" }),
    alreadyStored: async () => false,
    storeReply: async (i) => { rec.stored.push(i); },
    loadContext: async () => ({ status: over.status ?? "SENT", clientName: "Anna Muster", developerName: "Marinakis" }),
    classify: async () => { rec.classified++; return over.verdict ?? { verdict: "confirmed", evidence: "Registered, thank you" }; },
    markAuto: async (id, ev) => { rec.marked.push([id, ev]); },
    alert: async (h) => { rec.alerts.push(h); },
    siteUrl: "https://x",
    ...over,
  };
  return { d, rec };
}

const MSG: OfficeMessage = {
  messageId: "<in1@dev>", inReplyTo: "<out1@cyprusvipestates.com>", references: [], from: "sales@marinakisproperty.com",
  subject: "Re: Client registration – Anna Muster – Cyprus VIP Estates", body: "Registered, thank you.", date: new Date("2026-10-29T08:00:00Z"), autoSubmitted: false,
};
const OFFICE = "office@cyprusvipestates.com";

test("confirmed on SENT → stored as developer reply + auto-marked, no alert", async () => {
  const { d, rec } = deps();
  assert.equal(await handleOfficeMessage(d, MSG, OFFICE), "marked");
  assert.equal(rec.stored.length, 1);
  assert.equal(rec.stored[0].verdict.verdict, "confirmed");
  assert.deepEqual(rec.marked, [["R1", "Registered, thank you"]]);
  assert.equal(rec.alerts.length, 0);
});

test("rejected → stored + alert with lead link, never marked", async () => {
  const { d, rec } = deps({ verdict: { verdict: "rejected", evidence: "already registered by another agency" } });
  assert.equal(await handleOfficeMessage(d, MSG, OFFICE), "alerted");
  assert.equal(rec.marked.length, 0);
  assert.match(rec.alerts[0], /Developer reply needs a look/);
  assert.match(rec.alerts[0], /https:\/\/x\/crm\/leads\/L1/);
});

test("Auto-Submitted header → stored as autoreply, no Claude call, no alert", async () => {
  const { d, rec } = deps();
  assert.equal(await handleOfficeMessage(d, { ...MSG, autoSubmitted: true }, OFFICE), "stored");
  assert.equal(rec.classified, 0);
  assert.equal(rec.stored[0].verdict.verdict, "autoreply");
  assert.equal(rec.alerts.length + rec.marked.length, 0);
});

test("confirmed but already PRELIMINARY → stored, not marked", async () => {
  const { d, rec } = deps({ status: "PRELIMINARY" });
  assert.equal(await handleOfficeMessage(d, MSG, OFFICE), "stored");
  assert.equal(rec.marked.length, 0);
});

test("unmatched office mail is ignored entirely", async () => {
  const { d, rec } = deps({ match: async () => null });
  assert.equal(await handleOfficeMessage(d, MSG, OFFICE), "ignored");
  assert.equal(rec.stored.length + rec.alerts.length + rec.classified, 0);
});

test("already stored message and mail from office itself are ignored", async () => {
  const a = deps({ alreadyStored: async () => true });
  assert.equal(await handleOfficeMessage(a.d, MSG, OFFICE), "ignored");
  const b = deps();
  assert.equal(await handleOfficeMessage(b.d, { ...MSG, from: "Office@CyprusVipEstates.com" }, OFFICE), "ignored");
  assert.equal(a.rec.stored.length + b.rec.stored.length, 0);
});

test("several → one alert, nothing stored, never marked", async () => {
  const { d, rec } = deps({ match: async () => ({ kind: "several", candidates: [{ registrationId: "R1", leadId: "L1" }, { registrationId: "R2", leadId: "L2" }] }) });
  assert.equal(await handleOfficeMessage(d, MSG, OFFICE), "alerted");
  assert.equal(rec.alerts.length, 1);
  assert.match(rec.alerts[0], /several registrations/);
  assert.equal(rec.stored.length + rec.marked.length, 0);
});

test("officeImapCredentials defaults to Hostinger and null without password", () => {
  assert.deepEqual(officeImapCredentials({ EMAIL_USER: "office@c.com", EMAIL_PASSWORD: "p" } as any), { host: "imap.hostinger.com", port: 993, user: "office@c.com", pass: "p" });
  assert.deepEqual(officeImapCredentials({ EMAIL_USER: "office@c.com", EMAIL_PASSWORD: "p", OFFICE_IMAP_HOST: "imap.x.com", OFFICE_IMAP_PORT: "143" } as any), { host: "imap.x.com", port: 143, user: "office@c.com", pass: "p" });
  assert.equal(officeImapCredentials({ EMAIL_USER: "office@c.com" } as any), null);
});

test("staff mailbox: a reply threaded to a registration is skipped, never filed as EMAIL_IN (Review Focus 1)", () => {
  assert.equal(inboundDisposition({ leadId: "L", ambiguous: false, interactionId: "i", registrationThread: true }, false), "skip");
  assert.equal(inboundDisposition({ leadId: "L", ambiguous: false }, false), "file");
  assert.equal(inboundDisposition(null, false), "skip");
  assert.equal(inboundDisposition({ leadId: "L", ambiguous: false }, true), "skip");
});
