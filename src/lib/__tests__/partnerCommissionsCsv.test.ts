import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionsCsv, csvCell, type CommissionCsvRow } from "@/lib/partner/commissionsCsv";
import { dict } from "@/lib/partner/i18n";

const row: CommissionCsvRow = {
  client: "=HYPERLINK(\"x\")", project: "Sea; Breeze", unit: "A\"1", price: 300000, commission: 4500, stage: "PAID_OUT",
  expectedAt: new Date("2026-09-01T00:00:00Z"), earnedAt: null, developerPaidAt: null, paidOutAt: new Date("2026-10-18T09:00:00Z"),
  creditNoteNumber: "CVE-GS-2026-0001", vat: 855, totalPaid: 5355,
};

test("csv: BOM, CRLF, semicolons, quoting, formula guard", () => {
  const out = commissionsCsv([row, { ...row, client: "+1", commission: null, stage: "EXPECTED", creditNoteNumber: null, vat: 1, totalPaid: 2 }], "en");
  assert.equal(out.charCodeAt(0), 0xfeff);
  const lines = out.slice(1).split("\r\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[3], "");
  assert.equal(lines[0], "Client;Project;Unit;Price;Commission (net);Status;Expected;Earned;Received from developer;Paid out;Credit note;VAT;Total paid");
  assert.equal(lines[1], `"'=HYPERLINK(""x"")";"Sea; Breeze";"A""1";300000;4500;Paid out to you;2026-09-01;;;2026-10-18;CVE-GS-2026-0001;855;5355`);
  assert.ok(lines[2].startsWith("'+1;"));
  assert.ok(lines[2].includes("being calculated"));
  assert.ok(lines[2].endsWith(";;;"), "VAT and total paid stay empty without a credit note");
});

test("csvCell: guards", () => {
  for (const s of ["=1", "+1", "-1", "@a", "\tx", "\rx"]) assert.ok(csvCell(s).replace(/^"/, "").startsWith("'"), JSON.stringify(s));
  assert.equal(csvCell(-5), "-5");
  assert.equal(csvCell("a\nb"), '"a\nb"');
  assert.equal(csvCell(null), "");
});

test("csv: header localized", () => {
  const de = commissionsCsv([], "de");
  assert.ok(de.includes(dict("de").commissions.colClient));
});

test("dict: new sections have identical keys in all locales, no Hebrew", () => {
  const keys = (o: unknown, p = ""): string[] =>
    Object.entries(o as object).flatMap(([k, v]) => (typeof v === "object" && v ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const en = keys(dict("en")).sort();
  for (const l of ["de", "pl", "ru"] as const) assert.deepEqual(keys(dict(l)).sort(), en, l);
  for (const l of ["en", "de", "pl", "ru"] as const) assert.ok(!/[֐-׿]/.test(JSON.stringify(dict(l))));
  for (const k of ["err.iban", "err.bic", "err.vatId", "err.holder", "err.billingName", "err.billingAddress"]) {
    assert.ok(en.includes(k), k);
  }
});
