import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { getImapCredentials, withReadOnlyInbox, fetchNewMessages, ImapNotConfiguredError } from "./imapClient";
import { matchLeadForInboundEmail } from "./matchLead";
import { stripHtmlBlockquotes, stripQuotedReply, stripSignatureBlock } from "./quoteStrip";
import { stripHtmlToText } from "@/lib/emailSignature";
import { sendTelegramMessage } from "@/lib/telegram";

const MAX_BODY_LENGTH = 10_000; // defensive cap — a reply this long is not the common case, and this is a timeline entry, not an archive
const TELEGRAM_EXCERPT_LENGTH = 200;

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Best-effort — a Telegram outage must never block filing the reply itself
// or advancing the IMAP cursor. Idempotency piggybacks entirely on the
// caller's existing Message-ID guard (see the "already" check above this
// call site): a retried poll finds the interaction already exists and skips
// before ever reaching here, so this never fires twice for the same reply.
async function notifyInboundReply(leadId: string, subject: string | null, body: string) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true } });
    const leadName = lead ? `${lead.firstName} ${lead.lastName}`.trim() : "Unknown lead";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
    const excerpt = body.slice(0, TELEGRAM_EXCERPT_LENGTH);
    const msg =
      `<b>📧 New reply from ${esc(leadName)}</b>\n` +
      `${esc(subject || "(no subject)")}\n\n` +
      `${esc(excerpt)}${body.length > TELEGRAM_EXCERPT_LENGTH ? "…" : ""}\n\n` +
      `<a href="${siteUrl}/admin/crm/${leadId}">Open in CRM</a>`;
    await sendTelegramMessage(msg);
  } catch (e) {
    console.error("email-inbound: Telegram notify failed:", e);
  }
}

export type PollResult = { fetched: number; matched: number; ambiguous: number; skipped: number; reset: boolean; stoppedEarlyOnError?: string };

/**
 * Polls one advisor's mailbox for new inbound replies and files matched ones
 * onto the right lead's timeline. Read-only end to end — see imapClient.ts.
 * Unmatched mail is silently skipped (per spec: Sascha uses this inbox for
 * other correspondence too), but the UID cursor still advances past it so
 * it's never re-checked. Advances the cursor after EACH message succeeds
 * (not once at the end of the batch) so a mid-run crash never causes
 * reprocessing of messages already handled this run.
 */
export async function pollInboundEmailForUser(userId: string): Promise<PollResult> {
  const creds = await getImapCredentials(userId); // throws ImapNotConfiguredError — let the caller decide that's a no-op, not a failure
  const settings = await prisma.userEmailSettings.findUniqueOrThrow({ where: { userId }, select: { imapLastUid: true, imapUidValidity: true } });

  return withReadOnlyInbox(creds, async (client, mailbox) => {
    const result = await fetchNewMessages(client, mailbox, settings.imapLastUid, settings.imapUidValidity);

    if (result.cursorWasReset) {
      await prisma.userEmailSettings.update({
        where: { userId },
        data: { imapLastUid: result.newLastUid, imapUidValidity: result.uidValidity },
      });
      return { fetched: 0, matched: 0, ambiguous: 0, skipped: 0, reset: true };
    }

    let matched = 0, ambiguous = 0, skipped = 0;
    for (const msg of result.messages.sort((a, b) => a.uid - b.uid)) {
      try {
        const parsed = await simpleParser(msg.source);
        const inboundMessageId = parsed.messageId || null;

        // Idempotency: same Message-ID (ours to receive, not to send) can
        // never create a second timeline entry.
        if (inboundMessageId) {
          const already = await prisma.leadInteraction.findFirst({ where: { messageId: inboundMessageId }, select: { id: true } });
          if (already) {
            await prisma.userEmailSettings.update({ where: { userId }, data: { imapLastUid: BigInt(msg.uid), imapUidValidity: result.uidValidity } });
            skipped++;
            continue;
          }
        }

        const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
        const fromAddress = parsed.from?.value?.[0]?.address ?? "";
        const match = await matchLeadForInboundEmail({ inReplyTo: parsed.inReplyTo ?? null, references, fromAddress });

        if (!match) {
          // Not assignable to any lead — silently skipped, per spec. Still advance past it.
          await prisma.userEmailSettings.update({ where: { userId }, data: { imapLastUid: BigInt(msg.uid), imapUidValidity: result.uidValidity } });
          skipped++;
          continue;
        }

        let rawText = parsed.text ?? "";
        if (!rawText && parsed.html) rawText = stripHtmlToText(stripHtmlBlockquotes(parsed.html));
        const body = stripSignatureBlock(stripQuotedReply(rawText)).slice(0, MAX_BODY_LENGTH);
        const attachmentCount = parsed.attachments?.length ?? 0;
        const bodyWithAttachmentNote = attachmentCount > 0 ? `${body}\n\n[${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}]` : body;

        await prisma.leadInteraction.create({
          data: {
            leadId: match.leadId,
            type: "EMAIL_IN",
            direction: "INBOUND",
            channel: "EMAIL",
            subject: parsed.subject ?? null,
            body: bodyWithAttachmentNote,
            occurredAt: parsed.date ?? msg.internalDate ?? new Date(),
            messageId: inboundMessageId,
            metadata: { attachmentCount, ...(match.ambiguous ? { ambiguousSenderMatch: true } : {}) },
          },
        });

        await prisma.userEmailSettings.update({ where: { userId }, data: { imapLastUid: BigInt(msg.uid), imapUidValidity: result.uidValidity } });
        matched++;
        if (match.ambiguous) ambiguous++;
        await notifyInboundReply(match.leadId, parsed.subject ?? null, body);
      } catch (e) {
        // A single malformed/unparseable message must not silently swallow
        // or reprocess forever — stop this run here (cursor stays at the
        // last successfully-handled UID) and surface the error. Later
        // messages retry next poll along with this one.
        console.error(`email-inbound: failed processing UID ${msg.uid} for user ${userId}:`, e);
        return { fetched: result.messages.length, matched, ambiguous, skipped, reset: false, stoppedEarlyOnError: e instanceof Error ? e.message : String(e) };
      }
    }

    return { fetched: result.messages.length, matched, ambiguous, skipped, reset: false };
  });
}

export { ImapNotConfiguredError };
