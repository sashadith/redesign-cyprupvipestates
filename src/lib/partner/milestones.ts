// Partner-facing stages and timeline milestones. Pure, no DB access. Keys are dotted partner-dictionary keys.
import { isLeadStatus, type LeadStatusValue, type LostReasonValue } from "@/lib/crm/leadStatus";
import { REAL_CONTACT_TYPES } from "./claims";

export const PARTNER_STEPS = [
  "stages.submitted", "stages.contacted", "stages.inTalks", "stages.viewing", "stages.offer", "stages.reserved", "stages.sold",
] as const;

const STEP_BY_STATUS: Partial<Record<LeadStatusValue, number>> = {
  NEW: 1, CONTACTED: 2, COMMUNICATING: 3, VIEWING_SCHEDULED: 4, OFFER: 5, RESERVED: 6, CLOSED: 7,
};

export function partnerStage(status: LeadStatusValue): { step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null; key: string } {
  if (status === "KEEP_CONTACT") return { step: null, key: "stages.onHold" };
  if (status === "LOST") return { step: null, key: "stages.lost" };
  const step = STEP_BY_STATUS[status] as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  return { step, key: PARTNER_STEPS[step - 1] };
}

export type LostCategory = "budget" | "timing" | "other_choice" | "unreachable" | "other";

const LOST_MAP: Record<LostReasonValue, LostCategory> = {
  BUDGET: "budget",
  BOUGHT_ELSEWHERE: "other_choice",
  UNREACHABLE: "unreachable",
  NOT_INTERESTED: "other",
  TIMING: "timing",
  INVALID: "other",
  OTHER: "other",
};

/** Neutral category only; the free-text lost note is never exposed to partners. */
export function lostCategory(reason: LostReasonValue | null): LostCategory {
  return (reason && LOST_MAP[reason]) || "other";
}

export interface Milestone {
  at: Date;
  key: string;
  vars?: Record<string, string>;
  body?: string;
}

interface InteractionLike { type: string; occurredAt: Date; metadata: unknown }

const STATUS_MILESTONE: Partial<Record<LeadStatusValue, string>> = {
  CONTACTED: "milestones.statusContacted",
  COMMUNICATING: "milestones.statusCommunicating",
  VIEWING_SCHEDULED: "milestones.statusViewing",
  OFFER: "milestones.statusOffer",
  RESERVED: "milestones.statusReserved",
  CLOSED: "milestones.statusClosed",
  KEEP_CONTACT: "milestones.statusOnHold",
  LOST: "milestones.statusLost",
};

const isRealContact = (t: string) => (REAL_CONTACT_TYPES as readonly string[]).includes(t);
const meta = (m: unknown): Record<string, unknown> => (m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {});

function firstRealContactAfter(claimCreatedAt: Date, interactions: InteractionLike[]): Date | null {
  let best: Date | null = null;
  for (const i of interactions) {
    if (!isRealContact(i.type) || i.occurredAt < claimCreatedAt) continue;
    if (!best || i.occurredAt < best) best = i.occurredAt;
  }
  return best;
}

export function milestonesFor(input: {
  claimCreatedAt: Date;
  interactions: InteractionLike[];
  deals: { createdAt: Date; earnedAt: Date | null; cancelledAt: Date | null; commissionStatus: string }[];
  messages: { createdAt: Date; body: string }[];
}): Milestone[] {
  const { claimCreatedAt, interactions, deals, messages } = input;
  const out: Milestone[] = [];
  const push = (m: Milestone) => { if (m.at >= claimCreatedAt) out.push(m); };

  for (const i of interactions) {
    if (i.type === "STATUS_CHANGE") {
      const to = meta(i.metadata).toStatus;
      const key = isLeadStatus(to) ? STATUS_MILESTONE[to] : undefined;
      if (key) push({ at: i.occurredAt, key });
    } else if (i.type === "BOOKING_EVENT" && meta(i.metadata).legacyType === "BOOKING_CONFIRMED") {
      push({ at: i.occurredAt, key: "milestones.viewingConfirmed" });
    }
  }
  const first = firstRealContactAfter(claimCreatedAt, interactions);
  if (first) push({ at: first, key: "milestones.firstContact" });

  for (const d of deals) {
    push({ at: d.createdAt, key: "milestones.dealCreated" });
    if (d.earnedAt) push({ at: d.earnedAt, key: "milestones.dealEarned" });
    if (d.cancelledAt) push({ at: d.cancelledAt, key: "milestones.dealCancelled" });
  }
  for (const m of messages) push({ at: m.createdAt, key: "milestones.message", body: m.body });

  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Minutes from claim creation to the first real contact after it; null if none yet. */
export function responseMinutes(claimCreatedAt: Date, interactions: InteractionLike[]): number | null {
  const first = firstRealContactAfter(claimCreatedAt, interactions);
  return first ? Math.round((first.getTime() - claimCreatedAt.getTime()) / 60000) : null;
}
