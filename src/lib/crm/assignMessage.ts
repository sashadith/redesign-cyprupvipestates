// Result of assignLead and the toast that reports it honestly (CRM v2). A leaf
// module with no server imports, so the client InboxList can use it too.

export type AssignResult =
  | { ok: true; notified: { telegram: boolean; email: boolean }; changed: boolean }
  | { error: string };

export function assignToast(who: string, res: Extract<AssignResult, { ok: true }>): string {
  if (!res.changed) return `Already assigned to ${who}.`;
  const { telegram, email } = res.notified;
  if (telegram && email) return `Assigned to ${who}. Notified on Telegram and email.`;
  if (telegram) return `Assigned to ${who}. Notified on Telegram only.`;
  if (email) return `Assigned to ${who}. Notified by email only.`;
  return `Assigned to ${who}. Notification failed — tell them directly.`;
}
