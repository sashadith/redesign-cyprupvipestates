import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadWhere, listBucketOf, LEAD_LIST_SOURCES } from "@/app/admin/(panel)/crm/filters";

/* 2026-10-08: partner leads moved from a block on the Leads page to a Partner
   page of their own. The two lists must be disjoint and together cover every
   non-newsletter lead. */

test("the leads list excludes newsletter AND partner leads", () => {
  const w = buildLeadWhere({});
  assert.deepEqual(w.AND, [{ source: { not: "NEWSLETTER" } }, { source: { not: "PARTNER" } }]);
});

test("the partner list holds only partner leads", () => {
  const w = buildLeadWhere({}, "partner");
  assert.deepEqual(w.AND, [{ source: "PARTNER" }]);
  assert.equal(w.deletedAt, null);
});

test("filters still apply on the partner page", () => {
  const w = buildLeadWhere({ status: "LOST", q: "x" }, "partner");
  assert.equal(w.status, "LOST");
  assert.ok(Array.isArray(w.OR));
});

test("the export route reads the bucket from the URL, defaulting to leads", () => {
  assert.equal(listBucketOf({ bucket: "partner" }), "partner");
  assert.equal(listBucketOf({}), "leads");
  assert.equal(listBucketOf({ bucket: "newsletter" }), "leads");
});

test("the leads page's source dropdown offers neither PARTNER nor NEWSLETTER", () => {
  assert.equal(LEAD_LIST_SOURCES.includes("PARTNER"), false);
  assert.equal(LEAD_LIST_SOURCES.includes("NEWSLETTER"), false);
});
