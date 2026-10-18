// Pure credit-note (Gutschrift / self-billing) data model. Everything the PDF
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

const firstLetter = (s: string): string => {
  for (const ch of Array.from(s.trim())) if (!/[\s\-'’.,()\d]/.test(ch)) return ch.toUpperCase();
  return "";
};

/** "Nina", "Bauer" -> "N. B." (GDPR: only initials appear on the document). */
export function clientInitials(first: string, last: string): string {
  return [firstLetter(first), firstLetter(last)].filter(Boolean).map((c) => `${c}.`).join(" ");
}

/** One euro formatter: "€ 12,345" (en-GB grouping, whole euros). */
export function formatEuro(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}€ ${digits}`;
}

const formatDate = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

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
  const rows: CreditNoteModel["rows"] = [{ label: "Net amount / Nettobetrag", amount: formatEuro(i.net) }];
  let vatNote: string | null = null;
  if (i.vatMode === "CY_VAT") {
    rows.push({ label: `VAT ${CY_VAT_RATE}% / MwSt. ${CY_VAT_RATE} %`, amount: formatEuro(v.vat) });
  } else if (i.vatMode === "REVERSE_CHARGE") {
    rows.push({ label: "VAT / MwSt.", amount: formatEuro(0) });
    vatNote =
      "Reverse charge — VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC) / " +
      "Reverse Charge — Steuerschuldnerschaft des Leistungsempfängers (Art. 196 Richtlinie 2006/112/EG)";
  } else {
    rows.push({ label: "VAT / MwSt.", amount: formatEuro(0) });
    vatNote = "No VAT charged / Keine Umsatzsteuer berechnet";
  }
  rows.push({ label: "Total / Gesamtbetrag", amount: formatEuro(v.total), strong: true });

  const issuerLines = [i.issuer.legalName, ...lines(i.issuer.address), `VAT ID / USt-IdNr.: ${i.issuer.vatId}`, `Reg. no. / Handelsregister-Nr.: ${i.issuer.regNo}`];
  const recipientLines = [i.partner.billingName, ...lines(i.partner.billingAddress)];
  if (i.partner.vatId) recipientLines.push(`VAT ID / USt-IdNr.: ${i.partner.vatId}`);

  return {
    title: "Credit note / Gutschrift",
    numberLabel: "Credit note no. / Gutschrift-Nr.",
    number: i.number,
    dateLabel: "Date / Datum",
    date: formatDate(i.issuedAt),
    issuerLabel: "Issued on behalf of the recipient by / Ausgestellt im Namen des Empfängers durch",
    issuerLines,
    recipientLabel: "Recipient / Empfänger",
    recipientLines,
    referenceLabel: "Service / Leistung",
    reference: `Referral commission — ${i.deal.projectName} ${i.deal.unitLabel}, client ${i.clientInitials} / Vermittlungsprovision — ${i.deal.projectName} ${i.deal.unitLabel}, Kunde ${i.clientInitials}`,
    rows,
    vatNote,
    paymentNote: `Paid by bank transfer to IBAN •••• ${i.ibanLast4} / Zahlung per Überweisung auf IBAN •••• ${i.ibanLast4}`,
    selfBillingNote:
      "This credit note replaces an invoice from the recipient (self-billing). / Diese Gutschrift ersetzt eine Rechnung des Empfängers (Selbstfakturierung).",
    draftFooter: i.final
      ? null
      : "Draft — content to be confirmed by our tax adviser / Entwurf — Inhalt wird von unserem Steuerberater bestätigt",
  };
}
