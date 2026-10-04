import { test } from "node:test";
import assert from "node:assert/strict";
import { relative, truncateText, untrusted, fmtDate } from "@/lib/mcp/format";

const now = new Date("2026-09-07T12:00:00Z");

test("relative labels past and future in the coarsest sensible unit", () => {
  assert.equal(relative(new Date("2026-09-07T11:59:40Z"), now), "just now");
  assert.equal(relative(new Date("2026-09-07T11:55:00Z"), now), "5 min ago");
  assert.equal(relative(new Date("2026-09-07T09:00:00Z"), now), "3 h ago");
  assert.equal(relative(new Date("2026-09-05T12:00:00Z"), now), "2 days ago");
  assert.equal(relative(new Date("2026-09-11T12:00:00Z"), now), "in 4 days");
  assert.equal(relative(new Date("2026-09-07T12:00:30Z"), now), "in 1 min");
});

test("truncateText cuts at max and flags it", () => {
  assert.deepEqual(truncateText("abc", 5), { text: "abc", truncated: false });
  assert.deepEqual(truncateText("abcdefgh", 5), { text: "abcde…", truncated: true });
  assert.equal(truncateText(null), null);
});

test("untrusted wraps lead-authored text under the explicit key", () => {
  assert.deepEqual(untrusted("hello"), { untrusted_content: "hello", truncated: false });
  assert.equal(untrusted(""), null);
});

test("fmtDate returns iso, Cyprus-local and relative", () => {
  const r = fmtDate(new Date("2026-09-07T09:00:00Z"));
  assert.equal(r?.iso, "2026-09-07T09:00:00.000Z");
  assert.match(r?.local ?? "", /2026/); // exact format comes from adminDateTime
  assert.equal(typeof r?.relative, "string");
  assert.equal(fmtDate(null), null);
});

test("relative picks the unit from the rounded value and honours the 60 s boundary", () => {
  assert.equal(relative(new Date("2026-09-07T11:59:00Z"), now), "just now");
  assert.equal(relative(new Date("2026-09-07T11:58:59Z"), now), "1 min ago");
  assert.equal(relative(new Date("2026-09-07T11:00:30Z"), now), "1 h ago");
  assert.equal(relative(new Date("2026-09-06T12:30:00Z"), now), "1 day ago");
  assert.equal(relative(new Date("2026-09-06T00:00:00Z"), now), "2 days ago");
  assert.equal(relative(new Date("2026-09-07T12:01:00Z"), now), "in 1 min");
});
