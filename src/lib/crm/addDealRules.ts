// Pure rule for the cockpit's "New deal" (2026-11-08), shared by the dialog and the server.

const BEFORE_RESERVED = new Set(["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "LOST"]);

/** The lead moves to Reserved with a new deal only when asked and while it is still before Reserved. */
export function shouldMoveToReserved(status: string, moveToReserved: boolean): boolean {
  return moveToReserved && BEFORE_RESERVED.has(status);
}

/** A lost lead never holds a deal (operator, 2026-11-09): New deal there must reopen it to Reserved. */
export function dealNeedsMove(status: string): boolean {
  return status === "LOST";
}

export const LOST_NEEDS_MOVE = "A lost lead cannot hold a deal. Keep “Move the lead to Reserved” ticked to reopen it with this deal.";
