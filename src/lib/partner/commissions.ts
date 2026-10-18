// Partner "Commissions" (partner portal phase 3c, Decisions 5–7). Pure, no DB access: the
// where-builders scope.ts uses, the period filter and the DTO a portal page / the CSV may show.
// Isolation rules: every claim/credit-note query carries the partnerId; rows carry only partner-facing
// deal columns (never ourCommission / ourRatePercent), the name the partner submitted (never the
// lead's stored name or contact data) and the credit-note id/number (never bank data).
import type { Prisma } from "@prisma/client";
import type { CommissionCsvRow } from "./commissionsCsv";
import {
  COMMISSION_STAGES, dealView, dealsForClaims, displayStateOf, visibleName,
  type Activity, type CommissionStage, type CommissionStatus, type RawClaim, type RawDeal,
} from "./clientDto";

/**
 * Safety bound of claims and deals loaded for one commissions view. A partner with this many deals
 * would see only the newest ones (the page says so and suggests a shorter period).
 */
export const COMMISSIONS_CAP = 2000;

function needPartner(partnerId: string): string {
  if (typeof partnerId !== "string" || partnerId.trim() === "") throw new Error("partner scope: partnerId required");
  return partnerId;
}

/**
 * Candidate claims: this partner's ACTIVE claims on a not-trashed lead that has any deal. The effective
 * rule (displayStateOf: committed claims stay ACTIVE, expired protection without a live deal drops out)
 * is applied in memory by commissionRows — the same rule as the client detail page.
 */
export function commissionClaimsWhere(partnerId: string): Prisma.PartnerClaimWhereInput {
  return { partnerId: needPartner(partnerId), state: "ACTIVE", lead: { deletedAt: null, deals: { some: {} } } };
}

/** Credit notes of this partner for the given deals. */
export function creditNotesWhere(partnerId: string, dealIds: string[]): Prisma.CreditNoteWhereInput {
  return { partnerId: needPartner(partnerId), dealId: { in: dealIds } };
}

/** One credit note — only the owning partner's (anything else is a 404). */
export function creditNoteWhere(partnerId: string, id: string): Prisma.CreditNoteWhereInput {
  return { id, partnerId: needPartner(partnerId) };
}

// ── Period ──────────────────────────────────────────────────────────────────

export const PERIOD_PRESETS = ["this-year", "last-year", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
/** Inclusive Cyprus calendar days ("YYYY-MM-DD"); null = open end. */
export type Period = { preset: PeriodPreset | "custom"; from: string | null; to: string | null };

/** "YYYY-MM-DD" of an instant in Cyprus. */
export function cyprusDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function validDay(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/**
 * Query params → period. A valid from and/or to is a custom period (swapped when reversed);
 * otherwise the preset (default: all). Years are Cyprus calendar years.
 */
export function parsePeriod(input: { period?: unknown; from?: unknown; to?: unknown }, now: Date = new Date()): Period {
  let from = validDay(input.from);
  let to = validDay(input.to);
  if (from || to) {
    if (from && to && from > to) [from, to] = [to, from];
    return { preset: "custom", from, to };
  }
  const year = Number(cyprusDay(now).slice(0, 4));
  if (input.period === "this-year") return { preset: "this-year", from: `${year}-01-01`, to: `${year}-12-31` };
  if (input.period === "last-year") return { preset: "last-year", from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  return { preset: "all", from: null, to: null };
}

export function inPeriod(day: string, p: Pick<Period, "from" | "to">): boolean {
  return (!p.from || day >= p.from) && (!p.to || day <= p.to);
}

/** Query string that reproduces a period (for links to the report and the CSV). */
export function periodQuery(p: Period): string {
  const q = new URLSearchParams();
  if (p.preset === "custom") {
    if (p.from) q.set("from", p.from);
    if (p.to) q.set("to", p.to);
  } else if (p.preset !== "all") {
    q.set("period", p.preset);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Attachment name of the CSV export; only digits and dashes from the validated period. */
export function csvFilename(p: Pick<Period, "from" | "to">): string {
  return `commissions-${p.from ?? "all"}-${p.to ?? "all"}.csv`;
}

// ── Rows ────────────────────────────────────────────────────────────────────

export type CommissionRow = {
  dealId: string;
  /** What the partner submitted (claim submission), never the CRM lead's name. */
  client: string;
  project: string | null;
  unit: string | null;
  price: number;
  /** Partner's commission in EUR; null = "being calculated" (rate missing). */
  commission: number | null;
  stage: CommissionStatus;
  /** Date of the current stage (expectedAt while EXPECTED). */
  stageAt: Date;
  expectedAt: Date;
  earnedAt: Date | null;
  developerPaidAt: Date | null;
  paidOutAt: Date | null;
  creditNote: { id: string; number: string } | null;
};

export type CreditNoteRef = { id: string; number: string; dealId: string };

/**
 * Deals of the partner's effectively-active claims (same rule as the client detail page: claim
 * ACTIVE, lead not trashed, protection running or committed; deals created at/after activeSince),
 * inside the period (current stage date, inclusive Cyprus days), newest stage first.
 * ctx.deals must hold all deals of the claims' leads (committed check); credit notes are matched by
 * deal id and must already be this partner's (creditNotesWhere).
 */
export function commissionRows(
  claims: RawClaim[],
  ctx: { partnerId: string; now: Date; activity: Map<string, Activity>; deals: RawDeal[]; creditNotes: CreditNoteRef[] },
  period: Pick<Period, "from" | "to">,
): CommissionRow[] {
  const notes = new Map(ctx.creditNotes.map((n) => [n.dealId, { id: n.id, number: n.number }]));
  const out: CommissionRow[] = [];
  const seen = new Set<string>();
  for (const claim of claims) {
    if (claim.partnerId !== ctx.partnerId) throw new Error("partner scope: claim of another partner");
    if (!claim.lead || claim.lead.deletedAt) continue;
    if (displayStateOf(claim, { activity: ctx.activity, now: ctx.now, deals: ctx.deals }) !== "ACTIVE") continue;
    const client = visibleName(claim);
    for (const d of dealsForClaims([claim], ctx.deals)) {
      if (seen.has(d.id)) continue;
      const v = dealView(d);
      const stageAt = v.statusAt ?? d.expectedAt;
      if (!inPeriod(cyprusDay(stageAt), period)) continue;
      seen.add(d.id);
      out.push({
        dealId: d.id,
        client,
        project: v.project,
        unit: v.unit,
        price: v.price,
        commission: v.commission,
        stage: v.status,
        stageAt,
        expectedAt: d.expectedAt,
        earnedAt: d.earnedAt,
        developerPaidAt: d.developerPaidAt,
        paidOutAt: d.paidOutAt,
        creditNote: notes.get(d.id) ?? null,
      });
    }
  }
  return out.sort((a, b) => b.stageAt.getTime() - a.stageAt.getTime() || (a.dealId < b.dealId ? -1 : 1));
}

/** Sum per stage; CANCELLED rows and rows still being calculated are listed but not counted. */
export function commissionRowTotals(rows: Pick<CommissionRow, "stage" | "commission">[]): Record<CommissionStage, number> {
  const out = Object.fromEntries(COMMISSION_STAGES.map((s) => [s, 0])) as Record<CommissionStage, number>;
  for (const r of rows) {
    if (r.stage === "CANCELLED" || r.commission == null) continue;
    out[r.stage] += r.commission;
  }
  return out;
}

/** CSV rows from the DTO only (commissionsCsv adds the header and the localized labels). */
export function toCsvRows(rows: CommissionRow[]): CommissionCsvRow[] {
  return rows.map((r) => ({
    client: r.client,
    project: r.project ?? "",
    unit: r.unit ?? "",
    price: r.price,
    commission: r.commission,
    stage: r.stage,
    expectedAt: r.expectedAt,
    earnedAt: r.earnedAt,
    developerPaidAt: r.developerPaidAt,
    paidOutAt: r.paidOutAt,
    creditNoteNumber: r.creditNote?.number ?? null,
  }));
}
