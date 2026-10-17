import { test } from "node:test";
import assert from "node:assert/strict";
import { hardDeletableLeadWhere, LEAD_HAS_DEALS_ERROR, emptyTrashMessage } from "@/lib/crm/hardDelete";

test("the purge filter keeps the caller's where and excludes leads with deals", () => {
  const cutoff = new Date("2026-07-01T00:00:00Z");
  assert.deepEqual(hardDeletableLeadWhere({ deletedAt: { lt: cutoff } }), {
    deletedAt: { lt: cutoff },
    deals: { none: {} },
  });
});

test("the deals guard cannot be overridden by the caller's where", () => {
  const where = hardDeletableLeadWhere({ deletedAt: { not: null }, deals: { some: {} } } as any);
  assert.deepEqual(where.deals, { none: {} });
});

test("the refusal copy is English and names the reason", () => {
  assert.equal(LEAD_HAS_DEALS_ERROR, "This lead has deals and cannot be deleted permanently.");
});

test("empty-trash message counts deleted leads and mentions the ones kept for their deals", () => {
  assert.equal(emptyTrashMessage(3, 0), "3 leads permanently deleted.");
  assert.equal(emptyTrashMessage(1, 0), "1 lead permanently deleted.");
  assert.equal(emptyTrashMessage(2, 1), "2 leads permanently deleted. 1 lead with deals kept in trash.");
  assert.equal(emptyTrashMessage(0, 2), "0 leads permanently deleted. 2 leads with deals kept in trash.");
});
