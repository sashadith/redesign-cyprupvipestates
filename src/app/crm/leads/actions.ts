"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canEditLead } from "@/lib/crm/access";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";

// Lead cockpit writes (CRM v2, 2026-10-18). Same validation as the MCP tool
// crm_log_interaction; the lead id comes from the page, never from the form.

// A few minutes of slack for a clock that runs ahead of the server's.
const FUTURE_SLACK_MS = 5 * 60_000;

export async function logInteractionAction(leadId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireCrmUser();
  const parsed = LogInteractionInput.safeParse({ ...(raw && typeof raw === "object" ? raw : {}), leadId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };
  const { type, body, subject, occurredAt, leadReacted } = parsed.data;
  const when = occurredAt ? new Date(occurredAt) : undefined;
  if (when && when.getTime() > Date.now() + FUTURE_SLACK_MS) return { error: "The date cannot be in the future." };
  await logLeadInteraction({ userId: user.id, userName: user.name }, leadId, { type, body, subject, occurredAt: when, leadReacted });
  revalidatePath(`/crm/leads/${leadId}`);
  // A logged contact changes the board card's age / stale flag.
  revalidatePath("/crm/pipeline");
  return { ok: true };
}
