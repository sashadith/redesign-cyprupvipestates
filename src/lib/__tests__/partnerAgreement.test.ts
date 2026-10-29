import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementText, PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";

const num = (c: string) => c.match(/^\d+\.\d+/)?.[0] ?? "-";

test("agreement: a final version, not a draft", () => {
  assert.doesNotMatch(PARTNER_AGREEMENT_VERSION, /draft/i);
});

test("agreement: every translation has the English structure, clause for clause", () => {
  const en = agreementText("en");
  for (const l of PARTNER_LOCALES) {
    const a = agreementText(l);
    assert.equal(a.parties.length, en.parties.length, l);
    assert.equal(a.sections.length, en.sections.length, l);
    a.sections.forEach((s, i) => {
      assert.deepEqual(s.clauses.map(num), en.sections[i].clauses.map(num), `${l} section ${i + 1}`);
    });
  }
});

test("agreement: the numbers match the portal's rules in every language", () => {
  for (const l of PARTNER_LOCALES) {
    const txt = JSON.stringify(agreementText(l));
    for (const pct of ["30", "35", "40", "50", "55", "60", "19"]) assert.match(txt, new RegExp(`${pct}\\s?%`), `${l} ${pct}%`);
    assert.match(txt, /CY60038766O/, l);
    assert.match(txt, /HE450005/, l);
    assert.doesNotMatch(txt, /[֐-׿]/, l);
  }
});
