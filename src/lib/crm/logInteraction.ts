// One logging path for manually-entered timeline rows (Phase 2 of the MCP
// connector) — extracted from admin/actions.ts's addLeadNote/addCallLog/
// addEmailLog and crm/[id]/emailActions.ts's logWhatsAppSentAction, which
// now call this. The shape table below IS the behaviour those actions had:
// a NOTE is internal work (no direction, no cadence, but a LeadActivity row
// like the admin always wrote); every other type is a real contact and
// advances the follow-up cadence. An inbound message means the lead reacted,
// so WHATSAPP_IN/EMAIL_IN force leadReacted (they reset the auto-follow-up
// chain, see followUpCadence.ts).
import { prisma } from "@/lib/prisma";
import { applyFollowUpCadence } from "./followUpCadence";
import type { EmailActor } from "./sendLeadEmail";

export type LoggableInteractionType = "CALL" | "NOTE" | "WHATSAPP_OUT" | "WHATSAPP_IN" | "EMAIL_OUT" | "EMAIL_IN";

export type InteractionShape = {
  direction: "INBOUND" | "OUTBOUND" | null;
  channel: "PHONE" | "WHATSAPP" | "EMAIL" | null;
  cadence: boolean;
  activityRow: boolean;
  forcesLeadReacted: boolean;
};

const SHAPES: Record<LoggableInteractionType, InteractionShape> = {
  NOTE: { direction: null, channel: null, cadence: false, activityRow: true, forcesLeadReacted: false },
  CALL: { direction: "OUTBOUND", channel: "PHONE", cadence: true, activityRow: false, forcesLeadReacted: false },
  WHATSAPP_OUT: { direction: "OUTBOUND", channel: "WHATSAPP", cadence: true, activityRow: false, forcesLeadReacted: false },
  WHATSAPP_IN: { direction: "INBOUND", channel: "WHATSAPP", cadence: true, activityRow: false, forcesLeadReacted: true },
  EMAIL_OUT: { direction: "OUTBOUND", channel: "EMAIL", cadence: true, activityRow: false, forcesLeadReacted: false },
  EMAIL_IN: { direction: "INBOUND", channel: "EMAIL", cadence: true, activityRow: false, forcesLeadReacted: true },
};

export function interactionShape(type: LoggableInteractionType): InteractionShape {
  return { ...SHAPES[type] };
}

export type LogInteractionInput = {
  type: LoggableInteractionType;
  body: string;
  subject?: string | null;
  occurredAt?: Date;
  leadReacted?: boolean;
  aiGenerated?: boolean;
  via?: "mcp";
};

export async function logLeadInteraction(actor: EmailActor, leadId: string, input: LogInteractionInput): Promise<{ interactionId: string }> {
  const content = input.body.trim();
  if (!content) throw new Error("Message is required.");
  const shape = interactionShape(input.type);
  const when = input.occurredAt ?? new Date();
  const leadReacted = shape.forcesLeadReacted || !!input.leadReacted;
  const metadata = {
    ...(leadReacted ? { leadReacted: true } : {}),
    ...(input.aiGenerated ? { aiGenerated: true } : {}),
    ...(input.via ? { via: input.via } : {}),
  };
  if (shape.activityRow) {
    await prisma.leadActivity.create({
      data: { leadId, type: input.type, content, createdAt: when, createdBy: actor.userName, createdById: actor.userId },
    });
  }
  const row = await prisma.leadInteraction.create({
    data: {
      leadId,
      type: input.type,
      direction: shape.direction,
      channel: shape.channel,
      subject: input.subject?.trim() || null,
      body: content,
      occurredAt: when,
      createdByUserId: actor.userId,
      createdByName: actor.userName,
      ...(Object.keys(metadata).length ? { metadata } : {}),
    },
    select: { id: true },
  });
  if (shape.cadence) await applyFollowUpCadence(leadId, "manual_contact", { leadReacted });
  return { interactionId: row.id };
}
