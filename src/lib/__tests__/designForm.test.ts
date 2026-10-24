// Owner design page: pure parsing of a colour-set save (Task 6 of the design settings feature).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThemeInput, needsContrastConfirm, copyName } from "../../app/crm/settings/design/designForm";
import { CLASSIC, ROLE_KEYS } from "../design/theme";

const SETS = [
  { id: "a", name: "Classic" },
  { id: "b", name: "Navy" },
];
const base = { name: "Sand", values: { ...CLASSIC }, offeredToStaff: true, offeredToPartners: false, confirmLowContrast: false };

test("a valid input parses, the name is trimmed and the values upper-cased", () => {
  const r = parseThemeInput({ ...base, name: "  Sand  ", values: { ...CLASSIC, page: "#f5f1e8" } }, SETS);
  assert.ok(r.ok);
  assert.equal(r.value.name, "Sand");
  assert.equal(r.value.values.page, "#F5F1E8");
  assert.equal(r.value.offeredToStaff, true);
  assert.equal(r.value.offeredToPartners, false);
  assert.equal(r.value.id, undefined);
});

test("the name: empty and 41 characters are refused, 40 passes", () => {
  for (const name of ["", "   "]) {
    const r = parseThemeInput({ ...base, name }, SETS);
    assert.ok(!r.ok && /name/i.test(r.error), JSON.stringify(name));
  }
  const long = parseThemeInput({ ...base, name: "x".repeat(41) }, SETS);
  assert.ok(!long.ok && /40/.test(long.error));
  assert.ok(parseThemeInput({ ...base, name: "x".repeat(40) }, SETS).ok);
});

test("a duplicate name is refused case-insensitively, except for the set itself", () => {
  const r = parseThemeInput({ ...base, name: " navy " }, SETS);
  assert.ok(!r.ok);
  assert.equal(r.error, "A set with this name already exists");
  assert.ok(parseThemeInput({ ...base, id: "b", name: "NAVY" }, SETS).ok, "renaming a set to its own name in another case");
});

test("an invalid hex gives a per-field error; a missing role too", () => {
  const bad = parseThemeInput({ ...base, values: { ...CLASSIC, accent: "#12345" } }, SETS);
  assert.ok(!bad.ok);
  assert.ok(bad.fieldErrors?.accent, "accent error");
  assert.equal(Object.keys(bad.fieldErrors ?? {}).length, 1);
  const { field: _f, ...missing } = CLASSIC;
  const miss = parseThemeInput({ ...base, values: missing }, SETS);
  assert.ok(!miss.ok && miss.fieldErrors?.field);
  const none = parseThemeInput({ ...base, values: undefined }, SETS);
  assert.ok(!none.ok && ROLE_KEYS.every((k) => none.fieldErrors?.[k]));
});

test("booleans, id and the input itself are checked", () => {
  assert.equal(parseThemeInput(null, SETS).ok, false);
  assert.equal(parseThemeInput({ ...base, offeredToStaff: "yes" }, SETS).ok, false);
  assert.equal(parseThemeInput({ ...base, confirmLowContrast: 1 }, SETS).ok, false);
  assert.equal(parseThemeInput({ ...base, id: "" }, SETS).ok, false);
  assert.equal(parseThemeInput({ ...base, id: "x".repeat(65) }, SETS).ok, false);
  const r = parseThemeInput({ ...base, id: "a", name: "Classic", confirmLowContrast: true }, SETS);
  assert.ok(r.ok && r.value.id === "a" && r.value.confirmLowContrast === true);
});

test("needsContrastConfirm: Classic passes, unreadable text asks unless confirmed", () => {
  assert.equal(needsContrastConfirm(CLASSIC, false), null);
  const blind = { ...CLASSIC, text: "#F5F1E8", page: "#F5F1E8" };
  const w = needsContrastConfirm(blind, false);
  assert.ok(w && w.length > 0 && w.some((x) => x.pair === "text/page"));
  assert.equal(needsContrastConfirm(blind, true), null);
});

test("copyName: '<name> copy', numbered when taken, never over 40 characters", () => {
  assert.equal(copyName("Navy", SETS), "Navy copy");
  assert.equal(copyName("Navy", [...SETS, { id: "c", name: "navy COPY" }]), "Navy copy 2");
  const long = copyName("y".repeat(40), SETS);
  assert.ok(long.length <= 40 && long.endsWith(" copy"));
});
