// Determines which section of playbook/by-state.md applies to a given lead,
// purely from data already on hand — no guessing, no LLM call needed for this
// part. See by-state.md for what each bucket actually instructs.

export type LeadState =
  | "NEW"
  | "CONTACTED_FRESH"
  | "CONTACTED_COLD"
  | "PRESENTATION_UNOPENED"
  | "PRESENTATION_OPENED_NO_REACTION";

const COLD_THRESHOLD_DAYS = 14;

export type LeadStateInput = {
  status: string;
  createdAt: Date;
  /** Most recent interaction with a direction set (i.e. an actual outbound/inbound contact, not a NOTE/SYSTEM/STATUS_CHANGE row) — null if none exist. */
  lastDirectedInteractionAt: Date | null;
  /** Most recent presentation sent to this lead, if any. */
  presentation: { sentAt: Date; viewCount: number; lastViewedAt: Date | null } | null;
};

export function determineLeadState(input: LeadStateInput): LeadState {
  if (input.status === "NEW") return "NEW";

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
