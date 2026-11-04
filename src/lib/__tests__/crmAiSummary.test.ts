import { test } from "node:test";
import assert from "node:assert/strict";
import { summarySystem } from "@/lib/crm/ai/summary";
import { DEFAULT_SUMMARY_LOCALE, SUMMARY_LOCALES, isSummaryLocale } from "@/lib/crm/summaryLocale";

test("the summary offers the four team languages, never Hebrew; English is the default", () => {
  assert.deepEqual([...SUMMARY_LOCALES], ["en", "de", "pl", "ru"].filter((l) => l !== "he"));
  assert.equal(SUMMARY_LOCALES.length, 4);
  assert.ok(!isSummaryLocale("he"));
  assert.ok(!isSummaryLocale("xx"));
  assert.ok(!isSummaryLocale(null));
  assert.equal(DEFAULT_SUMMARY_LOCALE, "en");
});

test("the system prompt names the picked language and keeps the safety rules", () => {
  const want = { en: "English", de: "German", pl: "Polish", ru: "Russian" } as Record<string, string>;
  for (const l of SUMMARY_LOCALES) {
    const s = summarySystem(l);
    assert.match(s, new RegExp(`Write in ${want[l]},`));
    assert.match(s, /untrusted_lead_text/);
    assert.match(s, /Never state a price/);
  }
});
