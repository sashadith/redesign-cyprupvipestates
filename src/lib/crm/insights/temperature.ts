// Lead temperature (CRM v2 phase 4a, Decision 1). Pure, no DB: the server side gathers the
// signals in batched queries and feeds them here. Every weight and threshold is exported so
// it can be tuned in one place.

export type Temperature = "hot" | "warm" | "cold";

export type TemperatureInput = {
  status: string;
  timeline: string | null; // IMMEDIATE | THREE_MONTHS | SIX_MONTHS | ONE_YEAR | TWO_YEARS | JUST_LOOKING
  budgetMin: number | null;
  budgetMax: number | null;
  createdAt: Date;
  lastInboundAt: Date | null; // latest EMAIL_IN / WHATSAPP_IN
  lastRealContactAt: Date | null; // latest CALL / EMAIL_* / WHATSAPP_*
  lastPresentationViewAt: Date | null;
  lastFavoriteAt: Date | null;
};

export type TemperatureResult = { level: Temperature; score: number; reasons: string[] };

export const TEMPERATURE_WEIGHTS = {
  stage: { VIEWING_SCHEDULED: 3, OFFER: 4, RESERVED: 5, COMMUNICATING: 1 } as Record<string, number>,
  timeline: { IMMEDIATE: 2, THREE_MONTHS: 1, JUST_LOOKING: -1 } as Record<string, number>,
  budgetGiven: 1,
  inboundWithin7Days: 3,
  inboundWithin30Days: 1,
  presentationWithin14Days: 2,
  favoriteWithin14Days: 1,
  staleContact: -2, // last real contact > 30 days ago, or never and lead older than 7 days
  oldWithoutProgress: -2, // lead > 90 days old still at NEW / CONTACTED
} as const;

export const TEMPERATURE_HOT_MIN = 5;
export const TEMPERATURE_WARM_MIN = 2;

/** Statuses that carry no temperature. */
export const NO_TEMPERATURE_STATUSES = ["CLOSED", "LOST", "KEEP_CONTACT"] as const;

export const INBOUND_HOT_DAYS = 7;
export const INBOUND_WARM_DAYS = 30;
export const ENGAGEMENT_DAYS = 14;
export const STALE_CONTACT_DAYS = 30;
export const NEVER_CONTACTED_GRACE_DAYS = 7;
export const OLD_LEAD_DAYS = 90;

const DAY_MS = 86_400_000;
const STAGE_REASON: Record<string, string> = {
  VIEWING_SCHEDULED: "Viewing scheduled", OFFER: "Offer in progress", RESERVED: "Reserved", COMMUNICATING: "In conversation",
};
const TIMELINE_REASON: Record<string, string> = {
  IMMEDIATE: "Wants to buy now", THREE_MONTHS: "Buying within 3 months", JUST_LOOKING: "Just looking",
};

function plural(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}
function agoText(n: number): string {
  return n === 0 ? "today" : `${plural(n)} ago`;
}

/** null for CLOSED / LOST / KEEP_CONTACT leads. */
export function leadTemperature(input: TemperatureInput, now: Date): TemperatureResult | null {
  if ((NO_TEMPERATURE_STATUSES as readonly string[]).includes(input.status)) return null;
  const W = TEMPERATURE_WEIGHTS;
  const days = (d: Date) => (now.getTime() - d.getTime()) / DAY_MS;
  const whole = (d: Date) => Math.max(0, Math.floor(days(d)));
  let score = 0;
  const reasons: string[] = [];
  const add = (pts: number, reason: string) => {
    score += pts;
    reasons.push(reason);
  };

  const stagePts = W.stage[input.status];
  if (stagePts) add(stagePts, STAGE_REASON[input.status]);

  const tlPts = input.timeline ? W.timeline[input.timeline] : undefined;
  if (tlPts) add(tlPts, TIMELINE_REASON[input.timeline as string]);

  if (input.budgetMin || input.budgetMax) add(W.budgetGiven, "Budget given");

  if (input.lastInboundAt) {
    const d = days(input.lastInboundAt);
    if (d <= INBOUND_HOT_DAYS) add(W.inboundWithin7Days, `Replied ${agoText(whole(input.lastInboundAt))}`);
    else if (d <= INBOUND_WARM_DAYS) add(W.inboundWithin30Days, `Replied ${agoText(whole(input.lastInboundAt))}`);
  }
  if (input.lastPresentationViewAt && days(input.lastPresentationViewAt) <= ENGAGEMENT_DAYS) {
    add(W.presentationWithin14Days, `Presentation opened ${agoText(whole(input.lastPresentationViewAt))}`);
  }
  if (input.lastFavoriteAt && days(input.lastFavoriteAt) <= ENGAGEMENT_DAYS) {
    add(W.favoriteWithin14Days, `Favorite added ${agoText(whole(input.lastFavoriteAt))}`);
  }

  if (input.lastRealContactAt) {
    if (days(input.lastRealContactAt) > STALE_CONTACT_DAYS) {
      add(W.staleContact, `No contact for ${plural(whole(input.lastRealContactAt))}`);
    }
  } else if (days(input.createdAt) > NEVER_CONTACTED_GRACE_DAYS) {
    add(W.staleContact, `Never contacted (${whole(input.createdAt)} days old)`);
  }

  if ((input.status === "NEW" || input.status === "CONTACTED") && days(input.createdAt) > OLD_LEAD_DAYS) {
    add(W.oldWithoutProgress, `Open for ${whole(input.createdAt)} days without progress`);
  }

  const level: Temperature = score >= TEMPERATURE_HOT_MIN ? "hot" : score >= TEMPERATURE_WARM_MIN ? "warm" : "cold";
  return { level, score, reasons };
}
