// Extracted from crm/[id]/emailActions.ts's sendCrmEmailAction (Phase 2 of
// the MCP connector) so the admin modal and the MCP send tool are two
// callers of one behaviour: render, send via the actor's own SMTP, log
// EMAIL_OUT with the Message-ID (inbound matching depends on it), advance
// the follow-up cadence.
import { prisma } from "@/lib/prisma";
import { getSignatureHtml } from "@/lib/emailSignature";
import { sendUserEmail, getUserEmailSettingsRow } from "./sendCrmEmail";
import { applyFollowUpCadence } from "./followUpCadence";
import { renderLeadEmail } from "./renderLeadEmail";

export type EmailActor = { userId: string; userName: string };

export type SendLeadEmailOpts = {
  subject: string;
  body: string;
  occurredAt?: Date;
  leadReacted?: boolean;
  presentationToken?: string;
  skipCadence?: boolean;
  aiGenerated?: boolean;
  via?: "mcp";
  draftId?: string;
};

export type SendLeadEmailResult =
  | { ok: true; sentTo: string; messageId: string; interactionId: string | null; interactionError?: string; cadenceError?: string }
  | { ok: false; error: string };

export async function sendLeadEmail(actor: EmailActor, leadId: string, opts: SendLeadEmailOpts): Promise<SendLeadEmailResult> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { email: true, languagePreference: true } });
  if (!lead?.email) return { ok: false, error: "This lead has no email address." };

  const subject = opts.subject.trim();
  const body = opts.body.trim();
  if (!subject || !body) return { ok: false, error: "Subject and body are required." };

  const locale = lead.languagePreference ?? "en";
  const { html, text } = renderLeadEmail(body, await getSignatureHtml(actor.userId, locale));

  let messageId: string;
  try {
    // BCC the sender on every lead email — "BCC an Bearbeiter".
    const settingsRow = await getUserEmailSettingsRow(actor.userId);
    const sent = await sendUserEmail(actor.userId, { to: lead.email, bcc: settingsRow.fromAddress ?? undefined, subject, html, text });
    messageId = sent.messageId;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Send failed." };
  }

  // The email is out. From here on, a failure must never look like "not sent"
  // to the caller — a missing timeline row is recoverable, a second email is not.
  const when = opts.occurredAt ?? new Date();
  let interactionId: string | null = null;
  let interactionError: string | undefined;
  try {
    const row = await prisma.leadInteraction.create({
      data: {
        leadId,
        type: "EMAIL_OUT",
        direction: "OUTBOUND",
        channel: "EMAIL",
        subject,
        body,
        occurredAt: when,
        createdByUserId: actor.userId,
        createdByName: actor.userName,
        messageId, // Phase 4 inbound threading — see docs/EMAIL-INBOUND.md
        metadata: {
          ...(opts.presentationToken ? { presentationToken: opts.presentationToken } : {}),
          ...(opts.leadReacted ? { leadReacted: true } : {}),
          ...(opts.aiGenerated ? { aiGenerated: true } : {}),
          ...(opts.via ? { via: opts.via } : {}),
          ...(opts.draftId ? { draftId: opts.draftId } : {}),
        },
      },
      select: { id: true },
    });
    interactionId = row.id;
  } catch (e: any) {
    interactionError = e?.message || "timeline write failed";
    console.error(`sendLeadEmail: email sent to lead ${leadId} but the timeline write failed:`, interactionError);
  }

  // Own try/catch, separate from the interaction write above: a cadence
  // failure must never be reported as "the timeline entry failed" (they're
  // unrelated writes), and interactionError above must keep meaning only
  // that the interaction write itself failed.
  let cadenceError: string | undefined;
  if (!opts.skipCadence) {
    try {
      await applyFollowUpCadence(leadId, "manual_contact", { leadReacted: opts.leadReacted });
    } catch (e: any) {
      cadenceError = e?.message || "cadence update failed";
      console.error(`sendLeadEmail: email sent to lead ${leadId} but the follow-up cadence update failed:`, cadenceError);
    }
  }
  return { ok: true, sentTo: lead.email, messageId, interactionId, interactionError, cadenceError };
}
