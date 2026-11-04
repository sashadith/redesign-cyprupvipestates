// Pure: whether the automatic follow-up cadence may write a new date (2026-11-04). A date a person
// set stays until it has passed; after that the cadence takes over again. Import-free so the test
// and the client can use it.

export type FollowUpState = { followUpManual: boolean; nextFollowUpAt: Date | null };

export function keepsManualFollowUp(lead: FollowUpState, now: Date): boolean {
  return lead.followUpManual && lead.nextFollowUpAt != null && lead.nextFollowUpAt.getTime() > now.getTime();
}

/** The lead fields for a follow-up date a person picked; clearing it also clears the flag. */
export function manualFollowUpData(at: Date | null): { nextFollowUpAt: Date | null; followUpManual: boolean } {
  return { nextFollowUpAt: at, followUpManual: at != null };
}
