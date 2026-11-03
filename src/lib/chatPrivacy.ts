// Team chat alerts and client data. Privacy T3 (2026-11-02) took client data
// out of the office Telegram and the team WhatsApp group; the operator undid
// it the next day ("Ich will die Nachrichten so haben wie vorher. Mit
// Telefonnummer und email adresse — ich bin der einzige, der sie bekommt"):
// office alerts carry name, e-mail, phone, nationality and the message again.
// The privacy policy says so (privacyPolicyParity.test.ts).
//
// The partner bot names the partner's own clients again too (operator,
// 2026-11-03), never with the client's contact details.

/** "Lead #3f9a2c" — the first six hex digits of the lead's id. A display
 *  label, not a key: it only has to tell two alerts apart at a glance. */
export function leadRef(leadId: string): string {
  return `Lead #${leadId.replace(/-/g, "").slice(0, 6)}`;
}

/** The client's name for an office chat text; the reference when the lead
 *  has no name. */
export function leadLabel(lead: { firstName?: string | null; lastName?: string | null } | null | undefined, leadId: string): string {
  return `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim() || leadRef(leadId);
}

/** Last line of defence for free text that reaches a chat (the MCP
 *  notify_owner_telegram tool, whose text an AI writes; a stored import
 *  error): e-mail addresses and phone numbers are cut out. A phone number is a
 *  run of digits with spaces, "/", "-", "." or brackets between them that
 *  starts a word: a "+" and 8+ digits, or 9+ digits. Not one glued to a word
 *  or hyphen (release ids, UUIDs in CRM links), nor a date ("2026-11-04").
 *  Never a substitute for the builders leaving the data out in the first place. */
export function redactContactDetails(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail removed]")
    .replace(/(^|[^\w\/#.-])(\+?\(?\d[\d ()\/.-]*\d)(?![\w-])/g, (whole, lead: string, num: string) => {
      const digits = num.replace(/\D/g, "").length;
      const phone = num.startsWith("+") ? digits >= 8 : digits >= 9 && !/^\d{4}-\d{2}-\d{2}/.test(num);
      return phone ? `${lead}[phone removed]` : whole;
    });
}
