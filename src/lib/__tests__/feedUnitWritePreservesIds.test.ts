import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeFeedUnitsPreservingIds, type FeedUnitWriteClient } from "@/lib/feedUnitWrite";

/* Why this file exists (2026-10-24).
 *
 * Xellex reported that Cybarco units arrive with a new id every day. Measured
 * in the production DB the same day: all 442 Cybarco units, across 10
 * PUBLISHED developments, carried `createdAt` = that day — one single distinct
 * day for a developer live since September. cybarcoSync deleted every
 * `source: "feed"` row and re-created it each run, and the primary key is
 * `@default(uuid())`, so the bridge (payload.ts delivers `id: u.id`) handed the
 * second portal a completely fresh identifier set every night. It also made
 * the bridge's `changedSince` cursor worthless: `updatedAt` jumped for all 442
 * rows daily, so every incremental fetch re-delivered Cybarco in full.
 *
 * The repo already had the right behaviour in two of three pipelines —
 * feedSync's syncFeedUnitsPreservingUnlisted and plusPropertiesSync both match
 * on `ref` and UPDATE for published developments. Cybarco was the only one
 * wiping unconditionally. This module is that strategy, extracted so it can be
 * tested and shared, which is what was missing: nothing pinned id stability,
 * which is why it went unnoticed.
 *
 * In-memory prisma double, per this repo's rule: the local DATABASE_URL points
 * at PRODUCTION, so no test here may open a client. These arrays are the whole
 * database — and `deletes` exists to prove the strategy never issues one.
 */

type Row = Record<string, any>;

function fakeDb(existing: Row[] = []) {
  const rows: Row[] = existing.map((r) => ({ ...r }));
  const deletes: unknown[] = [];
  let nextId = 1000;

  // Typed as the real contract so the double cannot drift from it, with
  // `deleteMany` added on top — the strategy must never call it, and the only
  // way to assert that is to offer it.
  const db: FeedUnitWriteClient & { developmentUnit: { deleteMany(args: unknown): Promise<unknown> } } = {
    developmentUnit: {
      async findMany({ where }: { where: { developmentId: string; source: string } }) {
        return rows
          .filter((r) => r.developmentId === where.developmentId && r.source === where.source)
          .map((r) => ({ id: r.id, ref: r.ref ?? null, status: r.status ?? null, label: r.label ?? null, name: r.name ?? null }));
      },
      async update({ where, data }: { where: { id: string }; data: Row }) {
        const row = rows.find((r) => r.id === where.id);
        assert.ok(row, `update() for an unknown id ${where.id}`);
        Object.assign(row!, data);
        return { ...row! };
      },
      async create({ data }: { data: Row }) {
        // A fresh uuid, exactly like @default(uuid()) — so a test that expects
        // a preserved id cannot pass by accident.
        const row = { id: `new-${nextId++}`, source: "feed", ...data };
        rows.push(row);
        return { ...row };
      },
      async deleteMany(args: unknown) {
        deletes.push(args);
        return { count: 0 };
      },
    },
  };
  return { db, rows, deletes };
}

const DEV = "dev-1";
/** What cybarcoSync builds per unit, trimmed to what this strategy cares about. */
const row = (ref: string, over: Row = {}) => ({
  developmentId: DEV,
  ref,
  feedRef: ref,
  label: `Unit ${ref}`,
  status: "available",
  price: 500000,
  sortIndex: 0,
  ...over,
});

const stored = (id: string, ref: string, over: Row = {}) => ({
  id,
  developmentId: DEV,
  source: "feed",
  ref,
  status: "available",
  label: `Unit ${ref}`,
  name: null,
  price: 500000,
  ...over,
});

test("a second run with identical input keeps every id", async () => {
  // THE regression. Before this module, this is the assertion that would have
  // caught the Cybarco churn on the day it was introduced.
  const { db, rows, deletes } = fakeDb([stored("u-a", "A101"), stored("u-b", "A102")]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, [row("A101"), row("A102")]);

  assert.deepEqual(
    rows.map((r) => r.id).sort(),
    ["u-a", "u-b"],
    "the ids changed — Xellex sees two brand-new units",
  );
  assert.equal(res.created.length, 0, "nothing was new");
  assert.equal(res.updated, 2);
  assert.deepEqual(deletes, [], "the strategy must never delete");
});

test("a changed price is written in place, under the same id", async () => {
  const { db, rows } = fakeDb([stored("u-a", "A101")]);
  await writeFeedUnitsPreservingIds(db, DEV, [row("A101", { price: 480000 })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "u-a");
  assert.equal(rows[0].price, 480000);
});

test("a genuinely new ref is created, and reported", async () => {
  const { db, rows, deletes } = fakeDb([stored("u-a", "A101")]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, [row("A101"), row("A103")]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.ref === "A101")!.id, "u-a", "the known unit kept its id");
  assert.ok(rows.find((r) => r.ref === "A103")!.id.startsWith("new-"), "the new unit got a new id");
  assert.deepEqual(res.created, [{ ref: "A103", label: "Unit A103" }]);
  assert.deepEqual(deletes, []);
});

test("a ref that vanished from the feed is unlisted, not deleted", async () => {
  // Deleting it would be the old behaviour's only virtue — it disappeared from
  // the payload. Unlisting achieves the same (listedUnits() filters "unlisted",
  // so the bridge stops delivering it) while keeping the row, and therefore the
  // id, for when it comes back.
  const { db, rows, deletes } = fakeDb([stored("u-a", "A101"), stored("u-b", "A102")]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, [row("A101")]);
  assert.equal(rows.length, 2, "the row was removed instead of unlisted");
  assert.equal(rows.find((r) => r.ref === "A102")!.status, "unlisted");
  assert.equal(rows.find((r) => r.ref === "A102")!.id, "u-b", "the id must survive unlisting");
  assert.deepEqual(res.unlisted, [{ ref: "A102", label: "Unit A102" }]);
  assert.deepEqual(deletes, []);
});

test("a unit that comes back reuses its original id", async () => {
  const { db, rows } = fakeDb([stored("u-b", "A102", { status: "unlisted" })]);
  await writeFeedUnitsPreservingIds(db, DEV, [row("A102")]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "u-b", "a returning unit must not look new to the other portal");
  assert.equal(rows[0].status, "available");
});

test("a vanished unit that is already sold is left exactly as it is", async () => {
  // feedSync's rule, kept: "sold" is a hard statement and must not be softened
  // into "unlisted" by a feed that simply stopped listing the row.
  const { db, rows } = fakeDb([stored("u-c", "A104", { status: "sold" })]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, []);
  assert.equal(rows[0].status, "sold");
  assert.deepEqual(res.unlisted, []);
});

test("an already-unlisted vanished unit is not re-reported every run", async () => {
  // Otherwise the nightly digest would name the same unit forever.
  const { db } = fakeDb([stored("u-b", "A102", { status: "unlisted" })]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, []);
  assert.deepEqual(res.unlisted, []);
});

test("a stored row without a ref is never matched or unlisted", async () => {
  // No stable key means no safe decision: it cannot be matched to a fresh unit
  // and must not be unlisted either, or a row the admin created by hand before
  // refs existed would silently leave the site.
  const { db, rows } = fakeDb([stored("u-x", null as unknown as string)]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, [row("A101")]);
  assert.equal(rows.find((r) => r.id === "u-x")!.status, "available", "it was unlisted despite having no ref");
  assert.deepEqual(res.unlisted, []);
  assert.equal(res.created.length, 1);
});

test("a fresh unit without a ref is created rather than silently dropped", async () => {
  const { db, rows } = fakeDb([]);
  const res = await writeFeedUnitsPreservingIds(db, DEV, [row(null as unknown as string)]);
  assert.equal(rows.length, 1, "a unit with no ref vanished from the write");
  assert.equal(res.created.length, 1);
});

test("sortIndex follows the feed's order on both paths", async () => {
  const { db, rows } = fakeDb([stored("u-b", "A102")]);
  await writeFeedUnitsPreservingIds(db, DEV, [row("A101"), row("A102")]);
  assert.equal(rows.find((r) => r.ref === "A101")!.sortIndex, 0);
  assert.equal(rows.find((r) => r.ref === "A102")!.sortIndex, 1, "an updated unit kept a stale position");
});

test("cybarcoSync wipes only drafts, and uses the preserving write for published projects", () => {
  // The invariant that was missing. The strategy above is only worth having if
  // the pipeline that caused the incident actually calls it — and the wipe is
  // still correct for a draft, which has no external consumer.
  const src = readFileSync(join(process.cwd(), "src/lib/cybarcoSync.ts"), "utf8");
  assert.ok(/writeFeedUnitsPreservingIds\(prisma, dev\.id, unitRows\)/.test(src), "the preserving write is not called");
  assert.ok(/if \(published\) \{/.test(src), "the published/draft split is gone");

  const wipes = src.match(/developmentUnit\.deleteMany\([^)]*source: "feed"[^)]*\)/g) ?? [];
  assert.equal(wipes.length, 1, "there should be exactly one feed wipe left, in the draft branch");
  // And it must sit AFTER the `if (published)` branch, i.e. in the else.
  assert.ok(
    src.indexOf("if (published) {") < src.indexOf('developmentUnit.deleteMany({ where: { developmentId: dev.id, source: "feed" } })'),
    "the wipe is no longer inside the draft branch",
  );
});
