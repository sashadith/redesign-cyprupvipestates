import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LegalDoc, LegalBlock } from "@/app/preview-legal/[lang]/[doc]/types";
import { PRIVACY_EN } from "@/app/preview-legal/[lang]/[doc]/privacy.en";
import { PRIVACY_DE } from "@/app/preview-legal/[lang]/[doc]/privacy.de";
import { PRIVACY_PL } from "@/app/preview-legal/[lang]/[doc]/privacy.pl";
import { PRIVACY_RU } from "@/app/preview-legal/[lang]/[doc]/privacy.ru";
import { PRIVACY_HE } from "@/app/preview-legal/[lang]/[doc]/privacy.he";
import { ATTRIBUTION_DAYS, ATTRIBUTION_COOKIE } from "@/lib/attribution";
import { cookieSettingsLabel } from "@/app/components/CustomCookieConsent/cookieSettings";

/* Why this exists (2026-11-02).
 *
 * The privacy policy is five hand-maintained files. registry.ts only checks
 * that each is a LegalDoc, so a paragraph added to the English original and
 * forgotten in Polish compiled fine — and a policy that tells one language
 * group less than another is a defect in every one of them.
 *
 * The second half pins the text to the code: the cookie lifetimes the policy
 * states are read from the code that sets them, so changing one without the
 * other fails here instead of turning the policy into a false promise.
 */

const DOCS: Record<string, LegalDoc> = { en: PRIVACY_EN, de: PRIVACY_DE, pl: PRIVACY_PL, ru: PRIVACY_RU, he: PRIVACY_HE };
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const shape = (b: LegalBlock) => ("items" in b ? `${b.kind}(${b.items.length})` : b.kind);
const blockText = (b: LegalBlock): string =>
  b.kind === "p" || b.kind === "callout" ? b.text
  : b.kind === "list" ? b.items.join("\n")
  : b.items.map((i) => `${i.term}\n${i.text}`).join("\n");
const fullText = (d: LegalDoc) => d.sections.map((s) => `${s.title}\n${s.blocks.map(blockText).join("\n")}`).join("\n");

test("every language has the same sections, block kinds and item counts as the English original", () => {
  const ref = PRIVACY_EN.sections.map((s) => `${s.id}: ${s.blocks.map(shape).join(", ")}`);
  for (const [lang, doc] of Object.entries(DOCS)) {
    assert.deepEqual(doc.sections.map((s) => `${s.id}: ${s.blocks.map(shape).join(", ")}`), ref, `privacy.${lang}.ts is out of step with privacy.en.ts`);
  }
});

test("every language carries the same revision date", () => {
  for (const [lang, doc] of Object.entries(DOCS)) assert.equal(doc.updated, PRIVACY_EN.updated, lang);
});

test("every language names the same cookies, providers and figures", () => {
  // Language-neutral tokens: names, codes and numbers are never translated.
  const tokens = ["cookieConsent", ATTRIBUTION_COOKIE, "_ga", "_gcl_au", "_fbp", "_fbc", "SHA-256", "Telegram", "Anthropic", "Hostinger", "OpenFreeMap", "OpenStreetMap", "Clarity", "LinkedIn", "Zoom", "office@cyprusvipestates.com", "14", "30", "90", "180"];
  for (const [lang, doc] of Object.entries(DOCS)) {
    const text = fullText(doc);
    const missing = tokens.filter((t) => !text.includes(t));
    assert.deepEqual(missing, [], `privacy.${lang}.ts does not mention: ${missing.join(", ")}`);
  }
});

test("the cookie lifetimes in the policy are the ones the code sets", () => {
  const banner = read("src/app/components/CustomCookieConsent/CustomCookieConsent.tsx");
  const expiries = Array.from(new Set((banner.match(/expires:\s*(\d+)/g) ?? []).map((m) => m.replace(/\D/g, ""))));
  assert.deepEqual(expiries, ["180"], `cookieConsent lifetime changed in code (${expiries.join(", ")}) — update every privacy.*.ts`);
  assert.equal(ATTRIBUTION_DAYS, 90, "cve_attr lifetime changed in code — update every privacy.*.ts");
});

test("each language quotes the footer link exactly as that language's page shows it", () => {
  for (const [lang, doc] of Object.entries(DOCS)) {
    const label = cookieSettingsLabel(lang);
    assert.ok(label, lang);
    assert.ok(fullText(doc).includes(label!), `privacy.${lang}.ts should refer to the footer link as “${label}”`);
  }
});
