// Team chat alerts carry no client personal data (privacy T3, 2026-11-02).
//
// Telegram (the office bot and its group) is run by a company in the UAE,
// a country without an EU adequacy decision; the team WhatsApp group goes
// through Meta. Neither needs to know WHO enquired: an alert says what
// happened, gives a pseudonymous reference and links into the CRM, where the
// details sit behind a login. So no name, e-mail address, phone number,
// nationality, message text, e-mail subject or excerpt goes into a Telegram
// or WhatsApp text about a client — e-mail notifications to the team (our own
// Hostinger mailbox) still carry the full details.
//
// chatPrivacy.test.ts feeds every chat-message builder a lead full of
// personal data and fails when any of it comes out the other end.

/** "Lead #3f9a2c" — the first six hex digits of the lead's id. A display
 *  label, not a key: it only has to tell two alerts apart at a glance. */
export function leadRef(leadId: string): string {
  return `Lead #${leadId.replace(/-/g, "").slice(0, 6)}`;
}

/** A partner in a team alert: the company name (not personal data), else
 *  a reference — a partner without a company is a private person. */
export function partnerRef(p: { id: string; company?: string | null }): string {
  return p.company?.trim() || `Partner #${p.id.replace(/-/g, "").slice(0, 6)}`;
}

/** Last line of defence for free text that reaches a chat (the MCP
 *  notify_owner_telegram tool, whose text an AI writes): e-mail addresses and
 *  phone numbers (a "+" number, or nine or more digits
 *  with at most single spaces between them) are cut out. Never a substitute for the
 *  builders leaving the data out in the first place. */
export function redactContactDetails(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail removed]")
    .replace(/\+\d[\d ()-]{6,}\d/g, "[phone removed]")
    .replace(/\b\d(?: ?\d){8,}\b/g, "[phone removed]");
}
