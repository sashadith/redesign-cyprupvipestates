import type { PublicTemperature } from "./insights/temperatureWiring";
import { ACTIVE_LEAD_STATUSES, FUNNEL_STATUSES, SIDE_STATUSES, STATUS_LABEL, isLeadStatus, type LeadStatusValue } from "./leadStatus";
import { CRM_TZ, dayKey } from "./today";

// Pure view model for the /crm pipeline (2026-10-18).

export const STALE_DAYS = 7;
// The Closed column shows leads updated within this window (see boardWhere).
export const CLOSED_WINDOW_DAYS = 90;

// "due": cards with an urgency mark only (applied after the board is built; the where is the same as "all").
export type BoardFilter = "all" | "mine" | "stale" | "due";
export function isBoardFilter(x: unknown): x is BoardFilter {
  return x === "all" || x === "mine" || x === "stale" || x === "due";
}

export type BoardLeadInput = {
  id: string; firstName: string; lastName: string; status: string; source: string;
  languagePreference: string | null; assignedTo: { id: string; name: string } | null;
  projectLabel: string | null; lastContactAt: Date | null; createdAt: Date;
  deals: { price: number; ourCommission: number | null; commissionStatus: string }[];
  // canEditLead(user, lead), decided on the server (access.ts).
  canEdit: boolean;
  // Lead temperature (phase 4a); absent / null = none (closed, lost, keep-contact, or scoring failed).
  temperature?: PublicTemperature | null;
  // Urgency marks (2026-10-30); absent = unknown (treated as not set).
  nextFollowUpAt?: Date | null;
  viewingScheduledAt?: Date | null;
};

/** "now" = due today (yellow), "overdue" = due on an earlier Cyprus day (red, `days` late). */
export type CardUrgency = { level: "now" | "overdue"; days: number; label: string; reason: string };

export type BoardCard = {
  id: string; name: string; lang: string | null; project: string | null; sourceLabel: string; isPartner: boolean;
  ownerInitials: string | null; ownerName: string | null; ageLabel: string; stale: boolean;
  dealValue: number | null; dealCommission: number | null; status: LeadStatusValue; canEdit: boolean;
  temperature: PublicTemperature | null;
  urgency: CardUrgency | null;
};

export type BoardColumn = { status: LeadStatusValue; label: string; cards: BoardCard[]; total: number };

export const SOURCE_LABEL: Record<string, string> = {
  CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", BLOG_ENQUIRY: "Blog", WHATSAPP: "WhatsApp", PHONE: "Phone",
  REFERRAL: "Referral", MANUAL: "Manual", PARTNER: "Partner", ROI_CALCULATOR: "ROI calculator", NEWSLETTER: "Newsletter",
  OTHER: "Other", META_LEAD_AD: "Meta ad", PRIVATE_COLLECTION: "Private Collection", GUIDE_DOWNLOAD: "Guide download",
};

const OPEN_DEAL = new Set(["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT"]);

function age(from: Date, now: Date): { label: string; days: number } {
  const ms = Math.max(0, now.getTime() - from.getTime());
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return { label: "now", days: 0 };
  if (h < 24) return { label: `${h}h`, days: 0 };
  const d = Math.floor(h / 24);
  return { label: `${d}d`, days: d };
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function toCard(lead: BoardLeadInput, now: Date): BoardCard {
  const a = age(lead.lastContactAt ?? lead.createdAt, now);
  const open = lead.deals.filter((d) => OPEN_DEAL.has(d.commissionStatus));
  const status = isLeadStatus(lead.status) ? lead.status : "NEW";
  return {
    id: lead.id,
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    lang: lead.languagePreference ? lead.languagePreference.toUpperCase() : null,
    project: lead.projectLabel,
    sourceLabel: SOURCE_LABEL[lead.source] ?? lead.source,
    isPartner: lead.source === "PARTNER",
    ownerInitials: lead.assignedTo ? initials(lead.assignedTo.name) : null,
    ownerName: lead.assignedTo?.name ?? null,
    ageLabel: a.label,
    // Keep contact / Lost are parked on purpose: never flagged stale.
    stale: a.days >= STALE_DAYS && status !== "CLOSED" && !(SIDE_STATUSES as readonly string[]).includes(status),
    dealValue: open.length ? open.reduce((s, d) => s + d.price, 0) : null,
    dealCommission: open.some((d) => d.ourCommission != null) ? open.reduce((s, d) => s + (d.ourCommission ?? 0), 0) : null,
    status,
    canEdit: lead.canEdit,
    temperature: lead.temperature ?? null,
    urgency: cardUrgency(lead, status, now),
  };
}

// ── Urgency (2026-10-30) ────────────────────────────────────────────────────
// The same signals as the Today page, as one mark per card. Each rule yields the Cyprus day the next step
// was (or is) due; the earliest one wins. Due today → yellow "Act now"; due earlier → red "Overdue Xd".
// Only active funnel stages (Closed, Keep contact and Lost are never marked).

const DAY_MS = 86_400_000;
const ACTIVE = new Set<string>(ACTIVE_LEAD_STATUSES);

/** Whole Cyprus calendar days from day key `a` to day key `b` (b later → positive). */
function dayDiff(a: string, b: string): number {
  const ms = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

const shortDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: CRM_TZ }).format(d);

export function cardUrgency(lead: BoardLeadInput, status: LeadStatusValue, now: Date): CardUrgency | null {
  if (!ACTIVE.has(status)) return null;
  const today = dayKey(now);
  const due: { day: string; reason: string }[] = [];
  const follow = lead.nextFollowUpAt ?? null;
  const followDay = follow ? dayKey(follow) : null;
  const lastTouch = lead.lastContactAt ?? lead.createdAt;

  // A real contact logged on or after the follow-up day answers that follow-up (2026-10-31): otherwise a lead whose
  // automatic cadence is capped stays red after the call was made, and the reminders would nag about done work.
  const followDone = !!followDay && !!lead.lastContactAt && dayKey(lead.lastContactAt) >= followDay;
  if (follow && followDay && !followDone) due.push({ day: followDay, reason: followDay === today ? "Follow-up due today" : `Follow-up was due ${shortDate(follow)}` });
  const planned = !!followDay && followDay > today; // a follow-up in the future: the lead is handled for now

  const viewing = lead.viewingScheduledAt ?? null;
  if (viewing) {
    const vDay = dayKey(viewing);
    if (vDay === today) due.push({ day: today, reason: "Viewing today" });
    // After the viewing nothing was logged: follow up the next day (the most important moment of a lead).
    else if (vDay < today && status === "VIEWING_SCHEDULED" && !planned && (!lead.lastContactAt || lead.lastContactAt < viewing)) {
      const next = dayKey(new Date(viewing.getTime() + DAY_MS));
      due.push({ day: next, reason: `Viewing on ${shortDate(viewing)} not followed up` });
    }
  }
  if (!planned) {
    if (status === "NEW" && !lead.lastContactAt) {
      due.push({ day: dayKey(lead.createdAt), reason: "New lead, not contacted yet" });
    } else if (!follow || followDone) {
      const staleDue = new Date(lastTouch.getTime() + STALE_DAYS * DAY_MS);
      due.push({ day: dayKey(staleDue), reason: `No contact for ${Math.floor((now.getTime() - lastTouch.getTime()) / DAY_MS)} days` });
    }
  }
  const late = due.filter((d) => d.day <= today).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (!late.length) return null;
  const worst = late[0];
  const days = dayDiff(worst.day, today);
  return days > 0
    ? { level: "overdue", days, label: `Overdue ${days}d`, reason: worst.reason }
    : { level: "now", days: 0, label: "Act now", reason: worst.reason };
}

/** Counts for the page header. */
export function urgencyCounts(columns: BoardColumn[]): { now: number; overdue: number } {
  let nowN = 0, overdue = 0;
  for (const c of columns) for (const card of c.cards) {
    if (card.urgency?.level === "now") nowN++;
    else if (card.urgency?.level === "overdue") overdue++;
  }
  return { now: nowN, overdue };
}

export function buildBoard(leads: BoardLeadInput[], now: Date): BoardColumn[] {
  return FUNNEL_STATUSES.map((status) => {
    const cards = leads.filter((l) => l.status === status).map((l) => toCard(l, now));
    return { status, label: STATUS_LABEL[status], cards, total: cards.reduce((s, c) => s + (c.dealValue ?? 0), 0) };
  });
}

/** The "Needs action" view: marked cards only, overdue first (longest late first), then due today. */
export function onlyUrgent(columns: BoardColumn[]): BoardColumn[] {
  const rank = (c: BoardCard) => (c.urgency?.level === "overdue" ? 1_000 + c.urgency.days : c.urgency ? 0 : -1);
  return columns.map((col) => {
    const cards = col.cards.filter((c) => c.urgency).sort((a, b) => rank(b) - rank(a));
    return { ...col, cards, total: cards.reduce((s, c) => s + (c.dealValue ?? 0), 0) };
  });
}

// Keep contact and Lost, in the same column shape so the board can move cards
// between them and the funnel with one state.
export function buildSide(leads: BoardLeadInput[], now: Date): BoardColumn[] {
  return SIDE_STATUSES.map((status) => {
    const cards = leads.filter((l) => l.status === status).map((l) => toCard(l, now));
    return { status, label: STATUS_LABEL[status], cards, total: cards.reduce((s, c) => s + (c.dealValue ?? 0), 0) };
  });
}
