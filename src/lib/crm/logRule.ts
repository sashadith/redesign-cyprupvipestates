// The loggable interaction types and the "enough to log" rule, import-free so
// the cockpit's client log form can use the same rule as the server
// (logInteraction.ts) and the MCP tool's zod schema (logInteractionInput.ts).

// Exactly what the admin's log buttons write (+ Note, + Call, WhatsApp
// sent/received, + Email log in either direction).
export const LOGGABLE_TYPES = ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN", "EMAIL_OUT", "EMAIL_IN"] as const;
export type LoggableInteractionType = (typeof LOGGABLE_TYPES)[number];

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
