import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkReviewMetadata, checkProtocols, checkNginx, summarize, PACKS } from "../he-launch-check.mjs";

// --- checkReviewMetadata -----------------------------------------------------

test("checkReviewMetadata: every file carries a non-empty string review field -> ok", () => {
  const files = [
    { path: "content/he/site-documents/homepage.he.json", json: { review: "pending" } },
    { path: "content/he/case-studies/x.he.json", json: { review: "approved" } },
  ];
  const result = checkReviewMetadata(files);
  assert.deepEqual(result, { ok: true, missing: [] });
});

test("checkReviewMetadata: a file with no review key is reported missing", () => {
  const files = [
    { path: "content/he/site-documents/homepage.he.json", json: { review: "pending" } },
    { path: "content/he/singlepages/limassol.he.json", json: { title: "לימסול" } },
  ];
  const result = checkReviewMetadata(files);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["content/he/singlepages/limassol.he.json"]);
});

test("checkReviewMetadata: an empty-string review value counts as missing", () => {
  const files = [{ path: "content/he/x.he.json", json: { review: "" } }];
  const result = checkReviewMetadata(files);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["content/he/x.he.json"]);
});

test("checkReviewMetadata: a non-object json (parse failure, array, null) counts as missing", () => {
  const files = [
    { path: "content/he/broken.he.json", json: null },
    { path: "content/he/array.he.json", json: [1, 2, 3] },
  ];
  const result = checkReviewMetadata(files);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.sort(), ["content/he/array.he.json", "content/he/broken.he.json"]);
});

// --- checkProtocols -----------------------------------------------------------

test("checkProtocols: every pack has a c-<pack>.md file in dir -> ok", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "he-launch-protocols-"));
  try {
    for (const p of ["site-documents", "faq"]) writeFileSync(path.join(dir, `c-${p}.md`), "# protocol\n");
    const result = checkProtocols(["site-documents", "faq"], dir);
    assert.deepEqual(result, { ok: true, missing: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkProtocols: a pack with no c-<pack>.md file is reported missing", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "he-launch-protocols-"));
  try {
    writeFileSync(path.join(dir, "c-site-documents.md"), "# protocol\n");
    const result = checkProtocols(["site-documents", "legal"], dir);
    assert.equal(result.ok, false);
    assert.deepEqual(result.missing, ["legal"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkProtocols: a non-existent directory reports every pack missing instead of throwing", () => {
  const result = checkProtocols(["site-documents", "faq"], path.join(tmpdir(), "does-not-exist-he-launch"));
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["site-documents", "faq"]);
});

test("checkProtocols: the real docs/i18n/reviews directory has all six PACKS protocols", () => {
  const reviewsDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "docs", "i18n", "reviews");
  const result = checkProtocols(PACKS, reviewsDir);
  assert.deepEqual(result, { ok: true, missing: [] });
});

// --- checkNginx -----------------------------------------------------------

test('checkNginx: a locale rule "(de|pl|ru|he)(/|$)" passes', () => {
  const conf = 'location ~ ^/(de|pl|ru|he)(/|$) { include /etc/nginx/snippets/cvp_proxy.conf; }';
  const result = checkNginx(conf);
  assert.equal(result.ok, true);
  assert.match(result.detail, /he/);
});

test('checkNginx: a locale rule missing "he" fails', () => {
  const conf = 'location ~ ^/(de|pl|ru)(/|$) { include /etc/nginx/snippets/cvp_proxy.conf; }';
  const result = checkNginx(conf);
  assert.equal(result.ok, false);
});

test("checkNginx: no locale-alternation rule at all fails", () => {
  const result = checkNginx("server { listen 443 ssl; }");
  assert.equal(result.ok, false);
});

test('checkNginx: is order-independent — "(he|pl|ru|de)(/|$)" still passes', () => {
  const conf = "location ~ ^/(he|pl|ru|de)(/|$) { proxy_pass http://app; }";
  assert.equal(checkNginx(conf).ok, true);
});

// --- summarize -----------------------------------------------------------

test("summarize: all PASS rows -> ok true, table has header + one row per check", () => {
  const results = [
    { check: "a", status: "PASS", detail: "fine" },
    { check: "bb", status: "PASS", detail: "also fine" },
  ];
  const { text, ok } = summarize(results);
  assert.equal(ok, true);
  assert.match(text, /check\s*\|\s*status\s*\|\s*detail/);
  assert.match(text, /a\s*\|\s*PASS\s*\|\s*fine/);
  assert.match(text, /bb\s*\|\s*PASS\s*\|\s*also fine/);
});

test("summarize: any FAIL row flips ok to false", () => {
  const results = [
    { check: "a", status: "PASS", detail: "fine" },
    { check: "b", status: "FAIL", detail: "broken" },
  ];
  const { ok } = summarize(results);
  assert.equal(ok, false);
});

test("summarize: an empty results array is vacuously ok", () => {
  const { ok } = summarize([]);
  assert.equal(ok, true);
});
