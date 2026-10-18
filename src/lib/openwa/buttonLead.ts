// A WhatsApp message from the site's "message us" button, sent by a number the
// CRM does not know yet, becomes a lead (2026-10-18).
//
// Before: such a message reached the business phone and nothing else. The
// webhook dropped it as "no-lead" — and when WhatsApp hid the sender behind a
// privacy id (…@lid), which is common for first contacts, it never even got
// that far. Lead "V" (La Mer, 10-17) had to be typed in by hand from the phone.
//
// Only button messages qualify (see siteButtonMessage.ts): a stranger writing
// "hi" is not a lead, and inventing leads for every number that messages the
// business phone would bury the real ones.
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { notifyTeamWhatsApp } from "@/lib/teamWhatsApp";
import { toMsisdn } from "./phoneMatch";
import { resolveProjectInterest } from "@/lib/leads/projectInterest";
import type { SiteButtonMessage } from "./siteButtonMessage";

const ACTOR = "WhatsApp website button";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type ButtonLeadInput = {
  messageId: string | null;
  /** Normalised MSISDN, digits only. */
  msisdn: string;
  /** The address the message came from — …@c.us or …@lid. */
  from: string;
  pushName: string | null;
  body: string;
  occurredAt: Date;
  site: SiteButtonMessage;
};

export type ButtonLeadResult =
  | { status: "created"; leadId: string }
  | { status: "attached"; leadId: string }
  | { status: "duplicate" };

/** WhatsApp display names are free text. No name stays empty rather than a
 *  placeholder: client-facing drafts greet by firstName, and an empty one gives
 *  the neutral greeting (compose/greeting.ts) instead of "Dear WhatsApp lead". */
export function leadNameFrom(pushName: string | null): { firstName: string; lastName: string } {
  const name = (pushName ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!name) return { firstName: "", lastName: "" };
  const i = name.indexOf(" ");
  return i === -1 ? { firstName: name, lastName: "" } : { firstName: name.slice(0, i), lastName: name.slice(i + 1) };
}

/** Telegram HTML (also the source of the e-mail and team-group copies). English, admin-facing. */
export function buttonLeadTelegram(o: { name: string; phone: string; site: SiteButtonMessage; projectTitle: string | null; body: string; crmLink: string }): string {
  const lines = [
    "💬 <b>New WhatsApp lead</b> (website button)",
    `<b>${esc(o.name)}</b>`,
    esc(o.phone),
    o.projectTitle ? `Project: ${esc(o.projectTitle)}` : null,
    `Page: ${esc(o.site.pageUrl)}`,
    o.site.utmSource || o.site.attributionRef ? `Attribution: ${esc([o.site.utmSource && `utm_source=${o.site.utmSource}`, o.site.attributionRef && `ref=${o.site.attributionRef}`].filter(Boolean).join(", "))}` : null,
    `Language: ${o.site.lang}`,
    `Message: ${esc(o.body.length > 500 ? `${o.body.slice(0, 500)}…` : o.body)}`,
    `→ <a href="${o.crmLink}">Open in CRM</a>`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export async function createLeadFromButtonMessage(input: ButtonLeadInput): Promise<ButtonLeadResult> {
  const phone = `+${input.msisdn}`;
  const { firstName, lastName } = leadNameFrom(input.pushName);

  let projectInterestId: string | null = null;
  let projectTitle: string | null = null;
  if (input.site.projectSlug) {
    const interest = await resolveProjectInterest({ projectSlug: input.site.projectSlug, lang: input.site.lang, prisma });
    projectInterestId = interest.projectInterestId;
    if (projectInterestId) {
      projectTitle = (await prisma.project.findUnique({ where: { id: projectInterestId }, select: { title: true } }))?.title ?? null;
    }
  }

  // The enquiry itself is a SYSTEM row, not WHATSAPP_IN: the Action Center
  // counts WHATSAPP_IN as "real contact" whatever its direction (crm.ts
  // REAL_CONTACT_TYPES), so a fresh lead logged that way would skip the URGENT
  // "never contacted" tier and surface only after a week. Same choice as every
  // other intake path (leadNotify.ts). Later replies are WHATSAPP_IN as usual.
  const intakeRow = (leadId: string) => ({
    leadId,
    type: "SYSTEM" as const,
    direction: "INBOUND" as const,
    channel: "WHATSAPP" as const,
    subject: "WhatsApp button enquiry",
    body: input.body.slice(0, 8000),
    occurredAt: input.occurredAt,
    messageId: input.messageId,
    createdByName: ACTOR,
    metadata: { via: "openwa-webhook", source: "whatsapp_button", from: input.from, sitePage: input.site.pageUrl },
  });

  const result = await prisma.$transaction(async (tx) => {
    // The same number twice at once (gateway retry, double tap) must create one lead.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"wa-button-lead:" + input.msisdn}))`;
    if (input.messageId) {
      const seen = await tx.leadInteraction.findFirst({ where: { messageId: input.messageId }, select: { id: true } });
      if (seen) return { status: "duplicate" as const };
    }
    // Re-check under the lock — a concurrent message from the same number may
    // have created the lead a moment ago. EXACT full-number match, same rule as
    // matchLead.ts: the CRM's duplicate check (findDuplicateLead) compares the
    // last 8 digits, which would put a stranger on +44 7999 278285 onto the
    // timeline of +357 99 278285 and lose their enquiry without a notification.
    const suffix = input.msisdn.slice(-6);
    const candidates = await tx.$queryRaw<{ id: string; phone: string }[]>`SELECT id, phone FROM leads WHERE phone IS NOT NULL AND "deletedAt" IS NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${suffix}`}`;
    const existing = candidates.find((c) => toMsisdn(c.phone) === input.msisdn);
    if (existing) {
      await tx.leadInteraction.create({ data: { ...intakeRow(existing.id), type: "WHATSAPP_IN" as const, subject: null, createdByName: null } });
      return { status: "attached" as const, leadId: existing.id };
    }
    const lead = await tx.lead.create({
      data: {
        source: "WHATSAPP",
        status: "NEW",
        firstName,
        lastName,
        phone,
        preferredChannel: "WHATSAPP",
        languagePreference: input.site.lang,
        sourceLocale: input.site.lang,
        projectInterestId,
        message: input.body.slice(0, 4000),
        pageSource: input.site.pageUrl,
        utmSource: input.site.utmSource,
        attributionRef: input.site.attributionRef,
      },
      select: { id: true },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "INBOUND", content: "Lead received via the WhatsApp button on the website", createdBy: ACTOR } });
    await tx.leadInteraction.create({ data: intakeRow(lead.id) });
    return { status: "created" as const, leadId: lead.id };
  });

  if (result.status !== "created") return result;

  // The lead is safe from here on; notifications are best-effort and must not
  // turn the webhook answer into a 500 (the gateway would retry → duplicate skip,
  // so no harm, but no reason to provoke it either).
  const crmLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239"}/admin/crm/${result.leadId}`;
  const name = `${firstName} ${lastName}`.trim() || "(no WhatsApp name)";
  const tg = buttonLeadTelegram({ name, phone, site: input.site, projectTitle, body: input.body, crmLink });
  try {
    if (await sendTelegramMessage(tg)) await prisma.lead.update({ where: { id: result.leadId }, data: { telegramNotified: true } }).catch(() => {});
  } catch (e) { console.error("wa-button-lead: telegram failed", e instanceof Error ? e.message : e); }
  try {
    await sendEmail({
      subject: `New WhatsApp lead: ${name}${projectTitle ? ` (${projectTitle})` : ""}`,
      text: tg.replace(/<a href="([^"]*)">[^<]*<\/a>/g, "$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"),
      html: tg.split("\n").join("<br/>\n"),
    });
    await prisma.lead.update({ where: { id: result.leadId }, data: { emailNotified: true } }).catch(() => {});
  } catch (e) { console.error("wa-button-lead: e-mail failed", e instanceof Error ? e.message : e); }
  await notifyTeamWhatsApp(tg);

  return result;
}
