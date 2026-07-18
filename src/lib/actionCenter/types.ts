// Action Center — NOT a chronological notification feed. Every item represents
// a LIVE CONDITION: it exists exactly while the underlying query says it's
// true, and disappears the next time the dashboard loads if the condition no
// longer holds. There is no "mark as read" and no persisted item table — see
// index.ts for how items are computed fresh on every call, with only a
// snooze override layered on top (action_center_snoozes, see snooze.ts).

export type Severity = "URGENT" | "ACTION" | "INFO";
export type Category = "DEVELOPERS" | "CRM" | "SYSTEM" | "SEO" | "SEO_ADVISOR";

export type ActionItem = {
  // Stable, derived from the entity the item is about (e.g. `sold-out:<developmentId>`)
  // — NOT a random id — so snoozing and de-duplication work across page loads.
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  deepLink: string;
  // When the underlying condition became true (or best-effort proxy where the
  // exact moment isn't tracked — each rule documents its own approximation).
  since: Date;
};

export const SEVERITY_ORDER: Record<Severity, number> = { URGENT: 0, ACTION: 1, INFO: 2 };
