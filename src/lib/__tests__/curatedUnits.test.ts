import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maySyncCreateUnits } from "@/lib/curatedUnits";

test("a sync may add units to a feed-only development", () => {
  assert.equal(maySyncCreateUnits([{ source: "feed" }, { source: "feed" }]), true);
  assert.equal(maySyncCreateUnits([]), true);
});

test("one manual unit makes the unit list curated", () => {
  assert.equal(maySyncCreateUnits([{ source: "feed" }, { source: "manual" }]), false);
});

test("the Drive sync skips unknown refs on a curated development", () => {
  const src = readFileSync("src/lib/driveAvailabilitySync.ts", "utf8");
  assert.match(src, /const mayCreate = maySyncCreateUnits\(existingUnits\);/);
  assert.match(src, /if \(!existing && !mayCreate\) continue;/);
});
