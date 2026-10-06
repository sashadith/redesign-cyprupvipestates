import { test } from "node:test";
import assert from "node:assert/strict";
import { collisionsFor, flagsFor } from "../ref-collision-check.mjs";
// The real normalization, not a stand-in: the whole point of the check is to
// agree with what the writers actually do, and normalizeRef's block-letter
// rules are narrow enough that a paraphrase would pass tests the writers fail.
import { normalizeRef } from "../../../src/lib/unitRef.ts";

let n = 0;
const u = (o = {}) => ({ id: `u${++n}`, ref: null, feedRef: null, label: null, price: null, status: "available", source: "feed", updatedAt: new Date("2026-10-01"), ...o });
const project = (units, o = {}) => ({ slug: "p", publicName: "Test Project", dev: "drive", publishStatus: "published", units, ...o });

test("distinct refs do not collide", () => {
  const p = project([u({ ref: "101" }), u({ ref: "102" }), u({ ref: "201" })]);
  assert.deepEqual(collisionsFor(p, normalizeRef), []);
});

test("Georgia 12's shape is caught: the block lives only in the label", () => {
  // Exactly the rows that cost Block B three weeks of wrong prices.
  const p = project([
    u({ ref: "101", label: "Block A · 101", price: 290000 }),
    u({ ref: "101", label: "Block B · 101", price: 275000 }),
  ]);
  const groups = collisionsFor(p, normalizeRef);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "101");
  assert.equal(groups[0].members.length, 2);
});

test("the fix clears it: a block letter in the ref survives normalization", () => {
  const p = project([
    u({ ref: "101", label: "Block A · 101" }),
    u({ ref: "B 101", label: "Block B · 101" }),
  ]);
  assert.deepEqual(collisionsFor(p, normalizeRef), []);
});

test("'Block A 101' and 'Block B 101' are two units, not one", () => {
  // normalizeRef drops the WORD block and keeps the letter precisely so these
  // stay apart. If that ever regresses, this check must not start reporting
  // every correctly-refd two-block project as broken.
  const p = project([u({ ref: "Block A 101" }), u({ ref: "Block B 101" })]);
  assert.deepEqual(collisionsFor(p, normalizeRef), []);
});

test("the redundant 'block a a101' spelling collides with 'a101' — one unit, two rows", () => {
  const p = project([u({ ref: "block a a101" }), u({ ref: "a101" })]);
  const groups = collisionsFor(p, normalizeRef);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "a101");
});

test("refs made only of filler words collapse onto the empty key", () => {
  // Both refs are truthy, so the writers do not skip them — they all land on "".
  const p = project([u({ ref: "Villa" }), u({ ref: "Unit" })]);
  const groups = collisionsFor(p, normalizeRef);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "");
  assert.ok(flagsFor(groups[0], p).includes("EMPTY-KEY"));
});

test("units without a ref are ignored — the writers never match them either", () => {
  const p = project([u({ ref: null }), u({ ref: null }), u({ ref: "101" })]);
  assert.deepEqual(collisionsFor(p, normalizeRef), []);
});

test("the feedRef keying is checked too, and a group found under both is reported once", () => {
  const both = project([u({ ref: "101", feedRef: "101" }), u({ ref: "101", feedRef: "101" })]);
  const g = collisionsFor(both, normalizeRef);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].keyings, ["ref", "feedRef||ref"]);

  // agg reads feedRef first, so distinct refs are no protection there.
  const feedOnly = project([u({ ref: "A1", feedRef: "7" }), u({ ref: "B2", feedRef: "7" })], { dev: "agg" });
  const g2 = collisionsFor(feedOnly, normalizeRef);
  assert.equal(g2.length, 1);
  assert.deepEqual(g2[0].keyings, ["feedRef||ref"]);
});

test("DIVERGED fires when the rows the writer treats as one already disagree", () => {
  const same = project([u({ ref: "101", price: 290000 }), u({ ref: "101", price: 290000 })]);
  assert.ok(!flagsFor(collisionsFor(same, normalizeRef)[0], same).includes("DIVERGED"));

  const price = project([u({ ref: "101", price: 290000 }), u({ ref: "101", price: 275000 })]);
  assert.ok(flagsFor(collisionsFor(price, normalizeRef)[0], price).includes("DIVERGED"));

  const status = project([u({ ref: "101", status: "available" }), u({ ref: "101", status: "sold" })]);
  assert.ok(flagsFor(collisionsFor(status, normalizeRef)[0], status).includes("DIVERGED"));
});

test("UNREACHABLE and PRUNABLE depend on the writer and on source", () => {
  const manual = project([u({ ref: "101", source: "manual" }), u({ ref: "101", source: "manual" })]);
  const fManual = flagsFor(collisionsFor(manual, normalizeRef)[0], manual);
  assert.ok(fManual.includes("UNREACHABLE"), "a drive project reconciles on the key, so one row is frozen");
  assert.ok(!fManual.includes("PRUNABLE"), "manual rows are the one thing pruning spares");

  const feed = project([u({ ref: "101", source: "feed" }), u({ ref: "101", source: "manual" })]);
  assert.ok(flagsFor(collisionsFor(feed, normalizeRef)[0], feed).includes("PRUNABLE"));

  // A project nothing reconciles by ref still has duplicate rows worth seeing,
  // but no sync will freeze or delete them.
  const plain = project([u({ ref: "101" }), u({ ref: "101" })], { dev: "manual" });
  const fPlain = flagsFor(collisionsFor(plain, normalizeRef)[0], plain);
  assert.ok(!fPlain.includes("UNREACHABLE"));
  assert.ok(!fPlain.includes("PRUNABLE"));
});

test("three rows on one key are one group, not two", () => {
  const p = project([u({ ref: "101" }), u({ ref: "101" }), u({ ref: "101" })]);
  const groups = collisionsFor(p, normalizeRef);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 3);
});

test("the two defects are told apart: same label = duplicate rows, different labels = different flats", () => {
  // The BBF shape: one flat written several times. Deleting rows is the cure.
  const dup = project([
    u({ ref: "303", label: "Block E · Nr. 303", price: 820000 }),
    u({ ref: "303", label: "Block E · Nr. 303", price: 820000 }),
  ]);
  const fDup = flagsFor(collisionsFor(dup, normalizeRef)[0], dup);
  assert.ok(fDup.includes("DUPLICATE-ROWS"));
  assert.ok(!fDup.includes("DISTINCT-UNITS"));

  // The Georgia 12 shape: two real flats under one key. Re-reffing is the cure.
  const two = project([
    u({ ref: "101", label: "Block C · Nr. 101", price: 344000 }),
    u({ ref: "101", label: "Block E · Nr. 101", price: 345000 }),
  ]);
  const fTwo = flagsFor(collisionsFor(two, normalizeRef)[0], two);
  assert.ok(fTwo.includes("DISTINCT-UNITS"));
  assert.ok(!fTwo.includes("DUPLICATE-ROWS"));
});

test("a missing label does not masquerade as a distinct unit", () => {
  // Two unlabelled rows are indistinguishable, so they read as duplicates
  // rather than as two flats we cannot tell apart.
  const p = project([u({ ref: "101", label: null }), u({ ref: "101", label: null })]);
  assert.ok(flagsFor(collisionsFor(p, normalizeRef)[0], p).includes("DUPLICATE-ROWS"));
});
