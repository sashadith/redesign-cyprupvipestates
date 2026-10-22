import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CLASSIC, WEBSITE, STARTER_SETS, ROLE_KEYS } from "../design/theme";
import { resolveViewerSet, canChooseSet, validateSetMutation, offeredOn, type ThemeRow } from "../design/store";

function row(id: string, o: Partial<ThemeRow> = {}): ThemeRow {
  return { id, key: null, name: id, values: CLASSIC, offeredToStaff: true, offeredToPartners: true, isDefault: false, sort: 1, ...o };
}
const rows = [
  row("def", { isDefault: true, key: "classic" }),
  row("a"),
  row("staffOnly", { offeredToPartners: false }),
  row("partnerOnly", { offeredToStaff: false }),
];

test("offeredOn", () => {
  assert.equal(offeredOn(rows[2], "staff"), true);
  assert.equal(offeredOn(rows[2], "partner"), false);
});

test("resolveViewerSet returns the offered choice", () => {
  assert.equal(resolveViewerSet("a", rows, "staff").id, "a");
});
test("resolveViewerSet falls back to default for null, deleted, unoffered", () => {
  assert.equal(resolveViewerSet(null, rows, "staff").id, "def");
  assert.equal(resolveViewerSet("gone", rows, "staff").id, "def");
  assert.equal(resolveViewerSet("partnerOnly", rows, "staff").id, "def");
  assert.equal(resolveViewerSet("staffOnly", rows, "partner").id, "def");
});
test("resolveViewerSet synthetic Classic when no rows", () => {
  const r = resolveViewerSet("x", [], "staff");
  assert.equal(r.id, "ds-classic");
  assert.deepEqual(r.values, CLASSIC);
});
test("canChooseSet respects side", () => {
  assert.equal(canChooseSet("partnerOnly", rows, "staff"), false);
  assert.equal(canChooseSet("staffOnly", rows, "partner"), false);
  assert.equal(canChooseSet("staffOnly", rows, "staff"), true);
  assert.equal(canChooseSet("nope", rows, "staff"), false);
});
test("validateSetMutation refusals", () => {
  assert.equal(validateSetMutation({ kind: "delete", id: "def" }, rows), "Built-in sets cannot be deleted");
  const custom = [row("d", { isDefault: true }), row("b")];
  assert.equal(validateSetMutation({ kind: "delete", id: "d" }, custom), "Make another set the default first");
  assert.equal(validateSetMutation({ kind: "delete", id: "b" }, custom), null);
  assert.equal(validateSetMutation({ kind: "update", id: "d", offeredToStaff: false, offeredToPartners: true }, custom), "The default set must be offered to staff and partners");
  assert.equal(validateSetMutation({ kind: "update", id: "d", offeredToStaff: true, offeredToPartners: false }, custom), "The default set must be offered to staff and partners");
  assert.equal(validateSetMutation({ kind: "update", id: "b", offeredToStaff: false, offeredToPartners: false }, custom), null);
  assert.equal(validateSetMutation({ kind: "delete", id: "zz" }, custom), "Unknown set");
  assert.equal(validateSetMutation({ kind: "update", id: "zz", offeredToStaff: true, offeredToPartners: true }, custom), "Unknown set");
  assert.equal(validateSetMutation({ kind: "makeDefault", id: "zz" }, custom), "Unknown set");
});
test("makeDefault requires both sides", () => {
  assert.notEqual(validateSetMutation({ kind: "makeDefault", id: "staffOnly" }, rows), null);
  assert.equal(validateSetMutation({ kind: "makeDefault", id: "a" }, rows), null);
});

test("migration seed matches theme constants", () => {
  const sql = readFileSync(path.join(__dirname, "../../../prisma/migrations/20261022120000_design_settings/migration.sql"), "utf8");
  const found = (sql.match(/'\{[^']*\}'::jsonb/g) ?? []).map((m) => JSON.parse(m.slice(1, m.indexOf("'::jsonb"))));
  assert.equal(found.length, 5);
  const expected = [CLASSIC, WEBSITE, ...STARTER_SETS.map((s) => s.values)];
  expected.forEach((e, i) => {
    assert.deepEqual(found[i], e);
    assert.deepEqual(Object.keys(found[i]), [...ROLE_KEYS]);
  });
});
