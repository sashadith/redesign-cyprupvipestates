import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The matcher is a JS-compatible regex string; a path the matcher does NOT
// match is skipped by the locale middleware.
function matcher(): RegExp {
  const src = readFileSync("src/middleware.ts", "utf8");
  const m = src.match(/matcher:\s*\[\s*"([^"]+)"/);
  assert.ok(m, "matcher string not found");
  return new RegExp("^" + m![1].replace(/\\\\/g, "\\") + "$");
}

test("/crm and its sub-pages bypass the locale middleware", () => {
  const re = matcher();
  assert.equal(re.test("/crm"), false);
  assert.equal(re.test("/crm/pipeline"), false);
  assert.equal(re.test("/crm/inbox"), false);
});

test("look-alike public paths are still localised", () => {
  const re = matcher();
  assert.equal(re.test("/crmfoo"), true);
  assert.equal(re.test("/en/projects"), true);
});
