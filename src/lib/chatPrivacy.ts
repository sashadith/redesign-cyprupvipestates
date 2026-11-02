// Team chat alerts and client data (privacy T3, 2026-11-02; names back the
// same day, operator: "ich will aber die namen sehen").
//
// Telegram (the office bot and its group) is run by a company in the UAE,
// a country without an EU adequacy decision; the team WhatsApp group goes
// through Meta. An alert names the client (first and last name) and links
// into the CRM, where the rest sits behind a login. No e-mail address, phone
// number, nationality, message text, e-mail subject or excerpt goes into a
// Telegram or WhatsApp text about a client — e-mail notifications to the team
// (our own Hostinger mailbox) still carry the full details. The privacy policy
// says exactly this (privacyPolicyParity.test.ts).
//
// chatPrivacy.test.ts feeds every chat-message builder a lead full of
// personal data and fails when any contact detail comes out the other end.

/** "Lead #3f9a2c" — the first six hex digits of the lead's id. A display
 *  label, not a key: it only has to tell two alerts apart at a glance. */
export function leadRef(leadId: string): string {
  return `Lead #${leadId.replace(/-/g, "").slice(0, 6)}`;
}

/** The client's name for an office chat text (operator, 2026-11-02: "ich will
 *  aber die namen sehen" — names back in every team alert, the privacy policy
 *  says so). Contact details, nationality and the message still stay out.
 *  Falls back to the reference when the lead has no name. */
export function leadLabel(lead: { firstName?: string | null; lastName?: string | null } | null | undefined, leadId: string): string {
  return `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim() || leadRef(leadId);
}

/** "#3f9a2c" — a partner's client in the partner bot's Telegram texts
 *  (2026-11-02, operator: "nur Nummer"): the first six hex digits of the
 *  claim id. The partner portal shows the same number next to the name. */
export function clientRef(claimId: string): string {
  return `#${claimId.replace(/-/g, "").slice(0, 6)}`;
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
