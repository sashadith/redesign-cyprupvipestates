import { FUNNEL_STATUSES, STATUS_LABEL, isLeadStatus, type LeadStatusValue } from "./leadStatus";

// Pure view model for the /crm pipeline (2026-10-18).

export const STALE_DAYS = 7;
// The Closed column shows leads updated within this window (see boardWhere).
export const CLOSED_WINDOW_DAYS = 90;

export type BoardFilter = "all" | "mine" | "stale";
export function isBoardFilter(x: unknown): x is BoardFilter {
  return x === "all" || x === "mine" || x === "stale";
}

export type BoardLeadInput = {
  id: string; firstName: string; lastName: string; status: string; source: string;
  languagePreference: string | null; assignedTo: { id: string; name: string } | null;
  projectLabel: string | null; lastContactAt: Date | null; createdAt: Date;
  deals: { price: number; ourCommission: number | null; commissionStatus: string }[];
  // canEditLead(user, lead), decided on the server (access.ts).
  canEdit: boolean;
};

export type BoardCard = {
  id: string; name: string; lang: string | null; project: string | null; sourceLabel: string; isPartner: boolean;
  ownerInitials: string | null; ownerName: string | null; ageLabel: string; stale: boolean;
  dealValue: number | null; dealCommission: number | null; status: LeadStatusValue; canEdit: boolean;
};

export type BoardColumn = { status: LeadStatusValue; label: string; cards: BoardCard[]; total: number };

export const SOURCE_LABEL: Record<string, string> = {
  CONTACT_FORM: "Website", PROJECT_ENQUIRY: "Project page", BLOG_ENQUIRY: "Blog", WHATSAPP: "WhatsApp", PHONE: "Phone",
  REFERRAL: "Referral", MANUAL: "Manual", PARTNER: "Partner", ROI_CALCULATOR: "ROI calculator", NEWSLETTER: "Newsletter",
  OTHER: "Other", META_LEAD_AD: "Meta ad", PRIVATE_COLLECTION: "Private Collection",
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
    stale: a.days >= STALE_DAYS && status !== "CLOSED",
    dealValue: open.length ? open.reduce((s, d) => s + d.price, 0) : null,
    dealCommission: open.some((d) => d.ourCommission != null) ? open.reduce((s, d) => s + (d.ourCommission ?? 0), 0) : null,
    status,
    canEdit: lead.canEdit,
  };
}

export function buildBoard(leads: BoardLeadInput[], now: Date): BoardColumn[] {
  return FUNNEL_STATUSES.map((status) => {
    const cards = leads.filter((l) => l.status === status).map((l) => toCard(l, now));
    return { status, label: STATUS_LABEL[status], cards, total: cards.reduce((s, c) => s + (c.dealValue ?? 0), 0) };
  });
}
