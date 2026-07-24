"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getSignatureHtml, stripHtmlToText } from "@/lib/emailSignature";
import { sendUserEmail, getUserEmailSettingsRow } from "@/lib/crm/sendCrmEmail";
import { applyFollowUpCadence } from "@/lib/crm/followUpCadence";

// Local, self-contained (mirrors src/app/admin/actions.ts's requireSession —
// not imported from there since exporting it from that "use server" file
// would turn an internal auth helper into a publicly-callable action).
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

// Inline font styles (not a <style> block or CSS class) — mail clients strip
// or ignore external/head-level CSS unreliably, inline is the only style that
// reliably survives. Matches the signature block's own font-size/family
// exactly (2026-07-25 fix — body was rendering at the client's unstyled
// default, ~12px, next to the signature's 14px) so both read as one piece.
// Everything (paragraphs and the "* " pseudo-bullet lines alike) lives inside
// this single div — there's no separate <li> markup to lose the size — so
// setting it once here covers all body content.
const BODY_FONT_STYLE = "font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;";

const bodyToHtml = (body: string) =>
  `<div style="${BODY_FONT_STYLE}white-space:pre-wrap;">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</div>`;

// Compose-and-send a real email to a lead, via the sending user's own SMTP
// connection (src/lib/crm/sendCrmEmail.ts). Appends that user's HTML
// signature in the lead's locale, BCCs the sender (their own fromAddress —
// "BCC an Bearbeiter"), logs an EMAIL_OUT timeline entry, and — unless this
// is just delivering an already-counted presentation link (skipCadence) —
// advances the auto-follow-up chain.
export async function sendCrmEmailAction(
  leadId: string,
  opts: { subject: string; body: string; occurredAt?: Date; leadReacted?: boolean; presentationToken?: string; skipCadence?: boolean; aiGenerated?: boolean },
): Promise<{ ok?: string; error?: string }> {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { email: true, languagePreference: true },
  });
  if (!lead?.email) return { error: "This lead has no email address." };

  const subject = opts.subject.trim();
  const body = opts.body.trim();
  if (!subject || !body) return { error: "Subject and body are required." };

  const locale = lead.languagePreference ?? "en";
  const signatureHtml = await getSignatureHtml(userId, locale);
  // Explicit spacer (not a trailing newline in `body` — trim() above would
  // strip that) so there's always a visible blank line before the signature
  // block, regardless of email client support for CSS margins.
  const spacer = `<div style="height:16px;line-height:16px;font-size:1px;">&nbsp;</div>`;
  const html = `${bodyToHtml(body)}${spacer}${signatureHtml}`;
  const text = stripHtmlToText(html);

  try {
    // BCC the sender on every lead email — "BCC an Bearbeiter" — using
    // their own configured fromAddress.
    const settingsRow = await getUserEmailSettingsRow(userId);
    await sendUserEmail(userId, { to: lead.email, bcc: settingsRow.fromAddress ?? undefined, subject, html, text });
  } catch (e: any) {
    return { error: e?.message || "Send failed." };
  }

  const when = opts.occurredAt ?? new Date();
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "EMAIL_OUT",
      direction: "OUTBOUND",
      channel: "EMAIL",
      subject,
      body,
      occurredAt: when,
      createdByUserId: userId,
      createdByName: session.user?.name ?? "admin",
      metadata: {
        ...(opts.presentationToken ? { presentationToken: opts.presentationToken } : {}),
        ...(opts.leadReacted ? { leadReacted: true } : {}),
        ...(opts.aiGenerated ? { aiGenerated: true } : {}),
      },
    },
  });

  if (!opts.skipCadence) {
    await applyFollowUpCadence(leadId, "manual_contact", { leadReacted: opts.leadReacted });
  }

  revalidatePath(`/admin/crm/${leadId}`);
  return { ok: `Email sent to ${lead.email}.` };
}

// No actual send — wa.me is opened client-side (no WhatsApp Business API,
// per the standing decision). This just records that the admin sent a
// WhatsApp message and advances the follow-up cadence the same way a real
// send would.
export async function logWhatsAppSentAction(
  leadId: string,
  opts: { body: string; occurredAt?: Date; leadReacted?: boolean; aiGenerated?: boolean },
): Promise<{ ok?: string; error?: string }> {
  const session = await requireSession();
  const content = opts.body.trim();
  if (!content) return { error: "Message is required." };

  const when = opts.occurredAt ?? new Date();
  const metadata = {
    ...(opts.leadReacted ? { leadReacted: true } : {}),
    ...(opts.aiGenerated ? { aiGenerated: true } : {}),
  };
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "WHATSAPP_OUT",
      direction: "OUTBOUND",
      channel: "WHATSAPP",
      body: content,
      occurredAt: when,
      createdByUserId: (session.user as any)?.id ?? null,
      createdByName: session.user?.name ?? "admin",
      ...(Object.keys(metadata).length ? { metadata } : {}),
    },
  });

  await applyFollowUpCadence(leadId, "manual_contact", { leadReacted: opts.leadReacted });
  revalidatePath(`/admin/crm/${leadId}`);
  return { ok: "Logged." };
}
