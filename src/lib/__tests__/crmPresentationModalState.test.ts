import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildItems, confirmDiscard, droppedSelections, editPayloadItems, editorItemFromMatch, editSnapshot, emptyEditItems,
  hiddenSelections, isDirty, isEditDirty, removeItemConfirm, type ModalSnapshot,
} from "../../app/crm/components/presentationModalState";
import type { EditorItem, EditorUnit } from "../crm/presentations/editorItems";
import type { DevelopmentMatch, MatchedUnit } from "../crm/matching";
import { normalizeRef } from "../unitRef";

const unit = (id: string, ref: string | null, status = "available"): MatchedUnit => ({
  id, ref, label: null, type: null, beds: null, areaBuilt: null, price: 100, status,
});
const match = (id: string, publicName: string, matched: MatchedUnit[], all: MatchedUnit[]): DevelopmentMatch => ({
  development: { id, publicName } as DevelopmentMatch["development"],
  score: 100, matchedUnits: matched, allAvailableUnits: all,
  scoreBreakdown: { budget: 100, bedrooms: 100, location: 100, propertyType: 100 },
});

const base: ModalSnapshot = {
  picked: [], unpicked: [], unitOverrides: {}, comments: {},
  greetingName: "Anna", personalNote: "", locale: "en", advisorId: "u1",
};

test("isDirty: untouched state is clean, any pick or text is dirty", () => {
  assert.equal(isDirty({ ...base }, base), false);
  assert.equal(isDirty({ ...base, comments: { d1: "  " } }, base), false, "a blank comment is not a pick");
  assert.equal(isDirty({ ...base, picked: ["d1"] }, base), true);
  assert.equal(isDirty({ ...base, unpicked: ["d1"] }, base), true);
  assert.equal(isDirty({ ...base, unitOverrides: { d1: ["u1"] } }, base), true);
  assert.equal(isDirty({ ...base, comments: { d1: "nice view" } }, base), true);
  assert.equal(isDirty({ ...base, personalNote: "Hi" }, base), true);
  assert.equal(isDirty({ ...base, greetingName: "Ann" }, base), true);
  assert.equal(isDirty({ ...base, locale: "de" }, base), true);
  assert.equal(isDirty({ ...base, advisorId: "u2" }, base), true);
  assert.equal(isDirty({ ...base, picked: ["b", "a"] }, { ...base, picked: ["a", "b"] }), false, "order does not matter");
});

test("confirmDiscard: clean closes without asking; dirty asks and obeys", () => {
  let asked = 0;
  assert.equal(confirmDiscard(false, () => { asked++; return false; }), true);
  assert.equal(asked, 0);
  let msg = "";
  assert.equal(confirmDiscard(true, (m) => { msg = m; return false; }), false);
  assert.equal(msg, "Discard this selection? Your picks will be lost.");
  assert.equal(confirmDiscard(true, () => true), true);
});

test("buildItems: untouched project snapshots its matched units as normalized refs", () => {
  const results = [match("d1", "Arbeo Villas", [unit("a", "Arbeo Villas Villa 1"), unit("b", "Villa 2")], [unit("a", "Arbeo Villas Villa 1"), unit("b", "Villa 2"), unit("c", "Villa 3")])];
  const items = buildItems(["d1"], new Map(), new Map([["d1", "Sea view"]]), results);
  assert.deepEqual(items, [{
    developmentId: "d1",
    unitRefs: [normalizeRef("Arbeo Villas Villa 1", "Arbeo Villas"), normalizeRef("Villa 2", "Arbeo Villas")],
    unitIds: null, sortIndex: 0, advisorComment: "Sea view",
  }]);
});

test("buildItems: override wins; a show-all unit and a manual unit without ref", () => {
  const results = [match("d1", "P", [unit("a", "A1")], [unit("a", "A1"), unit("c", "C3"), unit("m", null), unit("w", "  ")])];
  const items = buildItems(["d1"], new Map([["d1", new Set(["c", "m", "w"])]]), new Map(), results);
  assert.deepEqual(items[0].unitRefs, [normalizeRef("C3", "P")]);
  assert.deepEqual(items[0].unitIds, ["m", "w"]);
  assert.equal(items[0].advisorComment, "");
});

test("buildItems: no unit data → null/null; empty selections are dropped and reported", () => {
  const results = [
    match("d1", "No Units", [], []),
    match("d2", "Zero Exact", [], [unit("x", "X1")]),
    match("d3", "Emptied", [unit("y", "Y1")], [unit("y", "Y1")]),
    match("d4", "Kept", [unit("z", "Z1")], [unit("z", "Z1")]),
  ];
  const overrides = new Map([["d3", new Set<string>()]]);
  const sel = ["d1", "d2", "d3", "d4"];
  assert.deepEqual(droppedSelections(sel, overrides, results), ["Zero Exact", "Emptied"]);
  const items = buildItems(sel, overrides, new Map(), results);
  assert.deepEqual(items.map((i) => [i.developmentId, i.sortIndex, i.unitRefs, i.unitIds]), [
    ["d1", 0, null, null],
    ["d4", 1, [normalizeRef("Z1", "Kept")], null],
  ]);
});

test("hiddenSelections: selected but not in the current results, with remembered names", () => {
  const results = [match("d1", "Shown", [], [])];
  const names = new Map([["d2", "Peyia Hills"]]);
  assert.deepEqual(hiddenSelections(["d1", "d2", "d3"], results, names), [
    { id: "d2", name: "Peyia Hills" },
    { id: "d3", name: "Unknown project" },
  ]);
  assert.deepEqual(hiddenSelections(["d1"], results, names), []);
});

const eunit = (id: string, ref: string | null, status = "available"): EditorUnit => ({
  id, ref, label: null, type: null, beds: null, areaBuilt: null, price: 100, currency: "EUR", status,
});
const eitem = (developmentId: string, units: EditorUnit[], checkedUnitIds: string[], over: Partial<EditorItem> = {}): EditorItem => ({
  developmentId, publicName: `P ${developmentId}`, mainImage: null, district: null, area: null, town: null, priceFrom: null,
  currency: "EUR", aliasName: "", advisorComment: "", sortIndex: 0, isNew: false, units, checkedUnitIds, ...over,
});

test("editorItemFromMatch: all available units listed, the exact matches (or the override) checked", () => {
  const m = match("d1", "Arbeo", [unit("a", "A1")], [unit("a", "A1"), unit("c", "C3")]);
  const it = editorItemFromMatch(m, undefined, "Sea view");
  assert.equal(it.isNew, true);
  assert.equal(it.advisorComment, "Sea view");
  assert.deepEqual(it.units.map((u) => u.id), ["a", "c"]);
  assert.deepEqual(it.checkedUnitIds, ["a"]);
  assert.deepEqual(editorItemFromMatch(m, new Set(["c"]), "").checkedUnitIds, ["c"]);
});

test("editPayloadItems: explicit refs for checked units, manual units by id, no units → whole project, sortIndex by position", () => {
  const items = [
    eitem("d1", [eunit("a", "A1"), eunit("b", "B2"), eunit("m", null)], ["a", "m"], { aliasName: "  Nice ", advisorComment: "" }),
    eitem("d2", [], []),
    eitem("d3", [eunit("s", "S1", "sold")], []),
  ];
  assert.deepEqual(editPayloadItems(items), [
    { developmentId: "d1", aliasName: "  Nice ", advisorComment: null, unitRefs: [normalizeRef("A1", "P d1")], unitIds: ["m"], sortIndex: 0 },
    { developmentId: "d2", aliasName: null, advisorComment: null, unitRefs: null, unitIds: null, sortIndex: 1 },
    { developmentId: "d3", aliasName: null, advisorComment: null, unitRefs: null, unitIds: null, sortIndex: 2 },
  ]);
});

test("emptyEditItems: available units but none checked", () => {
  const items = [eitem("d1", [eunit("a", "A1")], []), eitem("d2", [eunit("s", "S", "sold")], []), eitem("d3", [eunit("a", "A1")], ["a"])];
  assert.deepEqual(emptyEditItems(items).map((i) => i.developmentId), ["d1"]);
});

test("isEditDirty: compares against the loaded selection", () => {
  const items = [eitem("d1", [eunit("a", "A1"), eunit("b", "B1")], ["a", "b"]), eitem("d2", [], [])];
  const general = { greetingName: "Anna", personalNote: "", locale: "en", advisorId: "u1", expiresAt: "2026-11-30" };
  const initial = editSnapshot(items, general, [], new Map(), new Map());
  const same = (its: EditorItem[], g = general, picks: string[] = []) => isEditDirty(editSnapshot(its, g, picks, new Map(), new Map()), initial);
  assert.equal(same(items), false);
  assert.equal(same([{ ...items[0], checkedUnitIds: ["b", "a"] }, items[1]]), false, "unit order does not matter");
  assert.equal(same([items[0], { ...items[1], aliasName: "  " }]), false, "a blank alias is no alias");
  assert.equal(same([items[1], items[0]]), true, "reordered");
  assert.equal(same([items[0]]), true, "removed");
  assert.equal(same([{ ...items[0], checkedUnitIds: ["a"] }, items[1]]), true, "units narrowed");
  assert.equal(same([{ ...items[0], aliasName: "Villa A" }, items[1]]), true);
  assert.equal(same([items[0], { ...items[1], advisorComment: "Pool" }]), true);
  assert.equal(same(items, { ...general, expiresAt: "2026-12-31" }), true);
  assert.equal(same(items, { ...general, locale: "de" }), true);
  assert.equal(same(items, general, ["d9"]), true, "a project ticked to add");
});

test("removeItemConfirm: asks only for favorited projects, with the client-facing name", () => {
  const fav = new Set(["d1"]);
  let msg = "";
  const ask = (m: string) => { msg = m; return false; };
  assert.equal(removeItemConfirm(eitem("d1", [], [], { aliasName: "Villa Rosa" }), fav, ask), false);
  assert.equal(msg, "The client favorited Villa Rosa. Remove it anyway?");
  assert.equal(removeItemConfirm(eitem("d1", [], []), fav, () => true), true);
  msg = "";
  assert.equal(removeItemConfirm(eitem("d2", [], []), fav, ask), true);
  assert.equal(msg, "", "not favorited: no question");
});
