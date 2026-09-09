import { z } from "zod";
import { bodyRequirement } from "@/lib/crm/logInteraction";

// Input contract of crm_log_interaction, kept prisma-free so the pure test can
// import it. The six types are exactly what the admin's log buttons write
// (+ Note, + Call, WhatsApp sent/received, + Email log in either direction);
// the body/subject rule is the admin form's: everything needs a body except an
// email log, which may be subject-only — bodyRequirement() is that one rule.
export const LOGGABLE_TYPES = ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN", "EMAIL_OUT", "EMAIL_IN"] as const;

export const LogInteractionInput = z
  .object({
    leadId: z.string().uuid(),
    type: z.enum(LOGGABLE_TYPES),
    body: z.string().trim().max(4000).optional().describe("Required for every type except an email log with a subject."),
    subject: z.string().trim().max(200).optional().describe("Email logs only (EMAIL_OUT / EMAIL_IN)."),
    occurredAt: z.string().datetime({ offset: true }).optional().describe("ISO 8601, with or without a UTC offset; defaults to now"),
    leadReacted: z.boolean().optional().describe("The lead responded — resets the auto-follow-up chain (implied for WHATSAPP_IN and EMAIL_IN)"),
  })
  .superRefine((v, ctx) => {
    if (bodyRequirement(v.type, v.body, v.subject).ok) return;
    ctx.addIssue({
      code: "custom",
      path: ["body"],
      message: v.type.startsWith("EMAIL_") ? "An email log needs a body or at least a subject." : `body is required for ${v.type}.`,
    });
  });

export type LogInteractionInputType = z.infer<typeof LogInteractionInput>;
