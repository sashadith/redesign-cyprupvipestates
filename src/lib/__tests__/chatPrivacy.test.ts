import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leadLabel, leadRef, redactContactDetails } from "@/lib/chatPrivacy";
import { buildDigestTelegram } from "@/lib/partner/digest";
import { buildInboundLeadTelegramMessage } from "@/lib/leadNotify";
import { parsePcLead, pcTelegram } from "@/lib/privateCollectionLead";
import { buildLeadMessage } from "@/lib/metaLeadgen/notify";
import { buildNagMessage, nagItems } from "@/lib/crm/leadNag";
import { escalateTelegram, unassignedTelegram, type SlaLead } from "@/lib/crm/sla";
import { dueTelegram } from "@/lib/crm/registration/due";
import { reminderTelegram } from "@/lib/crm/registration/reminders";
import { buildPartnerClientNotice } from "@/lib/partner/submitFlow";

/* History: privacy T3 (2026-11-02) took client data out of the office chats;
 * the operator restored it on 2026-11-03 ("Ich will die Nachrichten so haben
 * wie vorher. Mit Telefonnummer und email adresse"). Office alerts (Telegram +
 * team WhatsApp group) carry name, e-mail, phone and message again; the
 * partner bot names clients again too.
 */

const LEAD_ID = "3f9a2c11-7d4e-4b8a-9c3d-2e1f0a9b8c7d";
const PII = ["Annabel", "Kowalczyk", "annabel.k@example.com", "+49 170 5550123", "4917055501", "Polish", "please call after six"];
const assertHas = (text: string, needles: string[], where: string) => {
  for (const v of needles) assert.ok(text.includes(v), `${where} lacks "${v}"`);
};
const assertNameOnly = (text: string, where: string) => assertHas(text, ["Annabel"], where);
const assertNoPii = (text: string, where: string) => {
  for (const v of PII) assert.ok(!text.includes(v), `${where} leaks "${v}"`);
  assert.ok(text.includes(leadRef(LEAD_ID)) || where.startsWith("review"), `${where} should name the lead by its reference`);
};

test("leadRef: a short pseudonymous label", () => {
  assert.equal(leadRef(LEAD_ID), "Lead #3f9a2c");
  assert.equal(leadLabel({ firstName: "Annabel", lastName: "Kowalczyk" }, LEAD_ID), "Annabel Kowalczyk");
  assert.equal(leadLabel({ firstName: " ", lastName: null }, LEAD_ID), "Lead #3f9a2c", "no name: the reference");
  assert.equal(leadLabel(null, LEAD_ID), "Lead #3f9a2c");
});

test("redactContactDetails removes e-mail addresses and phone numbers, keeps dates, prices and links", () => {
  const out = redactContactDetails("Call Annabel on +49 170 5550123 or 357 99 123 456, mail annabel.k@example.com — budget €350,000, viewing 2026-11-04 10:30, https://cyprusvipestates.com/admin/crm/3f9a2c11-7d4e");
  assert.ok(!out.includes("5550123") && !out.includes("99 123 456") && !out.includes("@example.com"), out);
  for (const keep of ["€350,000", "2026-11-04 10:30", "https://cyprusvipestates.com/admin/crm/3f9a2c11-7d4e"]) assert.ok(out.includes(keep), `${keep} lost: ${out}`);
  // Local formats go too; release ids, all-digit UUID groups and dates stay.
  for (const phone of ["0170/5550123", "0170-555-0123", "(0170) 555 0123", "+357 99 123456", "+49 (170) 555-0123"]) {
    assert.equal(redactContactDetails(`call ${phone} today`), "call [phone removed] today", phone);
  }
  for (const keep of ["release cve-20261102105400", "https://x/admin/crm/3f9a2c11-7d4e-4b8a-9c3d-123456789012", "on 2026-11-04", "ref #123456789", "v1.2.3", "€1,250,000"]) {
    assert.equal(redactContactDetails(keep), keep, keep);
  }
});

test("website, partner-form and ROI leads: name, e-mail and phone in the chat text", () => {
  assertHas(buildInboundLeadTelegramMessage({ leadId: LEAD_ID, name: "Annabel Kowalczyk", email: "annabel.k@example.com", phone: "+49 170 5550123", source: "PARTNER", page: "/en/partners", language: "pl", link: "https://x/admin/crm/" + LEAD_ID }), ["Annabel Kowalczyk", "annabel.k@example.com", "+49 170 5550123"], "inbound lead");
  assert.match(buildInboundLeadTelegramMessage({ leadId: LEAD_ID, source: "ROI_CALCULATOR", link: "https://x" }), /Lead #3f9a2c/, "no name: the reference");
});

test("Private Collection: name, contact details and message in the chat text", () => {
  const r = parsePcLead({ type: "consultation", locale: "en", firstName: "Annabel", lastName: "Kowalczyk", email: "annabel.k@example.com", phone: "+49 170 5550123", considering: "investment", budget: "3-5m", contact: "whatsapp", message: "please call after six" });
  if (!r.ok) throw new Error("parse");
  assertHas(pcTelegram(r.lead, { outcome: "CREATED", crmLink: "https://x", leadId: LEAD_ID }), ["Annabel", "annabel.k@example.com", "+49 170 5550123", "please call after six"], "PC chat");
});

test("Meta lead form: the stored chat text carries name, e-mail and phone", () => {
  assertHas(buildLeadMessage({
    outcome: "CREATED", language: "en", name: "Annabel Kowalczyk", email: "annabel.k@example.com", phone: "+49 170 5550123", budget: "3-5", preferredChannel: "WHATSAPP", campaignName: "UK Leads", formName: "CVE PC Briefing EN v2",
    placeholderReason: null, unmatchedCount: 0, leadId: LEAD_ID,
  }), ["Annabel Kowalczyk", "annabel.k@example.com · +49 170 5550123"], "Meta lead");
});

test("office reminders (nag, SLA, registrations): the client's name, never contact details", () => {
  const DAY = 86_400_000;
  const now = new Date("2026-11-02T08:00:00Z");
  const items = nagItems([{
    id: LEAD_ID, firstName: "Annabel", lastName: "Kowalczyk", status: "CONTACTED", createdAt: new Date(now.getTime() - 30 * DAY),
    lastContactAt: new Date(now.getTime() - 9 * DAY), nextFollowUpAt: new Date(now.getTime() - 2 * DAY), viewingScheduledAt: null, assignedToId: null,
  }], now);
  const nag = buildNagMessage(items, { slot: 10, crmBase: "https://x" })!;
  assertNameOnly(nag.text + JSON.stringify(nag.keyboard), "nag");

  const sla: SlaLead = { id: LEAD_ID, name: "Annabel Kowalczyk", status: "NEW", createdAt: now, assignedToId: "u1", ownerName: "Sascha", ownerEmail: "s@x", assignedAt: new Date(now.getTime() - 5 * 3_600_000) } as SlaLead;
  assertNameOnly(unassignedTelegram([sla], "https://x"), "SLA unassigned");
  assertNameOnly(escalateTelegram([sla], now, "https://x"), "SLA escalate");

  const pair = { developerAccountId: "d1", developerName: "Marinakis", channel: "EMAIL" as const, registrable: true, developmentIds: ["p1"], projects: ["Sea View"], since: new Date(now.getTime() - DAY), lastRemindedAt: null };
  assertNameOnly(dueTelegram([{ leadId: LEAD_ID, leadName: "Annabel Kowalczyk", ownerName: "Sascha", pairs: [pair] }], now, "https://x"), "registration due");
  assertNameOnly(reminderTelegram([{
    id: "r1", status: "SENT", sentAt: now, reminderSentAt: null, developerName: "Marinakis",
    lead: { id: LEAD_ID, name: "Annabel Kowalczyk", status: "CONTACTED", deletedAt: null, assignedTo: null },
  }], "https://x"), "registration reminder");
});

test("partner-submitted client: the office notice names the client and the partner", () => {
  assertNameOnly(buildPartnerClientNotice({ clientName: "Annabel Kowalczyk", partnerName: "Acme", mode: "HANDOVER", outcome: "CREATED", leadId: LEAD_ID, baseUrl: "https://x" }), "partner client");
  assertNoPii(buildPartnerClientNotice({ partnerName: "Acme", mode: "FIX", outcome: "REVIEW" }), "review notice");
});

/* Senders that build their text inline (route handlers and server actions,
   checked on the source): the lead's name, and for new leads and e-mail
   replies the contact details / the client's own words. */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const INLINE: Array<[string, string[]]> = [
  ["src/app/api/c/[token]/view/route.ts", ["const name = escapeHtml(leadLabel(presentation.lead, presentation.leadId));"]],
  ["src/app/api/c/[token]/favorite/route.ts", ["sendTelegramMessage(`❤️ ${escapeHtml(leadLabel(presentation.lead, presentation.leadId))} favorited"]],
  ["src/app/admin/(panel)/crm/[id]/bookingActions.ts", ["`<b>📅 ${esc(leadName)} proposed meeting times</b>", "`${esc(leadName || leadLabel(null, booking.leadId))} — was "]],
  ["src/app/api/cron/booking-reminders/route.ts", ["`${esc(leadLabel(booking.lead, booking.leadId))} — ${time} (Cyprus time)", "sendTelegramMessage(esc(text(leadLabel(booking.lead, booking.leadId))))"]],
  ["src/app/api/cron/action-digest/route.ts", ["escapeHtml(leadLabel(b.lead, b.leadId))", "...buildLines(false).map(stripHtml)"]],
  ["src/lib/crm/assignLead.ts", ["takes <b>${esc(leadLabel(lead, lead.id))}</b>"]],
  ["src/lib/emailInbound/processInbound.ts", ["New e-mail reply from ${esc(leadLabel(lead, leadId))}", "${esc(subject || \"(no subject)\")}", "esc(body.slice(0, TELEGRAM_EXCERPT_LENGTH))"]],
  ["src/lib/emailInbound/officeInbound.ts", ["From ${esc(m.from)}: ${esc(m.subject", "about ${esc(ctx.clientName || leadRef(match.leadId))}"]],
  ["src/app/api/leads/route.ts", ["`<b>${escapeHtml(fullName || leadRef(lead.id))}</b>\\n` +", "`Email: ${escapeHtml(emailNorm)}\\nPhone: ${escapeHtml(phoneNorm)}\\n` +", "`Message: ${escapeHtml(messageFinal)}\\n`"]],
  ["src/lib/mcp/tools/notifyOwnerTelegram.ts", ["deps.send(text)"]],
];

test("inline chat senders name the lead; new leads and replies carry the details", () => {
  for (const [file, needles] of INLINE) {
    const src = read(file);
    for (const n of needles) assert.ok(src.includes(n), `${file}: expected ${n}`);
  }
  assert.ok(!read("src/app/api/leads/route.ts").includes(`k !== "Nationality"`), "nationality goes to the chat again");
});

/* The partner bot named clients by number only from 2026-11-02; the operator
   restored names on 2026-11-03. */
test("partner bot: the weekly summary on Telegram names clients", () => {
  const html = buildDigestTelegram("de", {
    portalUrl: "https://partner.example/home",
    content: { updates: [{ clientName: "Annabel Kowalczyk", key: "stages.viewing", at: new Date("2026-11-01T10:00:00Z") }], totals: { expected: 0, earned: 0, developerPaid: 0, paidOut: 0 }, newProjects: [] },
  })!;
  assert.ok(html.includes("Annabel Kowalczyk") && !html.includes("#3f9a2c"), html);
});

test("Meta import-failure alert: only the error's first line, contact details cut", async () => {
  const { failureAlertText } = await import("@/lib/metaLeadgen/processLead");
  const prismaError = "\nInvalid `prisma.lead.create()` invocation:\n\n{\n  data: {\n    firstName: \"Annabel\",\n    email: \"annabel.k@example.com\",\n    phone: \"+49 170 5550123\"\n  }\n}\nUnknown argument `foo`.";
  const text = failureAlertText("123", prismaError);
  assert.match(text, /Invalid `prisma\.lead\.create\(\)` invocation:/);
  assertNoPii(text.replace("Lead #", ""), "review: meta failure");
  assert.match(failureAlertText("123", "Graph 500 for annabel.k@example.com"), /Graph 500 for \[e-mail removed\]/);
});
