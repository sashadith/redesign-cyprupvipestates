import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clientRef, leadRef, partnerRef, redactContactDetails } from "@/lib/chatPrivacy";
import { buildDigestTelegram } from "@/lib/partner/digest";
import { buildInboundLeadTelegramMessage } from "@/lib/leadNotify";
import { parsePcLead, pcTelegram } from "@/lib/privateCollectionLead";
import { buildLeadMessage } from "@/lib/metaLeadgen/notify";
import { buildNagMessage, nagItems } from "@/lib/crm/leadNag";
import { escalateTelegram, unassignedTelegram, type SlaLead } from "@/lib/crm/sla";
import { dueTelegram } from "@/lib/crm/registration/due";
import { reminderTelegram } from "@/lib/crm/registration/reminders";
import { buildPartnerClientNotice } from "@/lib/partner/submitFlow";

/* Why this exists (2026-11-02, privacy T3).
 *
 * Every new enquiry used to reach the office Telegram (a UAE company, no EU
 * adequacy decision) and the team WhatsApp group with the client's name,
 * e-mail, phone and message. The privacy policy now says these alerts carry
 * none of that — a reference and a CRM link only. This file holds the code to
 * that promise: each chat-text builder gets a lead full of personal data, and
 * none of it may come out the other end.
 */

const LEAD_ID = "3f9a2c11-7d4e-4b8a-9c3d-2e1f0a9b8c7d";
const PII = ["Annabel", "Kowalczyk", "annabel.k@example.com", "+49 170 5550123", "4917055501", "Polish", "please call after six"];
const assertNoPii = (text: string, where: string) => {
  for (const v of PII) assert.ok(!text.includes(v), `${where} leaks "${v}"`);
  assert.ok(text.includes(leadRef(LEAD_ID)) || where.startsWith("review"), `${where} should name the lead by its reference`);
};

test("leadRef / partnerRef: a short pseudonymous label", () => {
  assert.equal(leadRef(LEAD_ID), "Lead #3f9a2c");
  assert.equal(partnerRef({ id: LEAD_ID, company: " Acme Realty " }), "Acme Realty");
  assert.equal(partnerRef({ id: LEAD_ID, company: null }), "Partner #3f9a2c");
  assert.equal(clientRef(LEAD_ID), "#3f9a2c");
});

test("redactContactDetails removes e-mail addresses and phone numbers, keeps dates, prices and links", () => {
  const out = redactContactDetails("Call Annabel on +49 170 5550123 or 357 99 123 456, mail annabel.k@example.com — budget €350,000, viewing 2026-11-04 10:30, https://cyprusvipestates.com/admin/crm/3f9a2c11-7d4e");
  assert.ok(!out.includes("5550123") && !out.includes("99 123 456") && !out.includes("@example.com"), out);
  for (const keep of ["€350,000", "2026-11-04 10:30", "https://cyprusvipestates.com/admin/crm/3f9a2c11-7d4e"]) assert.ok(out.includes(keep), `${keep} lost: ${out}`);
});

test("website, partner-form and ROI leads: no contact details in the chat text", () => {
  assertNoPii(buildInboundLeadTelegramMessage({ leadId: LEAD_ID, source: "PARTNER", page: "/en/partners", language: "pl", link: "https://x/admin/crm/" + LEAD_ID }), "inbound lead");
});

test("Private Collection: no contact details or message in the chat text, all of it in the e-mail", () => {
  const r = parsePcLead({ type: "consultation", locale: "en", firstName: "Annabel", lastName: "Kowalczyk", email: "annabel.k@example.com", phone: "+49 170 5550123", considering: "investment", budget: "3-5m", contact: "whatsapp", message: "please call after six" });
  if (!r.ok) throw new Error("parse");
  assertNoPii(pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x", leadId: LEAD_ID }), "PC chat");
  const mail = pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x", leadId: LEAD_ID, withContact: true });
  for (const v of ["Annabel", "annabel.k@example.com", "+49 170 5550123", "please call after six"]) assert.ok(mail.includes(v), `PC e-mail lacks ${v}`);
});

test("Meta lead form: the stored chat text carries no contact details", () => {
  assertNoPii(buildLeadMessage({
    outcome: "CREATED", language: "en", budget: "3-5", preferredChannel: "WHATSAPP", campaignName: "UK Leads", formName: "CVE PC Briefing EN v2",
    placeholderReason: null, unmatchedCount: 0, leadId: LEAD_ID,
  }), "Meta lead");
});

test("office reminders (nag, SLA, registrations): references, never names", () => {
  const DAY = 86_400_000;
  const now = new Date("2026-11-02T08:00:00Z");
  const items = nagItems([{
    id: LEAD_ID, firstName: "Annabel", lastName: "Kowalczyk", status: "CONTACTED", createdAt: new Date(now.getTime() - 30 * DAY),
    lastContactAt: new Date(now.getTime() - 9 * DAY), nextFollowUpAt: new Date(now.getTime() - 2 * DAY), viewingScheduledAt: null, assignedToId: null,
  }], now);
  const nag = buildNagMessage(items, { slot: 10, crmBase: "https://x" })!;
  assertNoPii(nag.text + JSON.stringify(nag.keyboard), "nag");

  const sla: SlaLead = { id: LEAD_ID, name: "Annabel Kowalczyk", status: "NEW", createdAt: now, assignedToId: "u1", ownerName: "Sascha", ownerEmail: "s@x", assignedAt: new Date(now.getTime() - 5 * 3_600_000) } as SlaLead;
  assertNoPii(unassignedTelegram([sla], "https://x"), "SLA unassigned");
  assertNoPii(escalateTelegram([sla], now, "https://x"), "SLA escalate");

  const pair = { developerAccountId: "d1", developerName: "Marinakis", channel: "EMAIL" as const, registrable: true, developmentIds: ["p1"], projects: ["Sea View"], since: new Date(now.getTime() - DAY), lastRemindedAt: null };
  assertNoPii(dueTelegram([{ leadId: LEAD_ID, leadName: "Annabel Kowalczyk", ownerName: "Sascha", pairs: [pair] }], now, "https://x"), "registration due");
  assertNoPii(reminderTelegram([{
    id: "r1", status: "SENT", sentAt: now, reminderSentAt: null, developerName: "Marinakis",
    lead: { id: LEAD_ID, name: "Annabel Kowalczyk", status: "CONTACTED", deletedAt: null, assignedTo: null },
  }], "https://x"), "registration reminder");
});

test("partner-submitted client: the office notice names the partner, not the client", () => {
  assertNoPii(buildPartnerClientNotice({ partnerName: "Acme", mode: "HANDOVER", outcome: "CREATED", leadId: LEAD_ID, baseUrl: "https://x" }), "partner client");
  assertNoPii(buildPartnerClientNotice({ partnerName: "Acme", mode: "FIX", outcome: "REVIEW" }), "review notice");
});

/* Senders that build their text inline. Their chat strings must take the
   lead's reference, not a name field: checked on the source, since these are
   route handlers and server actions with the database behind them. */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const INLINE: Array<[string, string[]]> = [
  ["src/app/api/c/[token]/view/route.ts", ["const name = escapeHtml(leadRef(presentation.leadId));"]],
  ["src/app/api/c/[token]/favorite/route.ts", ["sendTelegramMessage(`❤️ ${escapeHtml(leadRef(presentation.leadId))} favorited"]],
  ["src/app/admin/(panel)/crm/[id]/bookingActions.ts", ["`<b>📅 ${esc(leadRef(leadId))} proposed meeting times</b>", "`${esc(leadRef(booking.leadId))} — was "]],
  ["src/app/api/cron/booking-reminders/route.ts", ["`${esc(leadRef(booking.leadId))} — ${time} (Cyprus time)", "sendTelegramMessage(esc(text(leadRef(booking.leadId))))"]],
  ["src/app/api/cron/action-digest/route.ts", ["escapeHtml(leadRef(b.leadId))", "escapeHtml(t.item.chatTitle ?? t.item.title)"]],
  ["src/lib/crm/assignLead.ts", ["takes <b>${esc(leadRef(lead.id))}</b>"]],
  ["src/lib/emailInbound/processInbound.ts", ["New e-mail reply from ${esc(leadRef(leadId))}"]],
  ["src/lib/emailInbound/officeInbound.ts", ["From ${esc(senderDomain(m.from))}", "about ${esc(leadRef(match.leadId))}"]],
  ["src/app/api/leads/route.ts", ["`${escapeHtml(leadRef(lead.id))}\\n` +"]],
  ["src/lib/mcp/tools/notifyOwnerTelegram.ts", ["deps.send(redactContactDetails(text))"]],
];
const FORBIDDEN = /greetingName\)|esc\(leadName\)|escapeHtml\(fullName \|\||emailNorm\)\}\\nPhone|esc\(ctx\.clientName\)|esc\(excerpt\)|esc\(m\.subject/;

test("inline chat senders use the reference, and the old name interpolations are gone", () => {
  for (const [file, needles] of INLINE) {
    const src = read(file);
    for (const n of needles) assert.ok(src.includes(n), `${file}: expected ${n}`);
    const bad = src.split("\n").filter((l) => FORBIDDEN.test(l) && !/sendEmail|subject:/.test(l));
    assert.deepEqual(bad, [], `${file} puts client data into a chat text`);
  }
});

test("every CRM action item that names a client also has a chatTitle without the name", () => {
  const src = read("src/lib/actionCenter/rules/crm.ts");
  const titles = src.split("\n").filter((l) => /^\s*title: `.*(leadName\(|\.lead\.name)/.test(l)).length;
  const chatTitles = src.split("\n").filter((l) => /^\s*chatTitle: `.*leadRef\(/.test(l)).length;
  assert.ok(titles > 0);
  assert.equal(chatTitles, titles, "a title with a client name lacks its chatTitle twin");
});

/* The partner bot (2026-11-02, operator: "nur Nummer"): a partner's Telegram
   names the client "#3f9a2c" — the portal shows the same number next to the
   name — and a message from the team stays in the portal and the e-mail. */
test("partner bot: the weekly summary on Telegram names clients by reference, the e-mail by name", () => {
  const html = buildDigestTelegram("de", {
    portalUrl: "https://partner.example/home",
    content: { updates: [{ clientName: "Annabel Kowalczyk", clientRef: "#3f9a2c", key: "stages.viewing", at: new Date("2026-11-01T10:00:00Z") }], totals: { expected: 0, earned: 0, developerPaid: 0, paidOut: 0 }, newProjects: [] },
  })!;
  assert.ok(html.includes("#3f9a2c") && !html.includes("Annabel"), html);
});

test("partner bot: every Telegram text builder takes a reference, none a name or a message body", () => {
  for (const f of ["src/lib/partner/telegram.ts", "src/lib/partner/telegramMenu.ts"]) {
    const src = read(f);
    assert.ok(!/clientName|messageBody|\bc\.name\b|\bd\.name\b/.test(src.replace(/\/\/.*$/gm, "")), `${f} still reads a client name or message`);
  }
  const hook = read("src/lib/partner/telegramWebhook.ts");
  assert.equal((hook.match(/ref: clientRef\(c\.id\)/g) ?? []).length, 3, "status, client list and client screen use the reference");
  assert.ok(read("src/lib/partner/digestSend.ts").includes("clientRef: clientRef(m.claimId)"));
});
