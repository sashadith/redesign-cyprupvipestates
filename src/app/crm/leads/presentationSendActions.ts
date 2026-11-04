"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCrmUser } from "@/lib/crm/session";
import { presentationGuard } from "@/lib/crm/presentations/guard";
import { WHATSAPP_MSG } from "@/lib/crm/presentationMessages";
import { scopeFor, type LeadScope } from "@/lib/mcp/leadScope";
import { ToolError } from "@/lib/mcp/toolWrapper";
import { checkSend, performSend, realSendDeps } from "@/lib/mcp/tools/whatsappSend";
import { createEmailDraft } from "@/lib/mcp/drafts/createDraft";
import { sendEmailDraft } from "@/lib/mcp/drafts/sendDraft";

// Sending a freshly created selection from the CRM (operator 2026-11-03):
//  - email goes through the approval-code gate Claude's drafts use: "Send" mails
//    the operator a preview with a 6-character code, and only the code typed
//    back into the dialog sends it to the client;
//  - "Send via WhatsApp (CRM)" sends over the company number through the same
//    guards as crm_whatsapp_send (existing chat only, daily cap), and is only
//    clickable when those guards would let it through.
// Middleware does not protect server actions: every export checks the session
// and presentationGuard itself, and returns { error } instead of throwing.

const NOT_FOUND = "Lead not found.";
const NOT_SIGNED_IN = "Not signed in.";

function validId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function requestOrigin(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

async function guarded(leadId: unknown) {
  const user = await getCrmUser();
  if (!user) return { error: NOT_SIGNED_IN } as const;
  const lead = validId(leadId)
    ? await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, assignedToId: true } })
    : null;
  const error = presentationGuard(user, lead, "edit");
  if (error || !lead) return { error: error ?? NOT_FOUND } as const;
  const access: LeadScope = { user, where: scopeFor(user) };
  return { user, lead, access, actor: { userId: user.id, userName: user.name } } as const;
}

/** The lead's own selection by token, or null — a token from another lead is never sent. */
async function ownPresentation(leadId: string, token: unknown) {
  if (!validId(token)) return null;
  return prisma.clientPresentation.findFirst({ where: { token, leadId }, select: { token: true, locale: true, greetingName: true } });
}

function message(e: unknown, fallback: string): string {
  return e instanceof ToolError ? e.message : fallback;
}

// ---------- WhatsApp ----------

function whatsappText(p: { token: string; locale: string; greetingName: string }): string {
  const build = WHATSAPP_MSG[p.locale as keyof typeof WHATSAPP_MSG] ?? WHATSAPP_MSG.en;
  return build(p.greetingName, `${requestOrigin()}/c/${p.token}`);
}

export async function presentationWhatsAppStatusAction(
  leadId: string, token: string,
): Promise<{ available: true; text: string } | { available: false; reason: string }> {
  const g = await guarded(leadId);
  if ("error" in g) return { available: false, reason: g.error ?? NOT_FOUND };
  const p = await ownPresentation(g.lead.id, token);
  if (!p) return { available: false, reason: "Selection not found." };
  try {
    const { chatId, decision } = await checkSend(realSendDeps(g.access), g.lead.id);
    if (decision.allowed) return { available: true, text: whatsappText(p) };
    if (!chatId) return { available: false, reason: "No usable phone number on file." };
    if (decision.code === "validation") return { available: false, reason: "No WhatsApp chat with this number yet. The CRM only continues existing chats." };
    return { available: false, reason: decision.reason };
  } catch (e) {
    return { available: false, reason: message(e, "The WhatsApp gateway is not reachable right now.") };
  }
}

export async function sendPresentationWhatsAppAction(leadId: string, token: string): Promise<{ ok: string } | { error: string }> {
  const g = await guarded(leadId);
  if ("error" in g) return { error: g.error ?? NOT_FOUND };
  const p = await ownPresentation(g.lead.id, token);
  if (!p) return { error: "Selection not found." };
  try {
    const r = await performSend(realSendDeps(g.access), { leadId: g.lead.id, text: whatsappText(p) }, g.actor, { via: "crm-whatsapp" });
    revalidatePath(`/crm/leads/${g.lead.id}`);
    return { ok: "warning" in r && r.warning ? "Sent via WhatsApp, but the timeline entry failed. Check the timeline before logging it by hand." : "Sent via WhatsApp." };
  } catch (e) {
    return { error: message(e, "Could not send via WhatsApp.") };
  }
}

// ---------- Email with approval code ----------

export async function requestPresentationEmailCodeAction(
  leadId: string, opts: { subject: string; body: string; presentationToken: string },
): Promise<{ draftId: string; codeSentTo: string } | { error: string }> {
  const g = await guarded(leadId);
  if ("error" in g) return { error: g.error ?? NOT_FOUND };
  if (!(await ownPresentation(g.lead.id, opts?.presentationToken))) return { error: "Selection not found." };
  try {
    // cc: [] — a presentation goes to the client alone, never reply-all.
    const r = await createEmailDraft(g.actor, { leadId: g.lead.id, subject: String(opts.subject ?? ""), body: String(opts.body ?? ""), cc: [] }, g.access, { origin: "crm" });
    revalidatePath(`/crm/leads/${g.lead.id}`);
    return { draftId: r.draftId, codeSentTo: r.previewSentTo };
  } catch (e) {
    return { error: message(e, "Could not send the approval code.") };
  }
}

export async function confirmPresentationEmailAction(
  leadId: string, opts: { draftId: string; code: string; presentationToken: string },
): Promise<{ ok: string } | { error: string }> {
  const g = await guarded(leadId);
  if ("error" in g) return { error: g.error ?? NOT_FOUND };
  const p = await ownPresentation(g.lead.id, opts?.presentationToken);
  if (!p) return { error: "Selection not found." };
  // The draft must be this lead's: the selection token is attached to whatever it sends.
  const draft = validId(opts.draftId)
    ? await prisma.leadEmailDraft.findFirst({ where: { id: opts.draftId, leadId: g.lead.id }, select: { id: true } })
    : null;
  if (!draft) return { error: "Draft not found." };
  try {
    const r = await sendEmailDraft(g.actor, opts.draftId, String(opts.code ?? ""), g.access, { origin: "crm", presentationToken: p.token });
    revalidatePath(`/crm/leads/${g.lead.id}`);
    return {
      ok: r.interactionError
        ? `Email sent to ${r.sentTo}, but the timeline entry failed (${r.interactionError}); add it by hand.`
        : `Email sent to ${r.sentTo}.`,
    };
  } catch (e) {
    return { error: message(e, "Could not send the email.") };
  }
}
