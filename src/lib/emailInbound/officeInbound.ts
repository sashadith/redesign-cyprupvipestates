import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { stripHtmlToText } from "@/lib/emailSignature";
import { classifyDeveloperReply, isAutoSubmitted, type ReplyVerdict } from "@/lib/crm/registration/classify";
import { markRegistration, realMarkDeps } from "@/lib/crm/registration/mark";
import type { RegStatus } from "@/lib/crm/registration/core";
import { fetchNewMessages, withReadOnlyInbox, type ImapCredentials } from "./imapClient";
import { canonicalizeEmail } from "./matchLead";
import { matchRegistrationReply } from "./registrationMatch";
import { stripHtmlBlockquotes, stripQuotedReply, stripSignatureBlock } from "./quoteStrip";

// Office mailbox poll for developer registration replies (spec 2026-10-27
// §7.6). office@ receives every reply because registrations are sent from it.
// That inbox also holds lead notifications, newsletters and ordinary mail, so
// this poll handles ONLY mail that resolves to a registration and leaves
// everything else alone: no EMAIL_IN row, no "new reply" Telegram, no cadence.
// Read-only like the per-user poll (withReadOnlyInbox = EXAMINE).

const STATE_ID = "office";
const MAX_BODY_LENGTH = 10_000;

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function officeImapCredentials(env: NodeJS.ProcessEnv): ImapCredentials | null {
  const user = env.EMAIL_USER?.trim();
  const pass = env.EMAIL_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(env.OFFICE_IMAP_PORT ?? 993);
  return { host: env.OFFICE_IMAP_HOST?.trim() || "imap.hostinger.com", port: Number.isInteger(port) && port > 0 ? port : 993, user, pass };
}

export type OfficeMessage = {
  messageId: string | null; inReplyTo: string | null; references: string[];
  from: string; subject: string | null; body: string; date: Date; autoSubmitted: boolean;
};

export type OfficeReplyDeps = {
  match: typeof matchRegistrationReply;
  alreadyStored(messageId: string): Promise<boolean>;
  storeReply(i: { leadId: string; registrationId: string; messageId: string | null; subject: string | null; body: string; from: string; occurredAt: Date; verdict: ReplyVerdict }): Promise<void>;
  loadContext(registrationId: string): Promise<{ status: RegStatus; clientName: string; developerName: string } | null>;
  classify: typeof classifyDeveloperReply;
  markAuto(registrationId: string, evidence: string): Promise<void>;
  alert(html: string): Promise<void>;
  siteUrl: string;
};

export type OfficeOutcome = "ignored" | "stored" | "marked" | "alerted";

export async function handleOfficeMessage(deps: OfficeReplyDeps, m: OfficeMessage, officeAddress: string): Promise<OfficeOutcome> {
  if (canonicalizeEmail(m.from) === canonicalizeEmail(officeAddress)) return "ignored";
  if (m.messageId && (await deps.alreadyStored(m.messageId))) return "ignored";
  const match = await deps.match({ inReplyTo: m.inReplyTo, references: m.references, fromAddress: m.from });
  if (!match) return "ignored";

  if (match.kind === "several") {
    // Never auto-mark when the sender has several open registrations.
    if (m.autoSubmitted) return "ignored";
    const v = await deps.classify({ subject: m.subject, body: m.body, developerName: "", clientName: "" });
    if (v.verdict === "autoreply") return "ignored";
    const links = match.candidates.map((c) => `<a href="${deps.siteUrl}/crm/leads/${c.leadId}">${esc(c.leadId.slice(0, 8))}</a>`).join(", ");
    await deps.alert(
      `<b>Developer reply matches several registrations</b>\nFrom ${esc(m.from)}: ${esc(m.subject || "(no subject)")}\nVerdict: ${esc(v.verdict)}${v.evidence ? `\n${esc(v.evidence)}` : ""}\nLeads: ${links}`,
    );
    return "alerted";
  }

  const ctx = await deps.loadContext(match.registrationId);
  if (!ctx) return "ignored";
  const verdict: ReplyVerdict = m.autoSubmitted
    ? { verdict: "autoreply", evidence: "" }
    : await deps.classify({ subject: m.subject, body: m.body, developerName: ctx.developerName, clientName: ctx.clientName });

  await deps.storeReply({
    leadId: match.leadId, registrationId: match.registrationId, messageId: m.messageId, subject: m.subject,
    body: m.body.slice(0, MAX_BODY_LENGTH), from: m.from, occurredAt: m.date, verdict,
  });

  if (verdict.verdict === "confirmed" && ctx.status === "SENT") {
    await deps.markAuto(match.registrationId, verdict.evidence);
    return "marked";
  }
  if (verdict.verdict === "rejected" || verdict.verdict === "unclear") {
    await deps.alert(
      `<b>Developer reply needs a look</b>\n${esc(ctx.developerName)} about ${esc(ctx.clientName)}: ${verdict.verdict}` +
        `${verdict.evidence ? `\n${esc(verdict.evidence)}` : ""}\n<a href="${deps.siteUrl}/crm/leads/${match.leadId}">Open lead</a>`,
    );
    return "alerted";
  }
  return "stored";
}

function realOfficeDeps(): OfficeReplyDeps {
  return {
    match: matchRegistrationReply,
    alreadyStored: async (messageId) => !!(await prisma.leadInteraction.findFirst({ where: { messageId }, select: { id: true } })),
    async storeReply(i) {
      await prisma.leadInteraction.create({
        data: {
          leadId: i.leadId, type: "SYSTEM", channel: "SYSTEM", direction: null,
          subject: i.subject, body: i.body, occurredAt: i.occurredAt, messageId: i.messageId, createdByName: "developer reply",
          metadata: { kind: "developer_registration_reply", registrationId: i.registrationId, verdict: i.verdict.verdict, evidence: i.verdict.evidence, from: i.from, subject: i.subject },
        },
      });
    },
    async loadContext(id) {
      const r = await prisma.developerRegistration.findUnique({
        where: { id },
        select: { status: true, developerAccount: { select: { name: true } }, lead: { select: { firstName: true, lastName: true } } },
      });
      return r ? { status: r.status, developerName: r.developerAccount.name, clientName: `${r.lead.firstName} ${r.lead.lastName ?? ""}`.trim() } : null;
    },
    classify: (i) => classifyDeveloperReply(i),
    async markAuto(registrationId, evidence) {
      const r = await markRegistration(realMarkDeps(), { registrationId, action: "PRELIMINARY", source: "auto", actor: null, evidence });
      if (!r.ok) console.error(`office-inbound: auto preliminary refused for ${registrationId}: ${r.error}`);
    },
    // Best-effort: a Telegram outage must not stop the poll or the cursor.
    alert: (html) => sendTelegramMessage(html).then(() => undefined, (e) => console.error("office-inbound: Telegram failed", e)),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239",
  };
}

export type OfficePollResult = { fetched: number; handled: number; skipped: number; reset: boolean; stoppedEarlyOnError?: string };

export async function pollOfficeMailbox(): Promise<OfficePollResult | { skipped: "not configured" }> {
  const creds = officeImapCredentials(process.env);
  if (!creds) return { skipped: "not configured" };
  const state = await prisma.officeMailboxState.findUnique({ where: { id: STATE_ID } });
  const deps = realOfficeDeps();
  const saveCursor = (lastUid: bigint, uidValidity: bigint) =>
    prisma.officeMailboxState.upsert({ where: { id: STATE_ID }, create: { id: STATE_ID, lastUid, uidValidity }, update: { lastUid, uidValidity } });

  return withReadOnlyInbox(creds, async (client, mailbox) => {
    const result = await fetchNewMessages(client, mailbox, state?.lastUid ?? null, state?.uidValidity ?? null);
    if (result.cursorWasReset) {
      // First run or UIDVALIDITY change: start from now, no backfill.
      await saveCursor(result.newLastUid, result.uidValidity);
      return { fetched: 0, handled: 0, skipped: 0, reset: true };
    }
    let handled = 0, skipped = 0;
    for (const msg of result.messages.sort((a, b) => a.uid - b.uid)) {
      try {
        const parsed = await simpleParser(msg.source);
        let rawText = parsed.text ?? "";
        if (!rawText && parsed.html) rawText = stripHtmlToText(stripHtmlBlockquotes(parsed.html));
        const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
        const outcome = await handleOfficeMessage(deps, {
          messageId: parsed.messageId || null,
          inReplyTo: parsed.inReplyTo ?? null,
          references,
          from: parsed.from?.value?.[0]?.address ?? "",
          subject: parsed.subject ?? null,
          body: stripSignatureBlock(stripQuotedReply(rawText)),
          date: parsed.date ?? msg.internalDate ?? new Date(),
          autoSubmitted: isAutoSubmitted(parsed.headers),
        }, creds.user);
        if (outcome === "ignored") skipped++; else handled++;
        await saveCursor(BigInt(msg.uid), result.uidValidity);
      } catch (e) {
        // Stop here; the cursor stays at the last handled UID, so this message retries next run.
        console.error(`office-inbound: failed processing UID ${msg.uid}:`, e);
        return { fetched: result.messages.length, handled, skipped, reset: false, stoppedEarlyOnError: e instanceof Error ? e.message : String(e) };
      }
    }
    return { fetched: result.messages.length, handled, skipped, reset: false };
  });
}
