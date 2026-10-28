import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPresentationInput, editSummary } from "../crm/presentations/core";

test("cleanPresentationInput normalises like the old routes", () => {
  const r = cleanPresentationInput({ items: [{ developmentId: "d1", advisorComment: " x ".padEnd(400, "y") }], greetingName: "  ", locale: "xx", personalNote: "" }, { defaultAdvisorId: "u1" });
  assert.ok(r.ok);
  assert.equal(r.input.greetingName, "there"); assert.equal(r.input.locale, "en");
  assert.equal(r.input.personalNote, null); assert.equal(r.input.advisorId, "u1");
  assert.equal(r.input.items[0].advisorComment!.length, 300);
  assert.deepEqual(cleanPresentationInput({ items: [] }, { defaultAdvisorId: null }), { ok: false, error: "At least one item is required" });
});

test("editSummary counts like the PUT route", () => {
  const s = editSummary([{ developmentId: "a", aliasName: null, advisorComment: "c" }, { developmentId: "b", aliasName: null, advisorComment: null }],
    [{ developmentId: "a", advisorComment: "new", aliasName: "A" }, { developmentId: "c" }]);
  assert.deepEqual(s, { toRemoveDevIds: ["b"], added: 1, removed: 1, summary: "1 added, 1 removed, 1 alias changed, 1 comment changed" });
  assert.equal(editSummary([{ developmentId: "a", aliasName: null, advisorComment: null }], [{ developmentId: "a" }]).summary, "details updated");
});
