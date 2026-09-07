import { prisma } from "@/lib/prisma";
import { sendLeadEmail, type EmailActor } from "@/lib/crm/sendLeadEmail";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { ToolError } from "../toolWrapper";
import { evaluateSendAttempt, MAX_CODE_ATTEMPTS } from "./draftState";

// Spec "Draft → approve → send", step 3. The code is checked by the pure
// reducer; every state change here is an atomic conditional update so two
// concurrent sends of one draft cannot both go out.
export async function sendEmailDraft(actor: EmailActor, draftId: string, approvalCode: string) {
  const draft = await prisma.leadEmailDraft.findUnique({
    where: { id: draftId },
    select: { id: true, leadId: true, userId: true, subject: true, body: true, status: true, failedAttempts: true, expiresAt: true, approvalCode: true },
  });
  if (!draft || draft.userId !== actor.userId) throw new ToolError("not_found", "Draft not found.");

  const decision = evaluateSendAttempt(draft, approvalCode);
  if (decision.action === "reject") throw new ToolError("validation", decision.message);
  if (decision.action === "expire") {
    await prisma.leadEmailDraft.updateMany({ where: { id: draft.id, status: "PENDING" }, data: { status: "EXPIRED" } });
    throw new ToolError("validation", decision.message);
  }
  if (decision.action === "wrong_code") {
    await prisma.leadEmailDraft.updateMany({ where: { id: draft.id, status: "PENDING" }, data: { failedAttempts: { increment: 1 } } });
    await prisma.leadEmailDraft.updateMany({ where: { id: draft.id, status: "PENDING", failedAttempts: { gte: MAX_CODE_ATTEMPTS } }, data: { status: "LOCKED" } });
    throw new ToolError("validation", decision.message);
  }

  const lead = await prisma.lead.findFirst({ where: { id: draft.leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER }, select: { email: true } });
  if (!lead?.email) throw new ToolError("validation", "The lead was deleted or has no email address any more — the draft cannot be sent.");

  const claimed = await prisma.leadEmailDraft.updateMany({ where: { id: draft.id, status: "PENDING" }, data: { status: "SENDING" } });
  if (claimed.count !== 1) throw new ToolError("validation", "This draft is already being sent.");

  const result = await sendLeadEmail(actor, draft.leadId, { subject: draft.subject, body: draft.body, aiGenerated: true, via: "mcp", draftId: draft.id });
  if (!result.ok) {
    await prisma.leadEmailDraft.updateMany({ where: { id: draft.id, status: "SENDING" }, data: { status: "PENDING" } });
    const scrub = (s: string) => s.split(draft.approvalCode).join("••••••");
    throw new ToolError("smtp", `Send failed, the draft is still pending: ${scrub(result.error)}`);
  }
  await prisma.leadEmailDraft.updateMany({
    where: { id: draft.id, status: "SENDING" },
    data: { status: "SENT", sentAt: new Date(), sentInteractionId: result.interactionId },
  });
  return { sentTo: result.sentTo, messageId: result.messageId, interactionId: result.interactionId, interactionError: result.interactionError };
}
