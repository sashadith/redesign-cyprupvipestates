import type { MailSyncResult, WaSyncResult } from "./commSync";

// Import-free on purpose (types only): the toast text, pinned by a test.
export function syncSummary(wa: WaSyncResult | null, mail: MailSyncResult | null): string {
  const parts: string[] = [];
  if (wa) parts.push(wa.ok ? `WhatsApp: ${count(wa.logged)}${wa.linked ? `, ${wa.linked} matched` : ""}` : `WhatsApp failed (${wa.error})`);
  if (mail) parts.push(mail.ok ? (mail.mailboxes ? `Email: ${count(mail.inbound + mail.outbound)}` : "Email: no mailbox connected") : `Email failed (${mail.error})`);
  return parts.length ? parts.join(" · ") : "No phone number or email on this lead.";
}

const count = (n: number) => (n === 0 ? "nothing new" : `${n} new`);
