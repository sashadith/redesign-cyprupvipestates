// Pure credit-note (self-billing, English only) data model. Everything the PDF
// shows is preformatted here; the renderer only lays it out. Never holds a full IBAN.

export const CY_VAT_RATE = 19;

export type VatMode = "NONE" | "CY_VAT" | "REVERSE_CHARGE";

// amount * pct / 100 in floats turns exact halves into off-by-epsilon values;
// work in basis points like src/lib/crm/commission.ts.
const percentOf = (amount: number, percent: number) => Math.round((amount * Math.round(percent * 100)) / 10000);

export function creditNoteNumber(year: number, seq: number): string {
  return `CVE-GS-${year}-${String(seq).padStart(4, "0")}`;
}

export function vatFor(mode: VatMode, net: number): { rate: number | null; vat: number; total: number } {
  if (mode === "CY_VAT") {
    const vat = percentOf(net, CY_VAT_RATE);
    return { rate: CY_VAT_RATE, vat, total: net + vat };
  }
  return { rate: null, vat: 0, total: net };
}

// One code point only: "ß".toUpperCase() is "SS", which would read as two letters.
const firstLetter = (s: string): string => {
  for (const ch of Array.from(String(s ?? "").trim())) {
    if (/[\s\-'’.,()\d]/.test(ch)) continue;
    return Array.from(ch.toLocaleUpperCase())[0] ?? "";
  }
  return "";
};

/** "Nina", "Bauer" -> "N. B." (GDPR: only initials appear on the document); no letters at all -> "—". */
export function clientInitials(first: string, last: string): string {
  const out = [firstLetter(first), firstLetter(last)].filter(Boolean).map((c) => `${c}.`).join(" ");
  return out || "—";
}

/** One euro formatter: "€ 12,345" (en-GB grouping, whole euros). */
export function formatEuro(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}€ ${digits}`;
}

const CY_PARTS = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date of an instant in Cyprus time (Asia/Nicosia) — the credit note's document date and year. */
export function cyprusDateParts(d: Date): { year: number; month: number; day: number } {
  const p = Object.fromEntries(CY_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

const formatDate = (d: Date) => {
  const p = cyprusDateParts(d);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
};

export interface CreditNoteInput {
  issuer: { legalName: string; address: string; vatId: string; regNo: string };
  partner: { billingName: string; billingAddress: string; vatId: string | null };
  number: string;
  issuedAt: Date;
  deal: { projectName: string; unitLabel: string };
  clientInitials: string;
  net: number;
  vatMode: VatMode;
  ibanLast4: string;
  final: boolean;
}

export interface CreditNoteModel {
  title: string;
  numberLabel: string;
  number: string;
  dateLabel: string;
  date: string;
  issuerLabel: string;
  /** Brand line above the legal entity ("Cyprus VIP Estates is a project of"). */
  issuerIntro: string;
  issuerLines: string[];
  recipientLabel: string;
  recipientLines: string[];
  referenceLabel: string;
  reference: string;
  rows: { label: string; amount: string; strong?: boolean }[];
  vatNote: string | null;
  paymentNote: string;
  selfBillingNote: string;
  draftFooter: string | null;
}

const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export function creditNoteModel(i: CreditNoteInput): CreditNoteModel {
  const v = vatFor(i.vatMode, i.net);
  const rows: CreditNoteModel["rows"] = [{ label: "Net amount", amount: formatEuro(i.net) }];
  let vatNote: string | null = null;
  if (i.vatMode === "CY_VAT") {
    rows.push({ label: `VAT ${CY_VAT_RATE}%`, amount: formatEuro(v.vat) });
  } else if (i.vatMode === "REVERSE_CHARGE") {
    rows.push({ label: "VAT", amount: formatEuro(0) });
    vatNote =
      "Reverse charge — VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC)";
  } else {
    rows.push({ label: "VAT", amount: formatEuro(0) });
    vatNote = "No VAT charged";
  }
  rows.push({ label: "Total", amount: formatEuro(v.total), strong: true });

  const issuerLines = [i.issuer.legalName, ...lines(i.issuer.address), `VAT no.: ${i.issuer.vatId}`, `Reg. no.: ${i.issuer.regNo}`];
  const recipientLines = [i.partner.billingName, ...lines(i.partner.billingAddress)];
  if (i.partner.vatId) recipientLines.push(`VAT no.: ${i.partner.vatId}`);

  return {
    title: "Credit note",
    numberLabel: "Credit note no.",
    number: i.number,
    dateLabel: "Date",
    date: formatDate(i.issuedAt),
    issuerLabel: "Issued on behalf of the recipient by",
    issuerIntro: "Cyprus VIP Estates is a project of",
    issuerLines,
    recipientLabel: "Recipient",
    recipientLines,
    referenceLabel: "Service",
    reference: `Referral commission — ${i.deal.projectName} ${i.deal.unitLabel}, client ${i.clientInitials}`,
    rows,
    vatNote,
    paymentNote: `Paid by bank transfer to IBAN •••• ${i.ibanLast4}`,
    selfBillingNote:
      "This credit note replaces an invoice from the recipient (self-billing).",
    draftFooter: i.final
      ? null
      : "Draft — content to be confirmed by our tax adviser",
  };
}
