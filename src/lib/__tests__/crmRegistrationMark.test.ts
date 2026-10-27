import { test } from "node:test";
import assert from "node:assert/strict";
import { markRegistration, type MarkDeps, type MarkRow } from "@/lib/crm/registration/mark";

const NOW = new Date("2026-10-30T10:00:00Z");
const A = { userId: "u1", userName: "Sascha" };

function fake(row: Partial<MarkRow> = {}, applyOk = true) {
  const applied: any[] = [];
  const logged: any[] = [];
  const deps: MarkDeps = {
    load: async () => ({ id: "R", leadId: "L", status: "SENT", preliminaryAt: null, developerName: "Marinakis", ...row }),
    apply: async (id, from, to, fields) => { applied.push({ id, from, to, fields }); return applyOk; },
    logStatus: async (i) => { logged.push(i); },
    now: () => NOW,
  };
  return { deps, applied, logged };
}

test("auto preliminary from SENT sets the preliminary fields and logs the evidence", async () => {
  const { deps, applied, logged } = fake();
  const r = await markRegistration(deps, { registrationId: "R", action: "PRELIMINARY", source: "auto", actor: null, evidence: "Confirmed, thank you" });
  assert.deepEqual(r, { ok: true, status: "PRELIMINARY" });
  assert.deepEqual(applied[0], { id: "R", from: "SENT", to: "PRELIMINARY", fields: { preliminaryAt: NOW, preliminarySource: "auto", preliminaryById: null } });
  assert.equal(logged[0].body, 'Registration with Marinakis: Preliminary (auto) — "Confirmed, thank you"');
});

test("auto preliminary only from SENT", async () => {
  const { deps, applied } = fake({ status: "PRELIMINARY", preliminaryAt: NOW });
  const r = await markRegistration(deps, { registrationId: "R", action: "PRELIMINARY", source: "auto", actor: null });
  assert.equal(r.ok, false);
  assert.equal(applied.length, 0);
});

test("undo of FIXED returns to PRELIMINARY when preliminaryAt set, else SENT", async () => {
  const a = fake({ status: "FIXED", preliminaryAt: NOW });
  assert.deepEqual(await markRegistration(a.deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A, isOwner: true }), { ok: true, status: "PRELIMINARY" });
  assert.deepEqual(a.applied[0].fields, { fixedAt: null, fixedById: null });
  assert.equal(a.logged[0].body, "Registration with Marinakis: Undo → Preliminary (manual)");
  const b = fake({ status: "FIXED", preliminaryAt: null });
  assert.deepEqual(await markRegistration(b.deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A, isOwner: true }), { ok: true, status: "SENT" });
});

test("undo of PRELIMINARY clears the preliminary fields", async () => {
  const { deps, applied } = fake({ status: "PRELIMINARY", preliminaryAt: NOW });
  await markRegistration(deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A });
  assert.deepEqual(applied[0], { id: "R", from: "PRELIMINARY", to: "SENT", fields: { preliminaryAt: null, preliminarySource: null, preliminaryById: null } });
});

test("REJECTED cannot become PRELIMINARY; SENT has nothing to undo", async () => {
  assert.equal((await markRegistration(fake({ status: "REJECTED" }).deps, { registrationId: "R", action: "PRELIMINARY", source: "manual", actor: A })).ok, false);
  assert.equal((await markRegistration(fake().deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A })).ok, false);
});

test("manual fixed from SENT records who", async () => {
  const { deps, applied } = fake();
  await markRegistration(deps, { registrationId: "R", action: "FIXED", source: "manual", actor: A, isOwner: true });
  assert.deepEqual(applied[0].fields, { fixedAt: NOW, fixedById: "u1" });
});

test("concurrent change → reload error, nothing logged", async () => {
  const { deps, logged } = fake({}, false);
  const r = await markRegistration(deps, { registrationId: "R", action: "REJECTED", source: "manual", actor: A });
  assert.deepEqual(r, { ok: false, error: "This registration changed meanwhile — reload." });
  assert.equal(logged.length, 0);
});

test("Fixed and undo of Fixed need the owner, checked on the row as loaded", async () => {
  const a = fake();
  assert.deepEqual(await markRegistration(a.deps, { registrationId: "R", action: "FIXED", source: "manual", actor: A }), { ok: false, error: "Only the owner can set or undo a fixed registration." });
  const b = fake({ status: "FIXED", preliminaryAt: NOW });
  assert.equal((await markRegistration(b.deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A, isOwner: false })).ok, false);
  assert.equal(a.applied.length + b.applied.length, 0);
  const c = fake({ status: "PRELIMINARY", preliminaryAt: NOW });
  assert.equal((await markRegistration(c.deps, { registrationId: "R", action: "UNDO", source: "manual", actor: A })).ok, true);
});
