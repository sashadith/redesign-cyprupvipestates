"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { sendLeadEmail } from "@/lib/crm/sendLeadEmail";
import { logLeadInteraction } from "@/lib/crm/logInteraction";

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
  const ok = result.interactionError
    ? `Email sent to ${result.sentTo} — but the timeline entry failed (${result.interactionError}); add it by hand.`
    : result.cadenceError
      ? `Email sent to ${result.sentTo} and logged — the follow-up date was not advanced (${result.cadenceError}).`
      : `Email sent to ${result.sentTo}.`;
  return { ok };
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
  if (!opts.body.trim()) return { error: "Message is required." };
  await logLeadInteraction({ userId: (session.user as any).id as string, userName: session.user?.name ?? "admin" }, leadId, {
    type: "WHATSAPP_OUT", body: opts.body, occurredAt: opts.occurredAt, leadReacted: opts.leadReacted, aiGenerated: opts.aiGenerated,
  });
  revalidatePath(`/admin/crm/${leadId}`);
  return { ok: "Logged." };
}

// Cockpit "Discard" on the pending-draft card. Marks the draft SUPERSEDED so
// its code is dead; the only send path stays crm_send_email with the code.
export async function discardEmailDraftAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const draftId = String(formData.get("draftId") ?? "");
  const draft = await prisma.leadEmailDraft.findFirst({ where: { id: draftId, userId: (session.user as any).id as string }, select: { leadId: true } });
  if (!draft) return;
  await prisma.leadEmailDraft.updateMany({ where: { id: draftId, status: "PENDING" }, data: { status: "SUPERSEDED" } });
  revalidatePath(`/admin/crm/${draft.leadId}`);
}
