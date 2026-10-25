// Owner design page: the server-action cores (controller ruling R8 — pure, injected store;
// the "use server" file is a thin wrapper). Owner guard, validation order, refusal texts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeDesignActions, OWNER_ONLY, type DesignStore } from "../../app/crm/settings/design/actionsCore";
import { CLASSIC, DEFAULT_GLOBAL } from "../design/theme";
import type { ThemeRow } from "../design/store";

const OWNER = { id: "u1", name: "Owner", email: "o@x", isOwner: true };
const STAFF = { id: "u2", name: "Staff", email: "s@x", isOwner: false };
const ROWS: ThemeRow[] = [
  { id: "t-classic", key: "classic", name: "Classic", values: { ...CLASSIC }, offeredToStaff: true, offeredToPartners: true, isDefault: true, sort: 1 },
  { id: "t-navy", key: null, name: "Navy", values: { ...CLASSIC }, offeredToStaff: true, offeredToPartners: false, isDefault: false, sort: 3 },
];

function fakeStore() {
  const calls: string[] = [];
  const store: DesignStore = {
    listThemes: async () => { calls.push("listThemes"); return ROWS; },
    saveTheme: async (_a, input) => { calls.push(`saveTheme:${input.name}`); return input.id ?? "t-new"; },
    deleteTheme: async (_a, id) => {
      calls.push(`deleteTheme:${id}`);
      if (ROWS.find((r) => r.id === id)?.isDefault) throw new Error("Make another set the default first");
    },
    makeDefaultTheme: async (_a, id) => { calls.push(`makeDefault:${id}`); },
    restoreThemeVersion: async (_a, id) => { calls.push(`restoreVersion:${id}`); },
    restoreBuiltIn: async (_a, id) => { calls.push(`restoreBuiltIn:${id}`); },
    saveGlobal: async (_a, v, note) => { calls.push(`saveGlobal:${v.crmBase}:${note}`); },
  };
  return { store, calls };
}

function setup(user: typeof OWNER | null) {
  const { store, calls } = fakeStore();
  let revalidated = 0;
  const actions = makeDesignActions({ getUser: async () => user, store, revalidate: () => { revalidated++; } });
  return { actions, calls, revalidated: () => revalidated };
}

const save = { name: "Sand", values: { ...CLASSIC }, offeredToStaff: true, offeredToPartners: true, confirmLowContrast: false };

test("a non-owner (or nobody) gets 'Owner only' from every action and the store is never called", async () => {
  for (const user of [STAFF, null]) {
    const { actions, calls, revalidated } = setup(user);
    const results = await Promise.all([
      actions.saveTheme(save), actions.deleteTheme("t-navy"), actions.makeDefaultTheme("t-navy"),
      actions.restoreThemeVersion("v1"), actions.restoreBuiltIn("t-classic"), actions.duplicateTheme("t-navy"),
      actions.saveGlobal({ ...DEFAULT_GLOBAL }), actions.resetGlobal(),
    ]);
    for (const r of results) assert.deepEqual(r, { ok: false, error: OWNER_ONLY });
    assert.deepEqual(calls, []);
    assert.equal(revalidated(), 0);
  }
  assert.equal(OWNER_ONLY, "Owner only");
});

test("deleting the default returns the store's refusal text and does not revalidate", async () => {
  const { actions, revalidated } = setup(OWNER);
  assert.deepEqual(await actions.deleteTheme("t-classic"), { ok: false, error: "Make another set the default first" });
  assert.equal(revalidated(), 0);
  assert.deepEqual(await actions.deleteTheme("t-navy"), { ok: true });
  assert.equal(revalidated(), 1);
});

test("saveTheme validates before the store: bad name / hex / low contrast never reach saveTheme", async () => {
  const { actions, calls } = setup(OWNER);
  const dup = await actions.saveTheme({ ...save, name: "navy" });
  assert.deepEqual(dup, { ok: false, error: "A set with this name already exists" });
  const hex = await actions.saveTheme({ ...save, values: { ...CLASSIC, page: "nope" } });
  assert.ok(!hex.ok && hex.fieldErrors?.page);
  const low = await actions.saveTheme({ ...save, values: { ...CLASSIC, text: "#F5F1E8" } });
  assert.ok(!low.ok && low.warnings && low.warnings.length > 0);
  assert.ok(!calls.some((c) => c.startsWith("saveTheme")));
  const anyway = await actions.saveTheme({ ...save, values: { ...CLASSIC, text: "#F5F1E8" }, confirmLowContrast: true });
  assert.deepEqual(anyway, { ok: true, id: "t-new" });
  assert.ok(calls.includes("saveTheme:Sand"));
});

test("store refusals on save come back as the error text; unknown errors are generic", async () => {
  const { store } = fakeStore();
  store.saveTheme = async () => { throw new Error("The default set must be offered to staff and partners"); };
  const a = makeDesignActions({ getUser: async () => OWNER, store, revalidate: () => {} });
  assert.deepEqual(await a.saveTheme({ ...save, id: "t-classic", name: "Classic", offeredToPartners: false }),
    { ok: false, error: "The default set must be offered to staff and partners" });
  const boom = Object.assign(new Error("Invalid `prisma.designTheme.update()` invocation: secret"), { name: "PrismaClientKnownRequestError" });
  store.saveTheme = async () => { throw boom; };
  const r = await a.saveTheme(save);
  assert.ok(!r.ok && !/prisma/i.test(r.error));
});

test("duplicate: '<name> copy', not offered, values copied; unknown id refused", async () => {
  const { store } = fakeStore();
  let saved: Parameters<DesignStore["saveTheme"]>[1] | undefined;
  store.saveTheme = async (_a, input) => { saved = input; return "t-copy"; };
  const a = makeDesignActions({ getUser: async () => OWNER, store, revalidate: () => {} });
  assert.deepEqual(await a.duplicateTheme("t-navy"), { ok: true, id: "t-copy" });
  assert.equal(saved?.name, "Navy copy");
  assert.equal(saved?.id, undefined);
  assert.equal(saved?.offeredToStaff, false);
  assert.equal(saved?.offeredToPartners, false);
  assert.deepEqual(saved?.values, ROWS[1].values);
  assert.deepEqual(await a.duplicateTheme("nope"), { ok: false, error: "Unknown set" });
});

test("global: out-of-range is refused before the store, reset saves the defaults with a note", async () => {
  const { actions, calls } = setup(OWNER);
  const bad = await actions.saveGlobal({ ...DEFAULT_GLOBAL, crmBase: 40 });
  assert.ok(!bad.ok && bad.fieldErrors?.crmBase);
  assert.deepEqual(calls, []);
  assert.deepEqual(await actions.saveGlobal({ ...DEFAULT_GLOBAL, crmBase: 15 }), { ok: true });
  assert.deepEqual(await actions.resetGlobal(), { ok: true });
  assert.deepEqual(calls, ["saveGlobal:15:null", "saveGlobal:14:reset"]);
});

test("id arguments are checked before the store", async () => {
  const { actions, calls } = setup(OWNER);
  for (const bad of ["", "x".repeat(65), 3 as unknown as string]) {
    assert.equal((await actions.deleteTheme(bad)).ok, false);
    assert.equal((await actions.restoreThemeVersion(bad)).ok, false);
  }
  assert.deepEqual(calls, []);
});

test("the 'use server' file is a thin wrapper: every export goes through the core and revalidates the CRM layout", () => {
  const src = readFileSync("src/app/crm/settings/design/actions.ts", "utf8");
  assert.match(src, /^"use server";/);
  assert.match(src, /revalidatePath\("\/crm", "layout"\)/);
  assert.match(src, /getUser: getCrmUser/);
  for (const name of ["saveThemeAction", "deleteThemeAction", "makeDefaultThemeAction", "restoreThemeVersionAction", "restoreBuiltInAction", "duplicateThemeAction", "saveGlobalAction", "resetGlobalAction"]) {
    assert.match(src, new RegExp(`export async function ${name}\\(`), name);
  }
});
