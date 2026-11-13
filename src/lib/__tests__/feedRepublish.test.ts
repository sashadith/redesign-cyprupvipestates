import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRepublishFromFeed } from "../feedRepublish";

const marked = { publishStatus: "archived", archivedMissingFromFeedAt: new Date("2026-11-13T10:00:00Z") };
const avail = [{ status: "sold" }, { status: "available" }];

test("an archived project that vanished from the feed comes back with an available unit → republish", () => {
  assert.equal(shouldRepublishFromFeed(marked, avail), true);
});

test("back in the feed but nothing buyable → stays archived", () => {
  assert.equal(shouldRepublishFromFeed(marked, [{ status: "sold" }, { status: "reserved" }]), false);
  assert.equal(shouldRepublishFromFeed(marked, []), false);
});

test("an archive without the marker (duplicate, dead sold-out page) is never undone by the feed", () => {
  assert.equal(shouldRepublishFromFeed({ publishStatus: "archived", archivedMissingFromFeedAt: null }, avail), false);
});

test("only archived rows are touched", () => {
  for (const s of ["draft", "ready", "published"]) {
    assert.equal(shouldRepublishFromFeed({ publishStatus: s, archivedMissingFromFeedAt: new Date() }, avail), false);
  }
  assert.equal(shouldRepublishFromFeed(null, avail), false);
});
