/* A feed project that vanished from its developer's feed can be archived with
   Development.archivedMissingFromFeedAt set — the operator's rule for BBF on
   2026-11-13: Golfside, Salt and Golf Valley left the feed whole (sold to one
   investor), so they were archived, and "if they come back, publish them
   again". The marker is what lets the sync tell that case apart from every
   other archive (a duplicate, a dead sold-out page), which must stay archived
   however the feed behaves.

   Pure, so the rule can be tested without a database. */
export type RepublishCandidate = {
  publishStatus: string;
  archivedMissingFromFeedAt: Date | null;
};

/** True when an archived row carrying the "vanished from the feed" marker is
    listed by the feed again with at least one unit a buyer can actually buy.
    A reappearance with only sold/reserved units changes nothing: publishing
    it would put a sold-out page back up that nobody asked for. */
export function shouldRepublishFromFeed(existing: RepublishCandidate | null, feedUnits: { status?: string | null }[]): boolean {
  if (!existing) return false;
  if (existing.publishStatus !== "archived") return false;
  if (!existing.archivedMissingFromFeedAt) return false;
  return feedUnits.some((u) => u.status === "available");
}
