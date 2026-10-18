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

test("the CRM font files under /crm/fonts are served as static files", () => {
  // 2026-10-18: they first lived in /crm-fonts, which the locale middleware
  // rewrote to /en/crm-fonts → 404 (found in the first runtime preview).
  const re = matcher();
  assert.equal(re.test("/crm/fonts/hanken-grotesk-latin.woff2"), false);
  assert.equal(re.test("/crm-fonts/hanken-grotesk-latin.woff2"), true);
});

test("look-alike public paths are still localised", () => {
  const re = matcher();
  assert.equal(re.test("/crmfoo"), true);
  assert.equal(re.test("/en/projects"), true);
});
