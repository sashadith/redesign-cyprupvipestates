import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcLead, pcTelegram, pcTimelineBody } from "@/lib/privateCollectionLead";

/* Private Collection enquiries go to the CRM instead of Monday (2026-10-15).
   The slugs are the ones the Private Collection form actually sends. */
const form = { type: "consultation", locale: "de", firstName: " Anna ", lastName: "Müller", email: "Anna@Example.COM", phone: "+49 170 1234567", considering: "investment", budget: "3-5m", contact: "whatsapp", message: "Bitte <Rückruf> & Unterlagen" };

test("maps every form option onto our fields", () => {
  const r = parsePcLead(form);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(
    { ...r.lead },
    { kind: "consultation", firstName: "Anna", lastName: "Müller", email: "anna@example.com", phone: "+49 170 1234567", languagePreference: "de", budgetKey: "3-5m", budgetMin: 3_000_000, budgetMax: 5_000_000, purpose: "Investment", preferredChannel: "WHATSAPP", message: "Bitte <Rückruf> & Unterlagen" },
  );
});

test("all four budget brackets and all three channels", () => {
  const b = (budget: string) => { const r = parsePcLead({ ...form, budget }); return r.ok ? [r.lead.budgetMin, r.lead.budgetMax] : null; };
  assert.deepEqual(b("below-2m"), [null, 2_000_000]);
  assert.deepEqual(b("2-3m"), [2_000_000, 3_000_000]);
  assert.deepEqual(b("5m-plus"), [5_000_000, null]);
  const c = (contact: string) => { const r = parsePcLead({ ...form, contact }); return r.ok ? r.lead.preferredChannel : null; };
  assert.deepEqual([c("call"), c("email"), c("whatsapp")], ["PHONE", "EMAIL", "WHATSAPP"]);
});

test("unknown slugs are never guessed — kept raw for the timeline", () => {
  const r = parsePcLead({ ...form, budget: "10m", considering: "yacht", contact: "pigeon" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.lead.budgetMin, null);
  assert.equal(r.lead.purpose, null);
  assert.equal(r.lead.preferredChannel, null);
  const body = pcTimelineBody(r.lead, r.raw, "CREATED");
  assert.match(body, /Budget: 10m \(unmapped\)/);
  assert.match(body, /Purpose: yacht \(unmapped\)/);
  assert.match(body, /Prefers: pigeon \(unmapped\)/);
});

test("name and a valid email are required", () => {
  assert.equal(parsePcLead({ ...form, firstName: "" }).ok, false);
  assert.equal(parsePcLead({ ...form, email: "not-an-email" }).ok, false);
  assert.equal(parsePcLead(null).ok, false);
});

test("the Telegram text names the client, no contact details, escapes user input and links the CRM", () => {
  const r = parsePcLead(form);
  if (!r.ok) throw new Error("parse");
  const t = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x/admin/crm/L1", leadId: "3f9a2c11-1" });
  assert.match(t, /New Private Collection enquiry/);
  assert.ok(t.includes(`<b>${r.lead.firstName} ${r.lead.lastName}`.trim()), t);
  assert.match(t, /Budget: €3–5M · Purpose: Investment · Prefers: WhatsApp/);
  assert.match(t, /Message: yes, see CRM/);
  assert.match(t, /<a href="https:\/\/x\/admin\/crm\/L1">/);
  for (const v of [r.lead.email, r.lead.phone, "Rückruf"]) if (v) assert.ok(!t.includes(v), `chat text leaks ${v}`);
  // The team e-mail reuses the text with the details put back, escaped.
  const mail = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "x", leadId: "3f9a2c11-1", withContact: true });
  assert.ok(mail.includes(r.lead.email));
  assert.match(mail, /Bitte &lt;Rückruf&gt; &amp; Unterlagen/);
  assert.match(pcTelegram(r.lead, { outcome: "ATTACHED", crmLink: "x", leadId: "L", priorStatus: "CONTACTED" }), /Existing lead[\s\S]*status is CONTACTED/);
});

test("a briefing download (2026-11-02) is its own kind: guide-lead texts, name but no e-mail in the chat", () => {
  const r = parsePcLead({ type: "briefing", source: "briefing", locale: "de", firstName: "Annabel", email: "Annabel.K@example.com" });
  if (!r.ok) throw new Error("parse");
  assert.equal(r.lead.kind, "briefing");
  const chat = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x/admin/crm/3f9a2c11", leadId: "3f9a2c11-1" });
  assert.match(chat, /briefing download/);
  assert.match(chat, /<b>Annabel<\/b>/);
  assert.match(chat, /Language: de/);
  assert.ok(!chat.includes("example.com"), chat);
  const mail = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "x", leadId: "3f9a2c11-1", withContact: true });
  assert.ok(mail.includes("Annabel") && mail.includes("annabel.k@example.com"), mail);
  assert.match(pcTimelineBody(r.lead, r.raw, "ATTACHED"), /^Existing lead downloaded the Private Collection briefing\.\nLanguage: de$/);

  const consultation = parsePcLead({ locale: "en", firstName: "A", email: "a@b.cy" });
  assert.equal(consultation.ok && consultation.lead.kind, "consultation");
});

test("the webhook files a briefing as a guide lead and never reopens a LOST lead for it", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/api/webhooks/private-collection-lead/route.ts", "utf8");
  assert.ok(src.includes(`source: briefing ? "GUIDE_DOWNLOAD" : "PRIVATE_COLLECTION"`));
  assert.ok(src.includes(`guideTitle: PC_BRIEFING_TITLE`));
  assert.ok(src.includes(`if (dup.status === "LOST" && !briefing)`));
  // …and a later enquiry from the same reader promotes the guide lead.
  assert.ok(src.includes(`if (cur?.source === "GUIDE_DOWNLOAD") {`) && src.includes(`source: "PRIVATE_COLLECTION",\n                ...(!cur.lastName`));
});
