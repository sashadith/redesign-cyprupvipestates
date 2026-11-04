import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePresentationDraft, PRESENTATION_DRAFT_ERROR_CODES, MAX_PRESENTATION_PROJECTS } from "@/lib/partner/presentationDraft";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

const ctx = { allowedClaimIds: new Set(["c1"]), allowedProjectIds: new Set(Array.from({ length: 20 }, (_, i) => `p${i}`)) };
const ok = { claimId: "c1", projectIds: ["p1", "p2"], greetingName: " Anna ", personalNote: "Hello,\nhere are the projects.", locale: "de" };

test("valid draft is normalised", () => {
  assert.deepEqual(validatePresentationDraft(ok, ctx), {
    ok: true,
    data: { claimId: "c1", projectIds: ["p1", "p2"], greetingName: "Anna", personalNote: "Hello,\nhere are the projects.", locale: "de" },
  });
});

test("personal note optional; CRLF normalised", () => {
  const r = validatePresentationDraft({ ...ok, personalNote: undefined }, ctx);
  assert.ok(r.ok && r.data.personalNote === "");
  const r2 = validatePresentationDraft({ ...ok, personalNote: "a\r\nb" }, ctx);
  assert.ok(r2.ok && r2.data.personalNote === "a\nb");
});

test("rejections", () => {
  const bad = (over: Record<string, unknown>) => validatePresentationDraft({ ...ok, ...over }, ctx);
  assert.deepEqual(validatePresentationDraft(null, ctx), { ok: false, field: "_", code: "err.invalid" });
  assert.deepEqual(bad({ extra: 1 }), { ok: false, field: "extra", code: "err.unknownField" });
  assert.deepEqual(bad({ claimId: "c-foreign" }), { ok: false, field: "claimId", code: "err.presentationClient" });
  assert.deepEqual(bad({ projectIds: ["p1", "p-foreign"] }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.deepEqual(bad({ projectIds: [] }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.deepEqual(bad({ projectIds: ["p1", "p1"] }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.deepEqual(bad({ projectIds: "p1" }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.deepEqual(bad({ projectIds: [1] }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.equal(MAX_PRESENTATION_PROJECTS, 12);
  assert.ok(bad({ projectIds: Array.from({ length: 12 }, (_, i) => `p${i}`) }).ok);
  assert.deepEqual(bad({ projectIds: Array.from({ length: 13 }, (_, i) => `p${i}`) }), { ok: false, field: "projectIds", code: "err.presentationProjects" });
  assert.deepEqual(bad({ greetingName: "" }), { ok: false, field: "greetingName", code: "err.greetingName" });
  assert.deepEqual(bad({ greetingName: "a".repeat(61) }), { ok: false, field: "greetingName", code: "err.greetingName" });
  assert.deepEqual(bad({ greetingName: "a\nb" }), { ok: false, field: "greetingName", code: "err.greetingName" });
  assert.deepEqual(bad({ personalNote: "a".repeat(601) }), { ok: false, field: "personalNote", code: "err.personalNote" });
  assert.deepEqual(bad({ personalNote: "a\u0000b" }), { ok: false, field: "personalNote", code: "err.personalNote" });
  assert.deepEqual(bad({ locale: "he" }), { ok: false, field: "locale", code: "err.language" });
  assert.deepEqual(bad({ locale: "fr" }), { ok: false, field: "locale", code: "err.language" });
});

test("error codes resolve in every locale", () => {
  for (const l of PARTNER_LOCALES) for (const k of PRESENTATION_DRAFT_ERROR_CODES) assert.ok(lookup(l, k), `${l} ${k}`);
});
