// Lives in the mcp test folder only because `npm test` globs this directory;
// the predicate belongs to the admin CRM's AutoRefresh.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasUnsavedEdit } from "@/lib/admin/unsavedEdit";

test("a focused field only blocks the refresh while it holds an unsaved edit", () => {
  assert.equal(hasUnsavedEdit({ tagName: "INPUT", value: "2026-09-12T09:00", defaultValue: "2026-09-11T09:00" }), true);
  assert.equal(hasUnsavedEdit({ tagName: "textarea", value: "half a note", defaultValue: "" }), true);
  assert.equal(hasUnsavedEdit({ tagName: "INPUT", value: "max", defaultValue: "max" }), false); // the search box after a search
  assert.equal(hasUnsavedEdit({ tagName: "INPUT", value: "", defaultValue: "" }), false);
});

test("selects never block; contentEditable always does; nothing focused never does", () => {
  assert.equal(hasUnsavedEdit({ tagName: "SELECT", value: "OFFER", defaultValue: "NEW" }), false);
  assert.equal(hasUnsavedEdit({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(hasUnsavedEdit({ tagName: "BUTTON" }), false);
  assert.equal(hasUnsavedEdit(null), false);
});
