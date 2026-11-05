// The manager's hint to a partner and the Monday summary (partner pipeline, 2026-11-05). Pure: the
// loading and sending live in partnerPipelineDigestRun.ts. English: this is CRM / office copy.

/** Ready-made hints; the text is sent to the partner exactly as written. */
export const HINT_TEMPLATES = [
  "Your follow-up with this client is overdue.",
  "The client opened your selection — a good moment to call.",
] as const;

/** Active admin / owner, or the partner's own manager. */
export function mayHintPartner(
  user: { id: string; isOwner: boolean; role: string; isActive?: boolean },
  partner: { managerUserId: string | null },
): boolean {
  if (user.isActive === false) return false;
  if (user.isOwner || user.role === "ADMIN") return true;
  return !!partner.managerUserId && partner.managerUserId === user.id;
}

export type DigestCard = {
  partnerName: string;
  light: "green" | "amber" | "red";
  handedOverThisWeek: boolean;
  newThisWeek: boolean;
  /** Follow-up date passed. When absent, a red light counts as overdue. */
  overdue?: boolean;
};

/**
 * One line per partner with anything to report: "Anna Muster: 3 overdue · 1 handed over · 2 new".
 * Partners keep first-seen order; null when every count of every partner is zero.
 */
export function managerDigest(cards: DigestCard[]): string | null {
  const order: string[] = [];
  const counts = new Map<string, { overdue: number; handed: number; fresh: number }>();
  for (const c of cards) {
    let n = counts.get(c.partnerName);
    if (!n) {
      n = { overdue: 0, handed: 0, fresh: 0 };
      counts.set(c.partnerName, n);
      order.push(c.partnerName);
    }
    if (c.overdue ?? c.light === "red") n.overdue++;
    if (c.handedOverThisWeek) n.handed++;
    if (c.newThisWeek) n.fresh++;
  }
  const lines = order.flatMap((name) => {
    const n = counts.get(name)!;
    return n.overdue + n.handed + n.fresh === 0 ? [] : [`${name}: ${n.overdue} overdue · ${n.handed} handed over · ${n.fresh} new`];
  });
  return lines.length ? lines.join("\n") : null;
}
