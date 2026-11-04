// The loggable interaction types and the "enough to log" rule, import-free so
// the cockpit's client log form can use the same rule as the server
// (logInteraction.ts) and the MCP tool's zod schema (logInteractionInput.ts).

// Exactly what the admin's log buttons write (+ Note, + Call, WhatsApp
// sent/received, + Email log in either direction).
export const LOGGABLE_TYPES = ["CALL", "NOTE", "WHATSAPP_OUT", "WHATSAPP_IN", "EMAIL_OUT", "EMAIL_IN"] as const;
export type LoggableInteractionType = (typeof LOGGABLE_TYPES)[number];

// Outcome of a logged CALL (2026-11-04). Stored as metadata.callOutcome; SPOKE means the lead
// answered, so it counts as "the lead reacted". With an outcome the call needs no text: the label
// becomes the timeline text.
export const CALL_OUTCOMES = ["NO_ANSWER", "VOICEMAIL", "SPOKE", "WRONG_NUMBER"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  NO_ANSWER: "No answer", VOICEMAIL: "Voicemail", SPOKE: "Spoke", WRONG_NUMBER: "Wrong number",
};
export const isCallOutcome = (v: unknown): v is CallOutcome => typeof v === "string" && (CALL_OUTCOMES as readonly string[]).includes(v);

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
  callOutcome?: CallOutcome | null,
): { content: string | null; subject: string | null; ok: boolean } {
  const content = body?.trim() || (type === "CALL" && callOutcome ? CALL_OUTCOME_LABEL[callOutcome] : null);
  const trimmedSubject = subject?.trim() || null;
  const ok = !!content || (type.startsWith("EMAIL_") && !!trimmedSubject);
  return { content, subject: trimmedSubject, ok };
}
