// One logging path for manually-entered timeline rows (Phase 2 of the MCP
// connector) — extracted from admin/actions.ts's addLeadNote/addCallLog/
// addEmailLog and crm/[id]/emailActions.ts's logWhatsAppSentAction, which
// now call this. The shape table below IS the behaviour those actions had:
// a NOTE is internal work (no direction, no cadence, but a LeadActivity row
// like the admin always wrote); every other type is a real contact and
// advances the follow-up cadence. An inbound message means the lead reacted,
// so WHATSAPP_IN/EMAIL_IN force leadReacted (they reset the auto-follow-up
// chain, see followUpCadence.ts).
//
// Body is optional: every type needs *some* content except email logs,
// which the admin's "+ Email log" form has always allowed subject-only
// (backfilling "sent an email, no need to retype it verbatim" — see
// addEmailLog in admin/actions.ts). bodyRequirement() below is the one
// place that rule lives; both logLeadInteraction and its test call it.
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
  body?: string | null;
  subject?: string | null;
  occurredAt?: Date;
  leadReacted?: boolean;
  aiGenerated?: boolean;
  via?: "mcp";
};

// Pure rule for what counts as "enough to log": every type needs a non-empty
// body, except an email log (EMAIL_OUT/EMAIL_IN) with a subject — the admin's
// email-log form has always allowed subject-only entries. Returns the
// trimmed-or-null content/subject alongside whether the combination is
// loggable at all, so logLeadInteraction and its test share one source of
// truth instead of duplicating the trim/require logic.
export function bodyRequirement(
  type: LoggableInteractionType,
  body: string | null | undefined,
  subject: string | null | undefined,
): { content: string | null; subject: string | null; ok: boolean } {
  const content = body?.trim() || null;
  const trimmedSubject = subject?.trim() || null;
  const ok = !!content || (type.startsWith("EMAIL_") && !!trimmedSubject);
  return { content, subject: trimmedSubject, ok };
}

export async function logLeadInteraction(actor: EmailActor, leadId: string, input: LogInteractionInput): Promise<{ interactionId: string }> {
  const { content, subject, ok } = bodyRequirement(input.type, input.body, input.subject);
  if (!ok) throw new Error("Message is required.");
  const shape = interactionShape(input.type);
  const when = input.occurredAt ?? new Date();
  const leadReacted = shape.forcesLeadReacted || !!input.leadReacted;
  const metadata = {
    ...(leadReacted ? { leadReacted: true } : {}),
    ...(input.aiGenerated ? { aiGenerated: true } : {}),
    ...(input.via ? { via: input.via } : {}),
  };
  if (shape.activityRow) {
    // Only NOTE writes an activity row, and `ok` above required a non-empty
    // `content` for NOTE (it doesn't start with "EMAIL_"), so this is never
    // the empty-string fallback in practice — the `?? subject ?? ""` just
    // satisfies TypeScript without a non-null assertion.
    const activityContent = content ?? subject ?? "";
    await prisma.leadActivity.create({
      data: { leadId, type: input.type, content: activityContent, createdAt: when, createdBy: actor.userName, createdById: actor.userId },
    });
  }
  const row = await prisma.leadInteraction.create({
    data: {
      leadId,
      type: input.type,
      direction: shape.direction,
      channel: shape.channel,
      subject,
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
