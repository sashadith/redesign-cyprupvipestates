"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { makeRateLimiter } from "@/lib/antispam";
import { generateReplyDraft, type ComposeChannel, type ComposeResult } from "@/lib/crm/compose/generate";
import { sendCrmEmailAction, logWhatsAppSentAction } from "./emailActions";

async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

// Per-lead, not per-user — "no more than one generation every few seconds
// FOR THIS LEAD" is the actual abuse case (someone mashing the button), not
// a global cap across the whole admin team.
const draftLimiter = makeRateLimiter();
const DRAFT_LIMIT_WINDOW_MS = 8_000;

export async function generateReplyDraftAction(leadId: string, channel: ComposeChannel): Promise<ComposeResult> {
  await requireSession();
  if (draftLimiter(leadId, 1, DRAFT_LIMIT_WINDOW_MS)) {
    return { ok: false, error: "Please wait a few seconds before generating another draft for this lead." };
  }
  return generateReplyDraft(leadId, channel);
}

export async function sendGeneratedEmailAction(
  leadId: string,
  opts: { subject: string; body: string },
): Promise<{ ok?: string; error?: string }> {
  return sendCrmEmailAction(leadId, { ...opts, aiGenerated: true });
}

export async function logGeneratedWhatsAppAction(
  leadId: string,
  opts: { body: string },
): Promise<{ ok?: string; error?: string }> {
  return logWhatsAppSentAction(leadId, { ...opts, aiGenerated: true });
}
