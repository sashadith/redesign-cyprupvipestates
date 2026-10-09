// The Xellex bridge's pagination cursor.
//
// Why this file exists at all: the cursor was first written to carry only the
// last id of a page, with `generatedAt` stamped fresh on every request. That
// loses data silently. A project that starts qualifying partway through a
// paginated run, with an id below the cursor already passed, is skipped in
// that run — and is recovered only if the client's next `updatedSince` is the
// FIRST page's `generatedAt`. A client that keeps the last page's stamp, which
// is the only thing a client will actually do, drops that project forever with
// nothing logged anywhere. So "one stamp per run, echoed unchanged" is the
// contract, and the first two tests are that contract rather than a unit test
// of base64.
//
// Pure codec — no DB, no request, no filesystem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCursor, encodeCursor } from "@/lib/bridge/cursor";

const ID = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

test("the run's generatedAt survives the round trip to the millisecond", () => {
  // Not truncated to the second: two pages of one run must compare equal, and
  // `updatedSince` is a strict `>`, so a lost millisecond re-delivers or skips.
  const g = new Date("2026-10-09T11:00:00.123Z");
  const back = decodeCursor(encodeCursor(g, null, ID));
  assert.ok(back);
  assert.equal(back.generatedAt.getTime(), g.getTime());
  assert.equal(back.id, ID);
});

test("a full export's null updatedSince stays null, and is not coerced to an epoch", () => {
  // `since: null` means "everything". A 1970 Date would also mean everything
  // today and would quietly stop meaning it the moment the query changed.
  const back = decodeCursor(encodeCursor(new Date("2026-10-09T11:00:00.000Z"), null, ID));
  assert.ok(back);
  assert.equal(back.since, null);
});

test("an incremental run's updatedSince survives, so the route can refuse a spliced cursor", () => {
  const since = new Date("2026-10-07T00:00:00.000Z");
  const back = decodeCursor(encodeCursor(new Date(), since, ID));
  assert.ok(back);
  assert.equal(back.since?.getTime(), since.getTime());
});

test("the cursor is URL-safe, because it travels in a query string", () => {
  const raw = encodeCursor(new Date("2026-10-09T11:00:00.000Z"), new Date("2026-10-07T00:00:00.000Z"), ID);
  assert.equal(/^[A-Za-z0-9_-]+$/.test(raw), true, `not URL-safe: ${raw}`);
  assert.equal(encodeURIComponent(raw), raw);
});

test("the cursor is opaque — the id is not readable without decoding", () => {
  assert.equal(encodeCursor(new Date(), null, ID).includes(ID), false);
});

test("garbage is rejected rather than half-read", () => {
  // Buffer.from(…, "base64url") does NOT throw on invalid input, it discards
  // the bad bytes — so every one of these reaches JSON.parse or the field
  // checks, and that is the actual gate.
  for (const bad of [
    "",
    "!!!not-base64!!!",
    "cursor",
    ID,                                           // a bare uuid
    Buffer.from(ID, "utf8").toString("base64url"), // base64 of a bare uuid
    "e30",                                        // {}
    encodeCursor(new Date(), null, ID).slice(0, 12), // truncated
  ]) {
    assert.equal(decodeCursor(bad), null, `accepted: ${JSON.stringify(bad)}`);
  }
});

test("a forged or stale cursor shape is rejected, field by field", () => {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64url");
  const g = "2026-10-09T11:00:00.000Z";
  const cases: Record<string, unknown> = {
    "wrong version": { v: 9, g, s: null, i: ID },
    "missing version": { g, s: null, i: ID },
    "an array, not an object": [1, 2, 3],
    "a non-uuid id": { v: 1, g, s: null, i: "' OR 1=1 --" },
    "a numeric id": { v: 1, g, s: null, i: 42 },
    "an unparseable generatedAt": { v: 1, g: "yesterday", s: null, i: ID },
    "a numeric generatedAt": { v: 1, g: 1760000000000, s: null, i: ID },
    "an unparseable since": { v: 1, g, s: "soon", i: ID },
  };
  for (const [label, body] of Object.entries(cases)) {
    assert.equal(decodeCursor(enc(body)), null, `accepted ${label}`);
  }
});

test("JSON that is not an object at all is rejected", () => {
  for (const body of ["null", "7", '"a string"', "true"]) {
    assert.equal(decodeCursor(Buffer.from(body, "utf8").toString("base64url")), null, `accepted ${body}`);
  }
});
