"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { applyFollowUpCadence } from "@/lib/crm/followUpCadence";
import { sendLeadEmail } from "@/lib/crm/sendLeadEmail";

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
  const result = await sendLeadEmail({ userId: (session.user as any).id as string, userName: session.user?.name ?? "admin" }, leadId, opts);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/admin/crm/${leadId}`);
  return { ok: result.interactionError ? `Email sent to ${result.sentTo} — but the timeline entry failed (${result.interactionError}); add it by hand.` : `Email sent to ${result.sentTo}.` };
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
