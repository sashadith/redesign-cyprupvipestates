import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProjectInterest, type ProjectInterestPrisma } from "@/lib/leads/projectInterest";
import { telegramLanguageTag, buildInboundLeadTelegramMessage, normalizeLeadLocale } from "@/lib/leadNotify";
import { resolveSignatureHtml } from "@/lib/emailSignature/resolve";
import { LOCALES, LOCALE_LABELS } from "@/lib/locale";

// In-memory prisma double — the local DATABASE_URL points at PRODUCTION, so
// no test in this repo may open a real client (see leadPipelineHe's sibling
// fakes, e.g. heTranslateQueue.test.ts).
type Row = Record<string, any>;

function fakePrisma(seed: { projects?: Row[]; developments?: Row[] }): ProjectInterestPrisma & {
  calls: { project: Array<Record<string, unknown>> };
} {
  const projects = seed.projects ?? [];
  const developments = seed.developments ?? [];
  const calls: { project: Array<Record<string, unknown>> } = { project: [] };

  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([k, v]) => row[k] === v);

  return {
    calls,
    project: {
      findFirst: async ({ where }) => {
        calls.project.push(where);
        const hit = projects.find((p) => matches(p, where));
        return hit ? { id: hit.id } : null;
      },
    },
    development: {
      findUnique: async ({ where }) => {
        const hit = developments.find((d) => d.slug === (where as any).slug);
        return hit ? { id: hit.id } : null;
      },
    },
  };
}

test("resolveProjectInterest: legacy Project row found — today's behaviour, unchanged", async () => {
  const prisma = fakePrisma({ projects: [{ id: "p-de-1", slug: "villa-x", language: "de" }] });
  const result = await resolveProjectInterest({ projectSlug: "villa-x", lang: "de", prisma });
  assert.deepEqual(result, { projectInterestId: "p-de-1", developmentId: null, source: "PROJECT_ENQUIRY" });
});

test("resolveProjectInterest: en/de/pl/ru miss with no Development either → nulls, source unchanged", async () => {
  const prisma = fakePrisma({});
  const result = await resolveProjectInterest({ projectSlug: "ghost", lang: "ru", prisma });
  assert.deepEqual(result, { projectInterestId: null, developmentId: null, source: null });
});

test("resolveProjectInterest: he — no legacy row (always the case), Development found, EN sibling → id + source", async () => {
  const prisma = fakePrisma({
    developments: [{ id: "dev-1", slug: "seafront-towers" }],
    projects: [{ id: "p-en-1", slug: "seafront-towers-legacy", language: "en", supersededByDevelopmentId: "dev-1" }],
  });
  const result = await resolveProjectInterest({ projectSlug: "seafront-towers", lang: "he", prisma });
  assert.deepEqual(result, { projectInterestId: "p-en-1", developmentId: "dev-1", source: "PROJECT_ENQUIRY" });

  // Exactly one Project lookup with language "he" (the legacy-miss try) —
  // the EN-sibling fallback must never repeat it.
  const heLookups = prisma.calls.project.filter((w) => w.language === "he");
  assert.equal(heLookups.length, 1);
  const enLookups = prisma.calls.project.filter((w) => w.language === "en");
  assert.equal(enLookups.length, 1);
});

test("resolveProjectInterest: he — Development found but no EN sibling → nulls (developmentId surfaced), source unchanged", async () => {
  const prisma = fakePrisma({ developments: [{ id: "dev-2", slug: "no-sibling" }] });
  const result = await resolveProjectInterest({ projectSlug: "no-sibling", lang: "he", prisma });
  assert.deepEqual(result, { projectInterestId: null, developmentId: "dev-2", source: null });
});

test("resolveProjectInterest: he — nothing found at all → nulls, source unchanged", async () => {
  const prisma = fakePrisma({});
  const result = await resolveProjectInterest({ projectSlug: "nothing-here", lang: "he", prisma });
  assert.deepEqual(result, { projectInterestId: null, developmentId: null, source: null });
});

test("resolveProjectInterest: blank slug or unknown lang short-circuits to nulls without querying", async () => {
  const prisma = fakePrisma({ projects: [{ id: "p-1", slug: "x", language: "en" }] });
  assert.deepEqual(await resolveProjectInterest({ projectSlug: "", lang: "en", prisma }), { projectInterestId: null, developmentId: null, source: null });
  assert.deepEqual(await resolveProjectInterest({ projectSlug: "x", lang: "xx", prisma }), { projectInterestId: null, developmentId: null, source: null });
  assert.equal(prisma.calls.project.length, 0);
});

test("telegramLanguageTag: upper-cased locale code from LOCALE_LABELS, no four-locale special-casing", () => {
  assert.equal(telegramLanguageTag("he"), "HE");
  assert.equal(telegramLanguageTag("de"), "DE");
  assert.equal(telegramLanguageTag("en"), "EN");
  assert.equal(telegramLanguageTag(null), null);
  assert.equal(telegramLanguageTag(undefined), null);
  assert.equal(telegramLanguageTag(""), null);
  // an unknown value still degrades gracefully instead of vanishing
  assert.equal(telegramLanguageTag("xx"), "XX");
});

test("buildInboundLeadTelegramMessage: renders HE for a Hebrew lead, DE unchanged for German", () => {
  const heMsg = buildInboundLeadTelegramMessage({ source: "CONTACT_FORM", email: "a@b.com", name: "Some One", language: "he", link: "https://x/admin/crm/1" });
  assert.match(heMsg, /Language: HE\n/);

  const deMsg = buildInboundLeadTelegramMessage({ source: "CONTACT_FORM", email: "a@b.com", name: "Some One", language: "de", link: "https://x/admin/crm/1" });
  assert.match(deMsg, /Language: DE\n/);

  // no language known → no Language line at all (not "Language: null")
  const noLangMsg = buildInboundLeadTelegramMessage({ source: "CONTACT_FORM", email: "a@b.com", name: "Some One", link: "https://x/admin/crm/1" });
  assert.doesNotMatch(noLangMsg, /Language:/);
});

test("normalizeLeadLocale: known locale (any case) → lowercase Locale; junk/blank → null", () => {
  assert.equal(normalizeLeadLocale("he"), "he");
  assert.equal(normalizeLeadLocale("HE"), "he");
  assert.equal(normalizeLeadLocale(" De "), "de");
  assert.equal(normalizeLeadLocale("xx"), null);
  assert.equal(normalizeLeadLocale(""), null);
  assert.equal(normalizeLeadLocale(null), null);
  assert.equal(normalizeLeadLocale(undefined), null);
});

// Fix-round item: the ROI-calculator and partner-form routes each persisted
// a normalized `languagePreference` on the Lead but never passed a matching
// `language` on to `recordInboundLead`, so a Hebrew submission's Telegram
// alert never showed "HE" even though `telegramLanguageTag` already
// supported it. Both routes now compute `normalizeLeadLocale(lang)` once and
// feed the same value to both places — this reproduces that exact pipeline
// (raw form `lang` → normalizeLeadLocale → recordInboundLead's `language` →
// buildInboundLeadTelegramMessage's "Language:" line) for each sender.
test("ROI-calculator sender pipeline: raw `lang` reaches the Telegram message as HE / DE", () => {
  const heMsg = buildInboundLeadTelegramMessage({
    source: "ROI_CALCULATOR",
    email: "a@b.com",
    name: "Some One",
    language: normalizeLeadLocale("he"),
    link: "https://x/admin/crm/1",
  });
  assert.match(heMsg, /Language: HE\n/);

  const deMsg = buildInboundLeadTelegramMessage({
    source: "ROI_CALCULATOR",
    email: "a@b.com",
    name: "Some One",
    language: normalizeLeadLocale("de"),
    link: "https://x/admin/crm/1",
  });
  assert.match(deMsg, /Language: DE\n/);
});

test("Partner-form sender pipeline: raw `lang` reaches the Telegram message as HE / DE", () => {
  const heMsg = buildInboundLeadTelegramMessage({
    source: "PARTNER",
    email: "a@b.com",
    name: "Some One",
    language: normalizeLeadLocale("he"),
    link: "https://x/admin/crm/1",
  });
  assert.match(heMsg, /Language: HE\n/);

  const deMsg = buildInboundLeadTelegramMessage({
    source: "PARTNER",
    email: "a@b.com",
    name: "Some One",
    language: normalizeLeadLocale("de"),
    link: "https://x/admin/crm/1",
  });
  assert.match(deMsg, /Language: DE\n/);
});

test("Cockpit locale label map: derived from LOCALE_LABELS, matches the old literal for en/de/pl/ru and adds he", () => {
  // Mirrors CockpitCard.tsx's `LOCALE_LABEL` derivation exactly.
  const LOCALE_LABEL: Record<string, string> = Object.fromEntries(
    LOCALES.map((l) => [l, LOCALE_LABELS[l].code]),
  );
  // The pre-existing hard-coded map this replaces (fix-round item,
  // CockpitCard.tsx:18) — every value must be byte-identical.
  assert.deepEqual(
    { en: LOCALE_LABEL.en, de: LOCALE_LABEL.de, pl: LOCALE_LABEL.pl, ru: LOCALE_LABEL.ru },
    { en: "EN", de: "DE", pl: "PL", ru: "RU" },
  );
  assert.equal(LOCALE_LABEL.he, "HE");
});

test("buildInboundLeadTelegramMessage: escapes HTML in the name/email/page fields", () => {
  const msg = buildInboundLeadTelegramMessage({ source: "CONTACT_FORM", email: "a@b.com", name: "<script>", language: "he", link: "https://x" });
  assert.doesNotMatch(msg, /<script>/);
  assert.match(msg, /&lt;script&gt;/);
});

test("resolveSignatureHtml: he saved — returns the he signature, wrapped as HTML", () => {
  const html = resolveSignatureHtml({ en: "Best regards,\nSascha", he: "בברכה,\nססחה" }, "he");
  assert.match(html, /בברכה/);
  assert.doesNotMatch(html, /Best regards/);
});

test("resolveSignatureHtml: he not saved — falls back to en, same as any other unset locale", () => {
  const html = resolveSignatureHtml({ en: "Best regards,\nSascha" }, "he");
  assert.match(html, /Best regards/);
  // de, equally unset, falls back identically — no four-locale special-casing
  assert.equal(html, resolveSignatureHtml({ en: "Best regards,\nSascha" }, "de"));
});

test("resolveSignatureHtml: nothing saved at all — empty string, not a stray wrapper", () => {
  assert.equal(resolveSignatureHtml({}, "he"), "");
  assert.equal(resolveSignatureHtml(null, "he"), "");
  assert.equal(resolveSignatureHtml(undefined, "he"), "");
});

test("resolveSignatureHtml: already-HTML signature passes through unwrapped; plain text gets wrapped", () => {
  assert.equal(resolveSignatureHtml({ he: "<p>בברכה</p>" }, "he"), "<p>בברכה</p>");
  assert.match(resolveSignatureHtml({ he: "בברכה" }, "he"), /^<p style="white-space:pre-wrap;">בברכה<\/p>$/);
});
