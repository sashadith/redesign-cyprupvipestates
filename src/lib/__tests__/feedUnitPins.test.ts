import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFeedUnitsPreservingIds, type FeedUnitWriteClient } from "@/lib/feedUnitWrite";

/* A pin is the developer's price list beating their own feed, per unit and per
   column (src/lib/unitPins.ts). What has to hold:

     - the pinned column keeps its stored value, every other column still
       follows the feed,
     - a pinned status survives the unit vanishing from the feed, which is the
       Island Blue case: they drop a reserved unit out of the units document
       altogether, and unlisting it would hide a unit still on offer,
     - nothing changes for a unit with no pins.

   In-memory prisma double, per this repo's rule: the local DATABASE_URL points
   at PRODUCTION, so no test here may open a client. */

type Row = Record<string, any>;

function fakeDb(existing: Row[]) {
  const rows: Row[] = existing.map((r) => ({ ...r }));
  const db: FeedUnitWriteClient = {
    developmentUnit: {
      async findMany({ where }) {
        return rows
          .filter((r) => r.developmentId === where.developmentId && r.source === where.source)
          .map((r) => ({ id: r.id, ref: r.ref ?? null, status: r.status ?? null, label: r.label ?? null, name: r.name ?? null, pinnedFields: r.pinnedFields ?? [] }));
      },
      async update({ where, data }) {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      async create({ data }) {
        const row = { id: `new-${rows.length + 1}`, source: "feed", ...data };
        rows.push(row);
        return row;
      },
    },
  };
  return { db, rows, byRef: (ref: string) => rows.find((r) => r.ref === ref)! };
}

const stored = (over: Row = {}): Row => ({
  id: "u1", developmentId: "d1", source: "feed", ref: "AVLPB006", label: "Block B · 006",
  status: "sold", price: 285000, areaBuilt: "82 m²", sortIndex: 3, pinnedFields: [], ...over,
});

test("a pinned status and price keep the price list's values, the rest follows the feed", async () => {
  const { db, byRef } = fakeDb([stored({ pinnedFields: ["status", "price"], status: "available", price: 285000 })]);
  // What the feed says today — wrong on both pinned columns, right on the area.
  await writeFeedUnitsPreservingIds(db, "d1", [
    { ref: "AVLPB006", label: "Block B · 006", status: "sold", price: 300000, areaBuilt: "84 m²" },
  ]);
  const u = byRef("AVLPB006");
  assert.equal(u.status, "available");
  assert.equal(u.price, 285000);
  assert.equal(u.areaBuilt, "84 m²"); // not pinned — still tracks the feed
  assert.equal(u.sortIndex, 0); // and so does the display order
  assert.equal(u.id, "u1"); // identity still preserved
});

test("only the pinned column is held back", async () => {
  const { db, byRef } = fakeDb([stored({ pinnedFields: ["status"], status: "reserved", price: 390000 })]);
  await writeFeedUnitsPreservingIds(db, "d1", [{ ref: "AVLPB006", status: "available", price: 400000 }]);
  const u = byRef("AVLPB006");
  assert.equal(u.status, "reserved");
  assert.equal(u.price, 400000);
});

test("a pinned status survives the unit disappearing from the feed", async () => {
  const { db, byRef } = fakeDb([stored({ pinnedFields: ["status"], status: "reserved" })]);
  const r = await writeFeedUnitsPreservingIds(db, "d1", []); // whole unit gone from today's pull
  assert.equal(byRef("AVLPB006").status, "reserved");
  assert.deepEqual(r.unlisted, []); // and the digest does not claim it was removed
});

test("a pinned price does not stop the feed unlisting a vanished unit", async () => {
  // The pin is per column: price is ours, the availability question is not.
  const { db, byRef } = fakeDb([stored({ pinnedFields: ["price"], status: "available" })]);
  const r = await writeFeedUnitsPreservingIds(db, "d1", []);
  assert.equal(byRef("AVLPB006").status, "unlisted");
  assert.equal(byRef("AVLPB006").price, 285000);
  assert.equal(r.unlisted.length, 1);
});

test("a unit with no pins is written exactly as before", async () => {
  const { db, byRef } = fakeDb([stored({ status: "available", price: 285000 })]);
  await writeFeedUnitsPreservingIds(db, "d1", [{ ref: "AVLPB006", status: "sold", price: 300000 }]);
  const u = byRef("AVLPB006");
  assert.equal(u.status, "sold");
  assert.equal(u.price, 300000);
  assert.equal(u.id, "u1");
});

test("a pin is not inherited by a new unit the feed brings in", async () => {
  const { db, rows } = fakeDb([stored({ pinnedFields: ["status"], status: "reserved" })]);
  await writeFeedUnitsPreservingIds(db, "d1", [
    { ref: "AVLPB006", status: "available" },
    { ref: "AVLPB007", status: "available", price: 390000 },
  ]);
  const fresh = rows.find((r) => r.ref === "AVLPB007")!;
  assert.equal(fresh.status, "available");
  assert.ok(!fresh.pinnedFields?.length);
});
