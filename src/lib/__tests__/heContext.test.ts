import { test } from "node:test";
import assert from "node:assert/strict";
import { sliceSections } from "@/lib/ai/heContext";

const fixture = `# Fixture title

Some front matter before the first heading.

## 1. First section

First content line.

## 2. Second section

Second content line.

## 3. Third section

Third content line.
`;

test("sliceSections keeps only sections whose heading starts with a wanted prefix", () => {
  const out = sliceSections(fixture, ["1", "3"]);
  assert.match(out, /## 1\. First section/);
  assert.match(out, /First content line\./);
  assert.match(out, /## 3\. Third section/);
  assert.match(out, /Third content line\./);
  assert.doesNotMatch(out, /## 2\. Second section/);
  assert.doesNotMatch(out, /Second content line\./);
});

test("sliceSections falls back to the full text when no prefix matches", () => {
  const out = sliceSections(fixture, ["9"]);
  assert.equal(out, fixture);
});

test("sliceSections matches a heading number followed by a space, not only a dot", () => {
  const spaced = "# Title\n\n## 1 Untitled\n\ncontent\n\n## 2. Second\n\nmore";
  const out = sliceSections(spaced, ["1"]);
  assert.match(out, /## 1 Untitled/);
  assert.doesNotMatch(out, /## 2\. Second/);
});

test("sliceSections does not confuse a single-digit prefix with a multi-digit heading number", () => {
  const numbered = "# Title\n\n## 1. First\n\ncontent\n\n## 10. Tenth\n\nmore";
  const out = sliceSections(numbered, ["1"]);
  assert.match(out, /## 1\. First/);
  assert.doesNotMatch(out, /## 10\. Tenth/);
});
