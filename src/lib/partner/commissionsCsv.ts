import { dict, type PartnerLocale } from "./i18n";

export interface CommissionCsvRow {
  client: string;
  project: string;
  unit: string;
  price: number | null;
  commission: number | null;
  stage: "EXPECTED" | "EARNED" | "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED";
  expectedAt: Date | null;
  earnedAt: Date | null;
  developerPaidAt: Date | null;
  paidOutAt: Date | null;
  creditNoteNumber: string | null;
}

/** Quote when needed; neutralise spreadsheet formulas in text cells. */
export function csvCell(v: string | number | null): string {
  if (v == null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Cyprus calendar day, like the commissions page's period filter.
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" });
const day = (d: Date | null) => (d ? DAY.format(d) : null);

export function commissionsCsv(rows: CommissionCsvRow[], locale: PartnerLocale): string {
  const d = dict(locale);
  const c = d.commissions;
  const header = [c.colClient, c.colProject, c.colUnit, c.colPrice, c.colCommission, c.colStage, c.colExpected, c.colEarned, c.colDeveloperPaid, c.colPaidOut, c.colCreditNote];
  const body = rows.map((r) => [
    r.client, r.project, r.unit, r.price, r.commission == null ? c.calculating : r.commission, d.commission[r.stage],
    day(r.expectedAt), day(r.earnedAt), day(r.developerPaidAt), day(r.paidOutAt), r.creditNoteNumber,
  ]);
  return "﻿" + [header, ...body].map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
