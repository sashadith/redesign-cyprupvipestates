import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLead, BUDGET_ERROR, CAP_REACHED, type RegisterDeps, type RegDeveloper } from "@/lib/crm/registration/register";

const A = { userId: "u1", userName: "Sascha Dith" };
const DEVS: RegDeveloper[] = [
  { id: "D1", name: "Marinakis", contactPerson: null, registrationChannel: "EMAIL", registrationEmailTo: ["sales@marinakisproperty.com"], registrationEmailCc: ["mvenizelou@marinakisproperty.com"], registrationWhatsApp: [] },
  { id: "DWA", name: "Pafilia", contactPerson: "Ben", registrationChannel: "WHATSAPP", registrationEmailTo: [], registrationEmailCc: [], registrationWhatsApp: ["+35799111222", "+35799333444"] },
  { id: "DN", name: "Kuutio", contactPerson: null, registrationChannel: "NONE", registrationEmailTo: [], registrationEmailCc: [], registrationWhatsApp: [] },
];
const DEVTS = [
  { id: "P1", publicName: "Vista", developerAccountId: "D1" },
  { id: "P2", publicName: "Blue", developerAccountId: "D1" },
];

type Calls = { emails: any[]; whatsapp: [string, string][]; sent: any[]; failed: [string, string][]; claims: any[] };

function fakeDeps(over: Partial<RegisterDeps> = {}, phone: string | null = "+35799278285"): { deps: RegisterDeps; calls: Calls } {
  const calls: Calls = { emails: [], whatsapp: [], sent: [], failed: [], claims: [] };
  const deps: RegisterDeps = {
    loadLead: async () => ({ id: "L", firstName: "Anna", lastName: "Muster", phone }),
    loadDevelopers: async (ids) => DEVS.filter((d) => ids.includes(d.id)),
    loadDevelopments: async (ids) => DEVTS.filter((d) => ids.includes(d.id)),
    claimRecord: async (i) => { calls.claims.push(i); return { id: `R-${i.developerAccountId}` }; },
    sendEmail: async (m) => { calls.emails.push(m); return { messageId: "<m1@x>" }; },
    sendWhatsApp: async (n, t) => { calls.whatsapp.push([n, t]); },
    countWhatsAppToday: async () => 0,
    dailyCap: 25,
    recordSent: async (i) => { calls.sent.push(i); },
    recordFailed: async (id, e) => { calls.failed.push([id, e]); },
    ...over,
  };
  return { deps, calls };
}

const pick = (developerAccountId: string, developmentIds: string[] = []) => ({ developerAccountId, developmentIds });

test("one email per developer, all its projects in one message, masked phone only", async () => {
  const { deps, calls } = fakeDeps();
  const r = await registerLead(deps, { leadId: "L", picks: [pick("D1", ["P1"]), pick("D1", ["P2"])], budgetMin: "", budgetMax: 500000, actor: A });
  assert.deepEqual(r, { ok: true, outcomes: [{ developerAccountId: "D1", developerName: "Marinakis", result: "sent" }] });
  assert.equal(calls.emails.length, 1);
  const m = calls.emails[0];
  assert.deepEqual(m.to, ["sales@marinakisproperty.com"]);
  assert.deepEqual(m.cc, ["mvenizelou@marinakisproperty.com"]);
  assert.match(m.text, /Preferred project: Vista, Blue/);
  assert.match(m.text, /Phone: \+357XXXX8285/);
  assert.match(m.text, /Budget: up to €500,000/);
  assert.doesNotMatch(m.text, /99278285/);
  assert.equal(calls.sent[0].messageId, "<m1@x>");
  assert.equal(calls.sent[0].channel, "email");
  assert.deepEqual(calls.claims[0].developmentIds, ["P1", "P2"]);
});

test("second claim of the same developer reports already and sends nothing", async () => {
  const { deps, calls } = fakeDeps({ claimRecord: async () => "already" });
  const r = await registerLead(deps, { leadId: "L", picks: [pick("D1")], budgetMin: null, budgetMax: null, actor: A });
  assert.ok(r.ok && r.outcomes[0].result === "already");
  assert.equal(calls.emails.length, 0);
});

test("WhatsApp cap hit: that developer FAILED with the exact reason, email developer still sent", async () => {
  const { deps, calls } = fakeDeps({ countWhatsAppToday: async () => 25, dailyCap: 25 });
  const r = await registerLead(deps, { leadId: "L", picks: [pick("DWA"), pick("D1")], budgetMin: null, budgetMax: null, actor: A });
  assert.ok(r.ok);
  assert.deepEqual(r.outcomes.map((o) => o.result), ["failed", "sent"]);
  assert.deepEqual(calls.failed, [["R-DWA", CAP_REACHED]]);
  assert.equal(calls.whatsapp.length, 0);
  assert.equal(calls.emails.length, 1);
});

test("WhatsApp to two numbers, one fails: sent, partial error recorded", async () => {
  const { deps, calls } = fakeDeps({ sendWhatsApp: async (n) => { if (n === "+35799333444") throw new Error("gateway 500"); } });
  const r = await registerLead(deps, { leadId: "L", picks: [pick("DWA")], budgetMin: null, budgetMax: null, actor: A });
  assert.ok(r.ok && r.outcomes[0].result === "sent");
  assert.deepEqual(calls.sent[0].to, ["+35799111222"]);
  assert.match(calls.sent[0].partialError, /\+35799333444: gateway 500/);
  assert.equal(calls.sent[0].messageId, null);
  assert.match(calls.sent[0].text, /^Dear Ben,/);
});

test("the cap counts numbers already sent in this run", async () => {
  const { deps, calls } = fakeDeps({ countWhatsAppToday: async () => 24, dailyCap: 25 });
  const r = await registerLead(deps, { leadId: "L", picks: [pick("DWA")], budgetMin: null, budgetMax: null, actor: A });
  assert.ok(r.ok && r.outcomes[0].result === "sent");
  assert.equal(calls.whatsapp.length, 1);
  assert.match(calls.sent[0].partialError, new RegExp(CAP_REACHED));
});

test("an email send that throws marks FAILED and does not stop the next developer", async () => {
  const { deps, calls } = fakeDeps({ sendEmail: async () => { throw new Error("SMTP down"); } });
  const r = await registerLead(deps, { leadId: "L", picks: [pick("D1"), pick("DWA")], budgetMin: null, budgetMax: null, actor: A });
  assert.ok(r.ok);
  assert.deepEqual(r.outcomes.map((o) => [o.result, o.error]), [["failed", "SMTP down"], ["sent", undefined]]);
  assert.deepEqual(calls.failed, [["R-D1", "SMTP down"]]);
});

test("lead without international phone is refused before any claim", async () => {
  const { deps, calls } = fakeDeps({}, "99278285");
  const r = await registerLead(deps, { leadId: "L", picks: [pick("D1")], budgetMin: null, budgetMax: null, actor: A });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && /international format/i.test(r.error));
  assert.equal(calls.claims.length, 0);
});

test("budget text is refused", async () => {
  const { deps, calls } = fakeDeps();
  const r = await registerLead(deps, { leadId: "L", picks: [pick("D1")], budgetMin: "call +35799278285", budgetMax: null, actor: A });
  assert.deepEqual(r, { ok: false, error: BUDGET_ERROR });
  assert.equal(calls.claims.length, 0);
});

test("developer without channel is refused by name", async () => {
  const { deps } = fakeDeps();
  const r = await registerLead(deps, { leadId: "L", picks: [pick("DN")], budgetMin: null, budgetMax: null, actor: A });
  assert.deepEqual(r, { ok: false, error: "Kuutio has no registration channel set." });
});

test("a project picked under the wrong developer is refused", async () => {
  const { deps } = fakeDeps();
  const r = await registerLead(deps, { leadId: "L", picks: [pick("DWA", ["P1"])], budgetMin: null, budgetMax: null, actor: A });
  assert.equal(r.ok, false);
});
