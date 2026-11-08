// Pure rule for the cockpit's "New deal" (2026-11-08), shared by the dialog and the server.

const BEFORE_RESERVED = new Set(["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "LOST"]);

/** The lead moves to Reserved with a new deal only when asked and while it is still before Reserved. */
export function shouldMoveToReserved(status: string, moveToReserved: boolean): boolean {
  return moveToReserved && BEFORE_RESERVED.has(status);
}
