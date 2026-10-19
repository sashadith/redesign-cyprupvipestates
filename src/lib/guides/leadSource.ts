// Guide (lead-magnet) leads — 2026-10-19. A visitor who asks for one of the
// PDF guides is a reader, not yet a buyer, so these leads get their own source
// (GUIDE_DOWNLOAD instead of BLOG_ENQUIRY), their own list in the CRM and a
// shorter follow-up chain. Pure on purpose: the leads route, the follow-up
// cadence and the one-off backfill all decide through these functions, and
// the tests exercise them without a database.

/** The marker messageWithGuide() (./request.ts) puts in front of the guide line. */
export const GUIDE_MARKER = "[Guide]";

/** The source a new form lead gets. A guide request wins over the page it came from. */
export function formLeadSource(page: string, isGuideRequest: boolean): "GUIDE_DOWNLOAD" | "PROJECT_ENQUIRY" | "BLOG_ENQUIRY" | "CONTACT_FORM" {
  if (isGuideRequest) return "GUIDE_DOWNLOAD";
  if (/\/projects\//.test(page)) return "PROJECT_ENQUIRY";
  if (/\/blog\//.test(page)) return "BLOG_ENQUIRY";
  return "CONTACT_FORM";
}

/** Title and language of the guide named in a stored lead message, or null.
 *  Reads the line messageWithGuide() wrote: "[Guide] <title> (DE)". That line
 *  is the whole message when the visitor typed nothing, and the LAST line when
 *  they did — so this looks at every line, not only the first. */
export function guideFromMessage(message: string | null | undefined): { title: string; language: string } | null {
  if (!message) return null;
  for (const raw of message.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith(GUIDE_MARKER)) continue;
    const m = /^\[Guide\]\s+(.+?)\s+\(([A-Za-z]{2})\)$/.exec(line);
    if (m) return { title: m[1], language: m[2].toLowerCase() };
  }
  return null;
}

/** True when the message's first non-empty line is a guide line (the operator's backfill rule). */
export function messageStartsWithGuide(message: string | null | undefined): boolean {
  return (message ?? "").trimStart().startsWith(GUIDE_MARKER);
}

/* Follow-up chain for guide leads. Two automatic attempts at most:
     1st logged contact without a reaction → next follow-up in 7 days;
     2nd logged contact without a reaction → status KEEP_CONTACT, next
       follow-up in 60 days, and the automation stops.
   "Without a reaction" is the Cockpit's own signal: the "Lead reacted"
   checkbox (or an inbound message) resets the chain, exactly as for every
   other lead. A lead that has moved past CONTACTED (COMMUNICATING, a viewing,
   an offer) is in a conversation, so it is never parked — the regular
   cadence applies to it instead (the caller falls through). A lead already
   parked in KEEP_CONTACT stays parked: another unanswered call must not
   replace its 60-day follow-up with the regular chain's 14 days. */
export const GUIDE_MAX_ATTEMPTS = 2;
export const GUIDE_FIRST_RETRY_DAYS = 7;
export const GUIDE_PARK_DAYS = 60;

export type GuideCadenceStep =
  | { kind: "schedule"; days: number; count: number }
  | { kind: "park"; days: number; count: number }
  | { kind: "silent" }
  | { kind: "regular" };

export function guideCadenceStep(opts: { count: number; status: string; leadReacted: boolean }): GuideCadenceStep {
  if (opts.leadReacted) return { kind: "regular" };
  if (opts.status === "KEEP_CONTACT") return { kind: "silent" };
  if (opts.status !== "NEW" && opts.status !== "CONTACTED") return { kind: "regular" };
  if (opts.count >= GUIDE_MAX_ATTEMPTS) return { kind: "silent" };
  if (opts.count === GUIDE_MAX_ATTEMPTS - 1) return { kind: "park", days: GUIDE_PARK_DAYS, count: opts.count + 1 };
  return { kind: "schedule", days: GUIDE_FIRST_RETRY_DAYS, count: opts.count + 1 };
}
