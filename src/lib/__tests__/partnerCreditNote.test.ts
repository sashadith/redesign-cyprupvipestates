import { test } from "node:test";
import assert from "node:assert/strict";
import { clientInitials, creditNoteModel, cyprusDateParts, creditNoteNumber, CY_VAT_RATE, formatEuro, vatFor } from "@/lib/partner/creditNote";

test("number: padding and year", () => {
  assert.equal(creditNoteNumber(2026, 1), "CVE-GS-2026-0001");
  assert.equal(creditNoteNumber(2027, 123), "CVE-GS-2027-0123");
  assert.equal(creditNoteNumber(2026, 12345), "CVE-GS-2026-12345");
});

test("vatFor: three modes and half rounding", () => {
  assert.equal(CY_VAT_RATE, 19);
  assert.deepEqual(vatFor("NONE", 10000), { rate: null, vat: 0, total: 10000 });
  assert.deepEqual(vatFor("REVERSE_CHARGE", 10000), { rate: null, vat: 0, total: 10000 });
  assert.deepEqual(vatFor("CY_VAT", 10000), { rate: 19, vat: 1900, total: 11900 });
  // 19% of 1050 = 199.5 -> 200 ; 19% of 1000.5 not whole; 19% of 50 = 9.5 -> 10
  assert.equal(vatFor("CY_VAT", 1050).vat, 200);
  assert.equal(vatFor("CY_VAT", 50).vat, 10);
  assert.equal(vatFor("CY_VAT", 1).vat, 0);
});

test("initials", () => {
  assert.equal(clientInitials("nina", "Bauer"), "N. B.");
  assert.equal(clientInitials("Иван", "Петров"), "И. П.");
  assert.equal(clientInitials("  Łukasz", "O'Neil"), "Ł. O.");
  assert.equal(clientInitials("Anna", ""), "A.");
  // One code point per initial: ß upper-cases to "SS" but stays one letter.
  assert.equal(clientInitials("ßarah", "ßmith"), "S. S.");
  assert.equal(clientInitials("ärger", "öz"), "Ä. Ö.");
  // No letters at all: the helper itself returns the dash.
  assert.equal(clientInitials("", ""), "—");
  assert.equal(clientInitials(" - ", "12"), "—");
});

test("formatEuro", () => {
  assert.equal(formatEuro(12345), "€ 12,345");
  assert.equal(formatEuro(0), "€ 0");
  assert.equal(formatEuro(1234567), "€ 1,234,567");
});

const base = {
  issuer: { legalName: "Cyprus VIP Estates Ltd", address: "1 Main St\nLimassol", vatId: "CY99999999Z", regNo: "HE123456" },
  partner: { billingName: "Müller GmbH", billingAddress: "Hauptstr. 1\n10115 Berlin", vatId: "DE123456789" },
  number: "CVE-GS-2026-0001", issuedAt: new Date("2026-10-18T12:00:00Z"),
  deal: { projectName: "Sea Breeze", unitLabel: "A101" }, clientInitials: "N. B.",
  net: 12345, vatMode: "CY_VAT" as const, ibanLast4: "3000", final: false,
};

test("model: draft footer unless final; no full IBAN", () => {
  const m = creditNoteModel(base);
  assert.match(m.draftFooter!, /Draft — content to be confirmed by our tax adviser \/ Entwurf/);
  assert.equal(creditNoteModel({ ...base, final: true }).draftFooter, null);
  const json = JSON.stringify(m);
  assert.ok(json.includes("•••• 3000"));
  assert.ok(!/[A-Z]{2}\d{2}[A-Z0-9]{10,}/.test(json));
  assert.equal(m.title, "Credit note / Gutschrift");
  assert.equal(m.date, "18/10/2026");
  assert.deepEqual(m.rows.map((r) => r.amount), ["€ 12,345", "€ 2,346", "€ 14,691"]);
  assert.ok(m.reference.includes("N. B."));
  assert.equal(m.vatNote, null);
});

test("model: reverse charge, no vat, recipient vat id optional", () => {
  const rc = creditNoteModel({ ...base, vatMode: "REVERSE_CHARGE" });
  assert.match(rc.vatNote!, /Art\. 196 Directive 2006\/112\/EC/);
  assert.deepEqual(rc.rows.map((r) => r.amount), ["€ 12,345", "€ 0", "€ 12,345"]);
  const none = creditNoteModel({ ...base, vatMode: "NONE", partner: { ...base.partner, vatId: null } });
  assert.match(none.vatNote!, /No VAT charged/);
  assert.ok(!none.recipientLines.some((l) => l.includes("USt-IdNr")));
});

test("document date is the Cyprus calendar day (Asia/Nicosia), not UTC", () => {
  // 31 Dec 22:30 UTC is already 1 Jan 00:30 in Cyprus (UTC+2 in winter).
  const nye = new Date("2026-12-31T22:30:00Z");
  assert.deepEqual(cyprusDateParts(nye), { year: 2027, month: 1, day: 1 });
  assert.equal(creditNoteModel({ ...base, issuedAt: nye }).date, "01/01/2027");
  assert.equal(creditNoteModel({ ...base, issuedAt: new Date("2026-12-31T21:30:00Z") }).date, "31/12/2026");
  // Summer time (UTC+3): 21:30 UTC on 30 June is 1 July in Cyprus.
  assert.equal(creditNoteModel({ ...base, issuedAt: new Date("2026-06-30T21:30:00Z") }).date, "01/07/2026");
});
