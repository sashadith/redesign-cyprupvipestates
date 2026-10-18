import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRights, validateTeamPatch } from "@/lib/crm/teamRights";

const off = { canSeeColleagues: false, canEditColleagues: false };

test("turning edit on also turns see on", () => {
  assert.deepEqual(normalizeRights(off, { canEditColleagues: true }), { canSeeColleagues: true, canEditColleagues: true });
});

test("turning see off also turns edit off", () => {
  assert.deepEqual(normalizeRights({ canSeeColleagues: true, canEditColleagues: true }, { canSeeColleagues: false }), off);
});

test("see on alone leaves edit off", () => {
  assert.deepEqual(normalizeRights(off, { canSeeColleagues: true }), { canSeeColleagues: true, canEditColleagues: false });
});

test("languages are limited to the four working languages and deduped", () => {
  const r = validateTeamPatch({ languages: ["de", "en", "de"] });
  assert.deepEqual(r, { ok: true, patch: { languages: ["de", "en"] } });
  assert.equal(validateTeamPatch({ languages: ["he"] }).ok, false);
  assert.equal(validateTeamPatch({ languages: ["fr"] }).ok, false);
});

test("specialties are trimmed, deduped case-insensitively and capped", () => {
  const r = validateTeamPatch({ specialties: [" Paphos ", "paphos", "", "Limassol"] });
  assert.deepEqual(r, { ok: true, patch: { specialties: ["Paphos", "Limassol"] } });
  assert.equal(validateTeamPatch({ specialties: Array.from({ length: 11 }, (_, i) => `Town ${i}`) }).ok, false);
  assert.equal(validateTeamPatch({ specialties: ["x".repeat(41)] }).ok, false);
});

test("booleans must be booleans and unknown keys are rejected", () => {
  assert.equal(validateTeamPatch({ acceptsLeads: "yes" }).ok, false);
  assert.equal(validateTeamPatch({ role: "ADMIN" }).ok, false);
  assert.equal(validateTeamPatch(null).ok, false);
  assert.deepEqual(validateTeamPatch({ acceptsLeads: false }), { ok: true, patch: { acceptsLeads: false } });
});
