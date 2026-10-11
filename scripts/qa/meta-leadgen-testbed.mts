// Meta Lead Ads end-to-end check — TESTBED ONLY (/opt/cvp-testbed, disposable
// DB). Drives the real route handlers (webhook GET/POST, poller GET) against
// the real Prisma schema; only graph.facebook.com is faked. Telegram goes to
// the operator's chat with the "[TEST]" prefix (NOTIFY_PREFIX).
//
//   /opt/cvp-testbed/with-shared-secret.sh TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID -- \
//     npx tsx scripts/qa/meta-leadgen-testbed.mts
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { assertNotProdDb } from "../assert-not-prod-db.mjs";

assertNotProdDb();
const PAGE = "323749517499625";
Object.assign(process.env, {
  META_APP_SECRET: "testbed-app-secret",
  META_WEBHOOK_VERIFY_TOKEN: "testbed-verify",
  META_PAGE_ACCESS_TOKEN: "testbed-fake-token",
  META_PAGE_ID: PAGE,
  NOTIFY_PREFIX: "[TEST]",
  CRON_SECRET: "testbed-cron",
});

const RUN = Date.now().toString(36);
const mail = (n: string) => `meta-test-${RUN}-${n}@example.com`;

// ── Fake Graph API ───────────────────────────────────────────────────────────
const FORMS = [
  { id: "f-de3", name: "CVE PC Briefing DE v3", locale: "de_DE", status: "ACTIVE" },
  { id: "f-en2", name: "CVE PC Briefing EN v2", locale: "en_GB", status: "ACTIVE" },
  { id: "f-kontakt", name: "Kontakt", locale: "de_DE", status: "ARCHIVED" },
];
const DEQ = { b: "welches_investitionsvolumen_planen_sie?", c: "wie_möchten_sie_kontaktiert_werden?" };
const ENQ = { b: "what_investment_volume_are_you_planning?", c: "how_would_you_prefer_to_be_contacted?" };
type L = { id: string; form: string; name: string; email: string; phone?: string; budget: string; contact: string; q: typeof DEQ; campaign: string };
const leadDefs: L[] = [
  { id: `${RUN}-1`, form: "f-en2", name: "Test Richardson", email: mail("en23"), phone: "+447961100123", budget: "€2 to 3 million", contact: "WhatsApp", q: ENQ, campaign: "UK Leads" },
  { id: `${RUN}-2`, form: "f-en2", name: "Test Thompson", email: mail("en35"), phone: "+447961200456", budget: "€3 to 5 million", contact: "Phone call", q: ENQ, campaign: "UK Leads" },
  { id: `${RUN}-3`, form: "f-de3", name: "Test Müller-Lüdenscheidt", email: mail("de5"), phone: "+491701234567", budget: "Über 5 Millionen Euro", contact: "E-Mail", q: DEQ, campaign: "DACH Leads" },
  { id: `${RUN}-4`, form: "f-de3", name: "Testmann", email: mail("de2"), phone: "+43699100000000", budget: "Unter 2 Millionen Euro", contact: "Telefon", q: DEQ, campaign: "DACH Leads" },
  { id: `${RUN}-5`, form: "f-en2", name: "Dup Fixture", email: mail("dup").toUpperCase(), budget: "€2 to 3 million", contact: "Email", q: ENQ, campaign: "UK Leads" },
  { id: `${RUN}-6`, form: "f-kontakt", name: "Old Form", email: mail("old"), budget: "2 bis 3 Millionen Euro", contact: "WhatsApp", q: DEQ, campaign: "—" },
];
const graphLead = (d: L) => ({
  id: d.id,
  created_time: new Date().toISOString().replace("Z", "+0000"),
  form_id: d.form,
  ad_id: "ad-1",
  ad_name: "PC Ad 1",
  adset_name: "PC Adset",
  campaign_name: d.campaign,
  field_data: [
    { name: "email", values: [d.email] },
    { name: "full_name", values: [d.name] },
    ...(d.phone ? [{ name: "phone_number", values: [d.phone] }] : []),
    { name: d.q.b, values: [d.budget] },
    { name: d.q.c, values: [d.contact] },
  ],
});
let graphMode: "ok" | "token" = "ok";
const failingLeads = new Set<string>();
const unlisted = new Set<string>(); // fetchable by id, but outside any listing window
let telegramCalls = 0;
const telegramTexts: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "api.telegram.org") {
    telegramCalls++;
    telegramTexts.push(JSON.parse(String(init?.body)).text);
    return realFetch(input, init);
  }
  if (url.hostname !== "graph.facebook.com") return realFetch(input, init);
  assert.equal(init?.cache, "no-store", "every Graph call must be no-store");
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (graphMode === "token") return json({ error: { code: 190, message: "Error validating access token: Session has expired" } }, 400);
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // drop version
  if (parts[0] === PAGE && parts[1] === "leadgen_forms") return json({ data: FORMS });
  const form = FORMS.find((f) => f.id === parts[0]);
  if (form && parts[1] === "leads") return json({ data: leadDefs.filter((d) => d.form === form.id && !failingLeads.has(d.id) && !unlisted.has(d.id)).map(graphLead) });
  if (form) return json(form);
  const d = leadDefs.find((x) => x.id === parts[0]);
  if (d && failingLeads.has(d.id)) return json({ error: { code: 2, message: "Service temporarily unavailable" } }, 500);
  if (d) return json(graphLead(d));
  return json({ error: { code: 100, message: `unknown object ${parts.join("/")}` } }, 400);
}) as typeof fetch;

// Imports AFTER env + fetch stub.
const { NextRequest } = await import("next/server");
const webhook = await import("../../src/app/api/webhooks/meta-leadgen/route");
const pollRoute = await import("../../src/app/api/cron/meta-leadgen-poll/route");
const { prisma } = await import("../../src/lib/prisma");

const base = "http://127.0.0.1:3200";
const sign = (body: string, secret = "testbed-app-secret") => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const event = (ids: string[]) =>
  JSON.stringify({ object: "page", entry: [{ id: PAGE, time: Date.now(), changes: ids.map((id) => ({ field: "leadgen", value: { leadgen_id: id, form_id: leadDefs.find((d) => d.id === id)?.form, page_id: PAGE, ad_id: "ad-1" } })) }] });
const post = (body: string, sig: string | null) =>
  webhook.POST(new NextRequest(`${base}/api/webhooks/meta-leadgen`, { method: "POST", body, headers: sig ? { "x-hub-signature-256": sig } : {} }));
const poll = async (extra = "") => (await pollRoute.GET(new NextRequest(`${base}/api/cron/meta-leadgen-poll?key=testbed-cron${extra}`))).json();
const leadsFor = (email: string) => prisma.lead.findMany({ where: { email: { equals: email, mode: "insensitive" } }, include: { interactions: true } });
const step = (s: string) => console.log(`\n── ${s}`);

// Keep the email-inbound watchdog quiet: the DB copy's last row is hours old.
await prisma.cronRunLog.create({ data: { job: "email-inbound", ok: true, message: "testbed fixture" } });

step("1. webhook verification (GET)");
let r = await webhook.GET(new NextRequest(`${base}/api/webhooks/meta-leadgen?hub.mode=subscribe&hub.verify_token=testbed-verify&hub.challenge=1158201444`));
assert.equal(r.status, 200);
assert.equal(await r.text(), "1158201444");
r = await webhook.GET(new NextRequest(`${base}/api/webhooks/meta-leadgen?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=1`));
assert.equal(r.status, 403);
console.log("✓ right token → 200 + challenge, wrong token → 403");

step("2. POST signature");
const b1 = event([leadDefs[0].id]);
assert.equal((await post(b1, null)).status, 401);
assert.equal((await post(b1, sign(b1, "wrong-secret"))).status, 401);
assert.equal((await post(b1 + " ", sign(b1))).status, 401);
assert.equal(await prisma.metaLeadgenEvent.count({ where: { leadgenId: leadDefs[0].id } }), 0, "nothing processed on a bad signature");
console.log("✓ missing / wrong-secret / tampered → 401, nothing processed");

step("3. valid webhooks: EN 2–3M WhatsApp, EN 3–5M Phone, DE >5M E-Mail, DE <2M one-word name + placeholder phone");
for (const d of leadDefs.slice(0, 4)) {
  const body = event([d.id]);
  const res = await post(body, sign(body));
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.results[0].status, "created", JSON.stringify(j));
}
const expect = [
  { d: leadDefs[0], first: "Test", last: "Richardson", min: 2_000_000, max: 3_000_000, ch: "WHATSAPP", lang: "en", country: "GB" },
  { d: leadDefs[1], first: "Test", last: "Thompson", min: 3_000_000, max: 5_000_000, ch: "PHONE", lang: "en", country: "GB" },
  { d: leadDefs[2], first: "Test", last: "Müller-Lüdenscheidt", min: 5_000_000, max: null, ch: "EMAIL", lang: "de", country: "DE" },
  { d: leadDefs[3], first: "Testmann", last: "", min: null, max: 2_000_000, ch: "PHONE", lang: "de", country: "AT" },
];
for (const e of expect) {
  const [l, ...more] = await leadsFor(e.d.email);
  assert.equal(more.length, 0);
  assert.deepEqual(
    [l.firstName, l.lastName, l.budgetMin, l.budgetMax, l.preferredChannel, l.languagePreference, l.countryOfResidence, l.source, l.status],
    [e.first, e.last, e.min, e.max, e.ch, e.lang, e.country, "META_LEAD_AD", "NEW"],
    e.d.name,
  );
  const ix = l.interactions.find((i) => i.subject === "Meta lead form submitted")!;
  assert.ok(ix, "timeline entry");
  assert.equal(ix.type, "SYSTEM");
  const meta = ix.metadata as Record<string, unknown>;
  assert.equal(meta.leadgenId, e.d.id);
  assert.equal(meta.campaignName, e.d.campaign);
  assert.match(ix.body!, /All answers:/);
  console.log(`✓ ${e.d.name}: ${e.first}|${e.last}| ${e.min}-${e.max} ${e.ch} ${e.lang} ${e.country}`);
}
const tm = (await leadsFor(leadDefs[3].email))[0];
assert.match(tm.interactions.find((i) => i.subject === "Meta lead form submitted")!.body!, /phone looks like a placeholder/);
assert.equal(tm.phone, "+43699100000000", "placeholder kept, not dropped");
assert.match(telegramTexts.join("\n"), /below Private Collection threshold/);
assert.match(telegramTexts.join("\n"), /New Private Collection lead \(DACH\)/);
assert.match(telegramTexts.join("\n"), /New Private Collection lead \(UK\)/);
assert.equal(telegramCalls, 4);
assert.ok(telegramTexts.every((t) => t.startsWith("[TEST]")), "every testbed Telegram carries [TEST]");
console.log("✓ placeholder flagged in timeline + kept; 4 Telegram messages, all [TEST]");

step("4. idempotency: same event twice → one lead, one Telegram");
const again = event([leadDefs[0].id]);
const j4 = await (await post(again, sign(again))).json();
assert.equal(j4.results[0].status, "skipped");
assert.equal((await leadsFor(leadDefs[0].email)).length, 1);
assert.equal(telegramCalls, 4);
// Two paths racing for the same new id: exactly one wins.
const raceDef = leadDefs[5];
const raceBody = event([raceDef.id]);
const [ra, rb] = await Promise.all([post(raceBody, sign(raceBody)), post(raceBody, sign(raceBody))]);
const statuses = [(await ra.json()).results[0].status, (await rb.json()).results[0].status].sort();
assert.deepEqual(statuses, ["created", "skipped"], `race: ${statuses}`);
assert.equal((await leadsFor(raceDef.email)).length, 1);
assert.equal(telegramCalls, 5);
console.log("✓ repeat → skipped; concurrent double delivery → 1 created + 1 skipped; archived 'Kontakt' form processed");

step("5. duplicate by email → interaction on the existing lead, no new lead");
const fixture = await prisma.lead.create({ data: { firstName: "Dup", lastName: "Fixture", email: mail("dup"), source: "MANUAL", status: "CONTACTED" } });
const dupBody = event([leadDefs[4].id]);
const j5 = await (await post(dupBody, sign(dupBody))).json();
assert.equal(j5.results[0].status, "attached");
assert.equal(j5.results[0].leadId, fixture.id);
const dupLeads = await leadsFor(mail("dup"));
assert.equal(dupLeads.length, 1, "no second lead (upper-case email still matched)");
assert.equal(dupLeads[0].status, "CONTACTED", "status untouched");
assert.equal(dupLeads[0].source, "MANUAL", "source untouched");
assert.ok(dupLeads[0].interactions.some((i) => i.subject === "Meta lead form submitted"));
assert.equal((await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId: leadDefs[4].id } }))!.outcome, "ATTACHED");
assert.match(telegramTexts.at(-1)!, /Existing lead submitted the form again/);
console.log("✓ attached to existing lead, status/source unchanged, Telegram says 'Existing lead…'");

step("6. poller over everything → all already done, nothing new, no Telegram");
const before = telegramCalls;
const p6 = await poll();
assert.equal(p6.ok, true, JSON.stringify(p6));
assert.equal(p6.forms, 3);
assert.equal(p6.created + p6.attached, 0, JSON.stringify(p6));
assert.equal(p6.skipped, 6);
assert.equal(telegramCalls, before);
console.log(`✓ ${JSON.stringify({ forms: p6.forms, seen: p6.seen, skipped: p6.skipped })}`);

step("7. Graph failure for one lead → FAILED + one alert; retry → no 2nd alert; recovery → created");
const failDef = { ...leadDefs[0], id: `${RUN}-7`, name: "Test Failing", email: mail("fail") };
leadDefs.push(failDef);
failingLeads.add(failDef.id);
const fb = event([failDef.id]);
const j7 = await (await post(fb, sign(fb))).json();
assert.equal(j7.results[0].status, "failed");
let ev = await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId: failDef.id } });
assert.equal(ev!.status, "FAILED");
assert.ok(ev!.alertedAt, "alert sent");
const afterAlert = telegramCalls;
assert.match(telegramTexts.at(-1)!, new RegExp(`leadgen_id: ${failDef.id}`));
await post(fb, sign(fb)); // Meta retry, still failing
assert.equal(telegramCalls, afterAlert, "no second alert for the same leadgen_id");
failingLeads.delete(failDef.id);
const p7 = await poll();
assert.equal(p7.created, 1, JSON.stringify(p7));
ev = await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId: failDef.id } });
assert.equal(ev!.status, "DONE");
assert.equal(ev!.attempts, 3);
assert.equal((await leadsFor(failDef.email)).length, 1);
console.log("✓ failed → alerted once → poller recovered it (attempts 3)");

step("8. token invalid (code 190) → dedicated alert, once");
graphMode = "token";
const t0 = telegramCalls;
const p8 = await poll();
assert.equal(p8.ok, false);
assert.ok(p8.tokenError);
assert.equal(telegramCalls, t0 + 1);
assert.match(telegramTexts.at(-1)!, /Meta lead token invalid — leads are not being imported/);
await poll();
assert.equal(telegramCalls, t0 + 1, "throttled: no repeat within a day");
graphMode = "ok";
console.log("✓ token alert sent once, not repeated");

step("9. Telegram owed after an outage → poller re-sends");
const owed = await prisma.metaLeadgenEvent.update({ where: { leadgenId: leadDefs[1].id }, data: { telegramSentAt: null } });
const t1 = telegramCalls;
await poll();
assert.equal(telegramCalls, t1 + 1);
assert.ok((await prisma.metaLeadgenEvent.findUnique({ where: { leadgenId: owed.leadgenId } }))!.telegramSentAt);
console.log("✓ owed notification re-sent and stamped");

step("10. auth + sinceHours");
assert.equal((await pollRoute.GET(new NextRequest(`${base}/api/cron/meta-leadgen-poll?key=wrong`))).status, 401);
assert.equal((await poll("&sinceHours=168")).sinceHours, 168);
console.log("✓ wrong key → 401; sinceHours=168 honoured");

step("11. aged-out FAILED lead: not in any listing any more → swept by id");
const agedDef = { ...leadDefs[0], id: `${RUN}-11`, name: "Test Aged", email: mail("aged") };
leadDefs.push(agedDef);
failingLeads.add(agedDef.id);
const ab = event([agedDef.id]);
assert.equal((await (await post(ab, sign(ab))).json()).results[0].status, "failed");
failingLeads.delete(agedDef.id);
unlisted.add(agedDef.id);
const p11 = await poll();
assert.equal(p11.swept, 1, JSON.stringify(p11));
assert.equal(p11.created, 1);
assert.equal((await leadsFor(agedDef.email)).length, 1);
console.log("✓ FAILED row outside the window retried by id and imported");

step("12. newsletter subscriber with the same email → new real lead, not a note on the newsletter row");
await prisma.lead.create({ data: { firstName: "News", lastName: "Letter", email: mail("news"), source: "NEWSLETTER" } });
const newsDef = { ...leadDefs[0], id: `${RUN}-12`, name: "Test Newsletter", email: mail("news") };
leadDefs.push(newsDef);
const nb = event([newsDef.id]);
assert.equal((await (await post(nb, sign(nb))).json()).results[0].status, "created");
assert.deepEqual((await leadsFor(mail("news"))).map((l) => l.source).sort(), ["META_LEAD_AD", "NEWSLETTER"]);
console.log("✓ newsletter row ignored for matching, META_LEAD_AD lead created");

step("13. LOST lead submits again → attached and reopened as NEW; CLOSED left alone");
const lost = await prisma.lead.create({ data: { firstName: "Lost", lastName: "Lead", email: mail("lost"), source: "MANUAL", status: "LOST" } });
const closed = await prisma.lead.create({ data: { firstName: "Closed", lastName: "Lead", email: mail("closed"), source: "MANUAL", status: "CLOSED" } });
const lostDef = { ...leadDefs[0], id: `${RUN}-13a`, name: "Lost Lead", email: mail("lost") };
const closedDef = { ...leadDefs[0], id: `${RUN}-13b`, name: "Closed Lead", email: mail("closed") };
leadDefs.push(lostDef, closedDef);
const lb = event([lostDef.id, closedDef.id]);
const j13 = await (await post(lb, sign(lb))).json();
assert.deepEqual(j13.results.map((x: { status: string }) => x.status), ["attached", "attached"]);
assert.equal((await prisma.lead.findUnique({ where: { id: lost.id } }))!.status, "NEW");
assert.equal((await prisma.lead.findUnique({ where: { id: closed.id } }))!.status, "CLOSED");
assert.match(telegramTexts.join("\n"), /was LOST — reopened as NEW/);
assert.match(telegramTexts.join("\n"), /lead status is CLOSED/);
console.log("✓ LOST → NEW with STATUS_CHANGE entry; CLOSED untouched and named in Telegram");

step("14. same email, two different leadgen_ids at the same moment → one lead");
const twinA = { ...leadDefs[0], id: `${RUN}-14a`, name: "Twin Submit", email: mail("twin") };
const twinB = { ...leadDefs[2], id: `${RUN}-14b`, name: "Twin Submit", email: mail("twin") };
leadDefs.push(twinA, twinB);
const ta = event([twinA.id]);
const tb = event([twinB.id]);
const tw = await Promise.all([post(ta, sign(ta)), post(tb, sign(tb))]);
const twStatuses = (await Promise.all(tw.map((x) => x.json()))).map((x) => x.results[0].status).sort();
assert.deepEqual(twStatuses, ["attached", "created"], String(twStatuses));
assert.equal((await leadsFor(mail("twin"))).length, 1);
console.log("✓ advisory lock: 1 created + 1 attached");

step("15. after an outage the window widens automatically");
await prisma.cronRunLog.updateMany({ where: { job: "meta-leadgen-poll" }, data: { ranAt: new Date(Date.now() - 5 * 86_400_000) } });
const p15 = await poll();
assert.ok(p15.sinceHours >= 120 && p15.sinceHours <= 122, String(p15.sinceHours));
assert.equal((await poll()).sinceHours, 48, "back to 48 h once a run listed the forms again");
console.log(`✓ window ${p15.sinceHours} h after a 5-day gap, then 48 h again`);

const rows = await prisma.cronRunLog.findMany({ where: { job: "meta-leadgen-poll" }, orderBy: { ranAt: "desc" }, take: 3 });
console.log("\ncron log:", rows.map((x) => `${x.ok ? "ok" : "FAIL"} ${x.message}`));
console.log(`\nALL CHECKS PASSED — ${telegramCalls} [TEST] Telegram message(s) sent`);
await prisma.$disconnect();
