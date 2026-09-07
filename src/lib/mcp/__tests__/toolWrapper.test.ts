import { test } from "node:test";
import assert from "node:assert/strict";
import { toolResultFromOutcome } from "@/lib/mcp/toolResult";

test("success outcome becomes one JSON text block", () => {
  const r = toolResultFromOutcome({ ok: true, data: { a: 1 } });
  assert.deepEqual(r, { content: [{ type: "text", text: JSON.stringify({ a: 1 }, null, 1) }] });
});

test("error outcome is flagged isError with code and message", () => {
  const r = toolResultFromOutcome({ ok: false, code: "not_found", message: "Lead not found." });
  assert.equal(r.isError, true);
  assert.deepEqual(r.content, [{ type: "text", text: JSON.stringify({ error: "not_found", message: "Lead not found." }) }]);
});
