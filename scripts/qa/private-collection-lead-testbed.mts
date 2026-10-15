// Private Collection enquiry → CRM, end to end — TESTBED ONLY (/opt/cvp-testbed,
// disposable DB). Drives the real route handler; Telegram and OpenWA are faked
// in a fetch stub, e-mail points at a closed port (fails, as allowed).
//
//   npx tsx scripts/qa/private-collection-lead-testbed.mts
import assert from "node:assert/strict";
import { assertNotProdDb } from "../assert-not-prod-db.mjs";

assertNotProdDb();
Object.assign(process.env, {
  PC_LEAD_SECRET: "qa-secret",
  TELEGRAM_BOT_TOKEN: "dummy", TELEGRAM_CHAT_ID: "1",
  OPENWA_BASE_URL: "http://openwa.qa.invalid", OPENWA_API_KEY: "owa_k1_qa", OPENWA_SESSION_ID: "s", OPENWA_DAILY_SEND_CAP: "5",
  META_LEAD_WHATSAPP_CHAT: "1203@g.us",
  EMAIL_HOST: "127.0.0.1", EMAIL_PORT: "9", EMAIL_SECURE: "false", EMAIL_USER: "qa@example.com", EMAIL_PASSWORD: "x",
});
const tg: string[] = [], wa: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const ok = () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.hostname === "api.telegram.org") { tg.push(JSON.parse(String(init?.body)).text); return ok(); }
  if (url.hostname === "openwa.qa.invalid") { wa.push(JSON.parse(String(init?.body)).text); return ok(); }
  return realFetch(input, init);
}) as typeof fetch;

const { NextRequest } = await import("next/server");
const { POST } = await import("../../src/app/api/webhooks/private-collection-lead/route");
const { prisma } = await import("../../src/lib/prisma");
const RUN = Date.now().toString(36);
const mail = (n: string) => `pc-qa-${RUN}-${n}@example.com`;
const post = (body: unknown, secret: string | null = "qa-secret") =>
  POST(new NextRequest("http://x/api/webhooks/private-collection-lead", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(body) }));
const form = (n: string, extra: Record<string, string> = {}) => ({ type: "consultation", locale: "en", firstName: "Pc", lastName: `Tester ${n}`, email: mail(n), phone: "", considering: "relocation", budget: "2-3m", contact: "call", message: "Hello", ...extra });
const step = (s: string) => console.log(`── ${s}`);

step("1. auth and validation");
assert.equal((await post(form("a"), null)).status, 401);
assert.equal((await post(form("a"), "wrong-secret")).status, 401);
assert.equal((await post({ firstName: "", email: "x" })).status, 400);
assert.equal(await prisma.lead.count({ where: { email: mail("a") } }), 0, "nothing written on 401/400");
console.log("✓ 401 without / with a wrong secret, 400 on invalid input, nothing written");

step("2. new enquiry → lead with source PRIVATE_COLLECTION, timeline, notifications");
let r = await (await post(form("a"))).json();
assert.equal(r.ok, true);
assert.equal(r.outcome, "CREATED");
const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId }, include: { interactions: true, activities: true } });
assert.equal(lead.source, "PRIVATE_COLLECTION");
assert.equal(lead.status, "NEW");
assert.deepEqual([lead.budgetMin, lead.budgetMax, lead.preferredChannel, lead.languagePreference], [2_000_000, 3_000_000, "PHONE", "en"]);
assert.match(lead.message ?? "", /Purpose: Relocation[\s\S]*Hello/);
assert.ok(lead.interactions.some((i) => i.subject === "Private Collection enquiry" && /Budget: €2–3M/.test(i.body ?? "")));
assert.ok(lead.activities.some((a) => a.type === "INBOUND"));
assert.equal(lead.telegramNotified, true);
assert.equal(tg.length, 1);
assert.equal(wa.length, 1);
assert.match(wa[0], /\*New Private Collection enquiry\*/);
assert.match(wa[0], /\/admin\/crm\//);
console.log("✓ lead created with budget/channel/language/purpose, timeline + activity, Telegram + WhatsApp (e-mail failed as staged, answer still ok)");

step("3. same email again → attached to the existing lead, no new lead");
r = await (await post(form("a", { message: "Second message" }))).json();
assert.equal(r.outcome, "ATTACHED");
assert.equal(r.leadId, lead.id);
assert.equal(await prisma.lead.count({ where: { email: mail("a"), deletedAt: null } }), 1);
assert.equal(await prisma.leadInteraction.count({ where: { leadId: lead.id, subject: "Private Collection enquiry" } }), 2);
assert.match(tg.at(-1)!, /Existing lead sent the Private Collection enquiry again/);
console.log("✓ attached, one lead, two enquiry entries, Telegram says 'Existing lead…'");

step("4. a LOST lead asking again goes back to NEW");
await prisma.lead.update({ where: { id: lead.id }, data: { status: "LOST" } });
r = await (await post(form("a"))).json();
assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "NEW");
assert.ok(await prisma.leadInteraction.findFirst({ where: { leadId: lead.id, type: "STATUS_CHANGE", body: { contains: "LOST → NEW" } } }));
console.log("✓ LOST → NEW with a STATUS_CHANGE entry");

step("5. two identical submissions at the same moment → one lead");
const [x, y] = await Promise.all([post(form("race")), post(form("race"))]);
const outcomes = [(await x.json()).outcome, (await y.json()).outcome].sort();
assert.deepEqual(outcomes, ["ATTACHED", "CREATED"]);
assert.equal(await prisma.lead.count({ where: { email: mail("race"), deletedAt: null } }), 1);
console.log("✓ advisory lock: 1 created + 1 attached");

await prisma.lead.updateMany({ where: { email: { startsWith: `pc-qa-${RUN}` } }, data: { deletedAt: new Date() } });
console.log(`\nALL CHECKS PASSED — ${tg.length} Telegram / ${wa.length} WhatsApp (faked)`);
await prisma.$disconnect();
