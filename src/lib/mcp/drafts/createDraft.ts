import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { getSignatureHtml } from "@/lib/emailSignature";
import { sendUserEmail, getUserEmailSettingsRow, EmailSettingsMissingError } from "@/lib/crm/sendCrmEmail";
import type { EmailActor } from "@/lib/crm/sendLeadEmail";
import { adminDateTime } from "@/lib/adminTime";
import { ToolError } from "../toolWrapper";
import { generateApprovalCode } from "./approvalCode";
import { DRAFT_TTL_MS, DRAFTS_PER_LEAD_PER_HOUR, DRAFTS_PER_USER_PER_DAY } from "./draftState";
import { buildPreviewEmail } from "./previewEmail";

// Spec "Draft → approve → send", step 1. Nothing is written unless the
// preview email actually left the operator's SMTP.
export async function createEmailDraft(actor: EmailActor, input: { leadId: string; subject: string; body: string }) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new ToolError("validation", "Subject and body are required.");

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER },
    select: { id: true, email: true, firstName: true, lastName: true, languagePreference: true },
  });
  if (!lead) throw new ToolError("not_found", "Lead not found.");
  if (!lead.email) throw new ToolError("validation", "This lead has no email address — a draft cannot be sent to them.");

  const now = Date.now();
  const [perLead, perUser] = await Promise.all([
    prisma.leadEmailDraft.count({ where: { leadId: lead.id, createdAt: { gte: new Date(now - 3_600_000) } } }),
    prisma.leadEmailDraft.count({ where: { userId: actor.userId, createdAt: { gte: new Date(now - 86_400_000) } } }),
  ]);
  if (perLead >= DRAFTS_PER_LEAD_PER_HOUR) throw new ToolError("rate_limited", `Loop guard: at most ${DRAFTS_PER_LEAD_PER_HOUR} drafts per lead per hour — the limit resets within the hour.`);
  if (perUser >= DRAFTS_PER_USER_PER_DAY) throw new ToolError("rate_limited", `Loop guard: at most ${DRAFTS_PER_USER_PER_DAY} drafts per day — the limit resets within 24 hours.`);

  const approvalCode = generateApprovalCode();
  const expiresAt = new Date(now + DRAFT_TTL_MS);
  const locale = lead.languagePreference ?? "en";
  const preview = buildPreviewEmail({
    leadName: `${lead.firstName} ${lead.lastName}`.trim(),
    leadEmail: lead.email,
    subject, body,
    signatureHtml: await getSignatureHtml(actor.userId, locale),
    approvalCode,
    expiresAtLabel: adminDateTime(expiresAt),
  });

  let previewMessageId: string;
  let previewSentTo: string;
  try {
    const settings = await getUserEmailSettingsRow(actor.userId);
    previewSentTo = settings.fromAddress!;
    const sent = await sendUserEmail(actor.userId, { to: previewSentTo, subject: preview.subject, html: preview.html, text: preview.text });
    previewMessageId = sent.messageId;
  } catch (e: any) {
    if (e instanceof EmailSettingsMissingError) throw new ToolError("config", e.message);
    const scrub = (s: string) => s.split(approvalCode).join("••••••");
    throw new ToolError("smtp", `Preview email could not be sent: ${scrub(e?.message || "SMTP error")}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const superseded = await tx.leadEmailDraft.findFirst({ where: { leadId: lead.id, status: "PENDING" }, select: { id: true } });
    if (superseded) await tx.leadEmailDraft.update({ where: { id: superseded.id }, data: { status: "SUPERSEDED" } });
    const draft = await tx.leadEmailDraft.create({
      data: { leadId: lead.id, userId: actor.userId, subject, body, approvalCode, expiresAt, previewMessageId },
      select: { id: true },
    });
    await tx.leadInteraction.create({
      data: {
        leadId: lead.id, type: "SYSTEM", channel: "SYSTEM",
        subject: "Email draft created by Claude (awaiting approval)",
        body: `Subject: ${subject}`,
        createdByUserId: actor.userId, createdByName: actor.userName,
        metadata: { via: "mcp", draftId: draft.id },
      },
    });
    return { draftId: draft.id, supersededDraftId: superseded?.id ?? null };
  });
  return { ...result, previewSentTo, expiresAt };
}
