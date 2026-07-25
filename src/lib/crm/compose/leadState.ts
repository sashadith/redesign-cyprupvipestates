// Determines which section of playbook/by-state.md applies to a given lead,
// purely from data already on hand — no guessing, no LLM call needed for this
// part. See by-state.md for what each bucket actually instructs.

export type LeadState =
  | "NEW"
  | "ONGOING_COMMUNICATION"
  | "CONTACTED_FRESH"
  | "CONTACTED_COLD"
  | "PRESENTATION_UNOPENED"
  | "PRESENTATION_OPENED_NO_REACTION";

const COLD_THRESHOLD_DAYS = 14;

// Batch B (2026-07-25) — statuses that by themselves mean "we're mid
// conversation with this lead", even if no real inbound message happens to
// be logged yet (e.g. a viewing was arranged by phone). Per spec: this is
// the WEAKER of the two ongoing-communication signals — a real inbound
// message (see hasRealInboundMessage below) overrides even a NEW/CONTACTED
// status that hasn't been manually updated yet.
const COMMUNICATING_STATUSES = ["COMMUNICATING", "VIEWING_SCHEDULED", "OFFER"];

export type LeadStateInput = {
  status: string;
  createdAt: Date;
  /** Most recent interaction with a direction set (i.e. an actual outbound/inbound contact, not a NOTE/SYSTEM/STATUS_CHANGE row) — null if none exist. */
  lastDirectedInteractionAt: Date | null;
  /** Most recent presentation sent to this lead, if any. */
  presentation: { sentAt: Date; viewCount: number; lastViewedAt: Date | null } | null;
  /** A real INBOUND message from the lead exists anywhere in the timeline (EMAIL_IN, WHATSAPP_IN, or a logged inbound CALL) — the stronger of the two ongoing-communication signals, see COMMUNICATING_STATUSES above. */
  hasRealInboundMessage: boolean;
};

export function determineLeadState(input: LeadStateInput): LeadState {
  if (input.status === "NEW") return "NEW";

  // Batch B (2026-07-25): real, logged back-and-forth (or a status that
  // implies it) takes priority over the presentation-view buckets below —
  // a lead actively replying needs a continuation of THAT conversation, not
  // a generic "did you see the presentation" nudge, even if a presentation
  // also happens to be sitting unopened.
  if (input.hasRealInboundMessage || COMMUNICATING_STATUSES.includes(input.status)) {
    return "ONGOING_COMMUNICATION";
  }

  if (input.presentation) {
    if (input.presentation.viewCount === 0) return "PRESENTATION_UNOPENED";
    // Viewed, and nothing directed has happened since the last view — still waiting on a reaction.
    const sinceView = input.lastDirectedInteractionAt && input.presentation.lastViewedAt
      ? input.lastDirectedInteractionAt.getTime() > input.presentation.lastViewedAt.getTime()
      : false;
    if (!sinceView) return "PRESENTATION_OPENED_NO_REACTION";
  }

  const lastContact = input.lastDirectedInteractionAt ?? input.createdAt;
  const daysSinceContact = Math.floor((Date.now() - lastContact.getTime()) / 86_400_000);
  return daysSinceContact >= COLD_THRESHOLD_DAYS ? "CONTACTED_COLD" : "CONTACTED_FRESH";
}
