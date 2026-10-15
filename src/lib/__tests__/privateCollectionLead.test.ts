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
    { firstName: "Anna", lastName: "Müller", email: "anna@example.com", phone: "+49 170 1234567", languagePreference: "de", budgetKey: "3-5m", budgetMin: 3_000_000, budgetMax: 5_000_000, purpose: "Investment", preferredChannel: "WHATSAPP", message: "Bitte <Rückruf> & Unterlagen" },
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

test("the Telegram text escapes user input and links the CRM", () => {
  const r = parsePcLead(form);
  if (!r.ok) throw new Error("parse");
  const t = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x/admin/crm/L1" });
  assert.match(t, /New Private Collection enquiry/);
  assert.match(t, /Budget: €3–5M · Purpose: Investment · Prefers: WhatsApp/);
  assert.match(t, /Bitte &lt;Rückruf&gt; &amp; Unterlagen/);
  assert.match(t, /<a href="https:\/\/x\/admin\/crm\/L1">/);
  assert.match(pcTelegram(r.lead, { outcome: "ATTACHED", crmLink: "x", priorStatus: "CONTACTED" }), /Existing lead[\s\S]*status is CONTACTED/);
});
