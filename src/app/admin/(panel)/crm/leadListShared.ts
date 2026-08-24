// Plain constants/types/pure functions shared between the server-rendered
// list page (page.tsx) and the client-side interactive row (LeadRow.tsx).
// No "use server"/"use client" here on purpose — both boundaries import
// from this file freely since nothing in it touches prisma or the DOM.

// "Contact" = an actual outreach/reply, not internal notes or system-generated
// rows (status changes, presentation-view tracking). Presentation delivery by
// email already lands as an EMAIL_OUT interaction (see PropertyMatching's
// "Send by email"), so it's covered without a separate case here.
export const LAST_CONTACT_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"] as const;
export const LAST_CONTACT_LABEL: Record<string, string> = {
  CALL: "Call",
  EMAIL_OUT: "Email",
  EMAIL_IN: "Email",
  WHATSAPP_OUT: "WhatsApp",
  WHATSAPP_IN: "WhatsApp",
};

// 2026-08-11 lead-list rebuild — urgency now only decides which of the three
// active COLOR blocks (Red/Yellow/Green) a lead lands in; it's no longer a
// per-row sort key or a separate "Urgency" dropdown sort (block grouping
// already conveys that, a redundant sort added no information). HOT and
// KEEP_CONTACT leads are pulled out of this classification entirely before
// it's ever called — see the bucketing loop in page.tsx.
export const DAY_MS = 86_400_000;
export type ColorBand = "RED" | "YELLOW" | "GREEN";
export const BAND_STYLE: Record<ColorBand, { dot: string; border: string }> = {
  RED: { dot: "bg-red-600", border: "border-l-red-600" },
  YELLOW: { dot: "bg-amber-500", border: "border-l-amber-500" },
  GREEN: { dot: "bg-green-600", border: "border-l-green-600" },
};

export function agoLabel(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  return days <= 0 ? "less than a day" : days === 1 ? "1 day" : `${days} days`;
}

export function computeBand(
  lead: { status: string; nextFollowUpAt: Date | null; autoFollowUpCount: number; createdAt: Date },
  hasContact: boolean,
  now: number,
): { band: ColorBand; reason: string } {
  if (lead.status === "NEW" && !hasContact) {
    // A follow-up scheduled in the FUTURE is a decision an admin made, so this
    // branch must not call the lead overdue and contradict it. Reported
    // 2026-08-24: two hot leads kept their red dot after their follow-ups were
    // moved out to future dates, because this branch returns before the date is
    // ever looked at further down.
    //
    // Still YELLOW, never GREEN: the first contact genuinely has not happened
    // yet, so the lead must not drop into the calm band and out of attention —
    // it is scheduled, not handled. Phrasing mirrors the cadence branches below
    // ("due today" / "in N days") so the two read as one scheme.
    if (lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() > now) {
      const until = lead.nextFollowUpAt.getTime() - now;
      return {
        band: "YELLOW",
        reason: until <= DAY_MS
          ? "New lead — first contact due today"
          : `New lead — first contact scheduled in ${Math.ceil(until / DAY_MS)} days`,
      };
    }
    const age = now - lead.createdAt.getTime();
    if (age > DAY_MS) {
      return { band: "RED", reason: `New lead — first contact overdue by ${agoLabel(age - DAY_MS)}` };
    }
    return { band: "YELLOW", reason: "New lead — first contact pending" };
  }
  // Cadence-cap → RED: the automatic chain gave up: this is an action item,
  // not neutral, and the Action Center has no rule covering it either (it
  // never references autoFollowUpCount), so the color is this lead's only
  // signal that something needs a human. No-date → YELLOW: a lead an admin
  // hasn't yet scheduled anything for — a gap, not a rest state, but not as
  // sharp as an exhausted automatic chain.
  if (lead.autoFollowUpCount >= 3 && lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() <= now) {
    return { band: "RED", reason: "Automatic follow-ups exhausted — needs your decision" };
  }
  if (!lead.nextFollowUpAt) {
    return { band: "YELLOW", reason: "No follow-up scheduled" };
  }
  const diff = lead.nextFollowUpAt.getTime() - now;
  if (diff < 0) {
    return { band: "RED", reason: `Follow-up overdue since ${agoLabel(-diff)}` };
  }
  if (diff <= DAY_MS) {
    return { band: "YELLOW", reason: "Due today" };
  }
  return { band: "GREEN", reason: `Follow-up due in ${Math.ceil(diff / DAY_MS)} days` };
}

export const money = (n: number | null) => (n == null ? "—" : `€${n.toLocaleString("en-GB")}`);

export type LeadRowData = {
  id: string; firstName: string; lastName: string;
  languagePreference: string | null; sourceLocale: string | null;
  countryOfResidence: string | null; status: string; createdAt: Date;
  hotAt: Date | null; budgetMax: number | null; viewingScheduledAt: Date | null;
  email: string | null; phone: string | null;
  assignedTo: { name: string } | null;
  interactions: { occurredAt: Date; type: string }[];
};
