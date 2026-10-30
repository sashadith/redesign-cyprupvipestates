// The extra-link buttons under a project's description. Two things here are
// load-bearing and neither is obvious from the shape of the data:
//
//  1. parseExtraLinks reads a Json column, so it may be handed anything an
//     older write or a hand-edited row left behind. One bad entry must not cost
//     the page its other buttons, and an unknown kind must not reach the
//     renderer — `t.extraLinks[kind]` would be undefined and the button would
//     render as an empty pill linking somewhere.
//  2. The href goes straight into the page, so a javascript:/data: URL has to be
//     refused at the door rather than sanitized later.
//
// Plus the contract that keeps the captions honest: every kind must have a
// label in all five languages. Omitting one is a type error at build time, but
// a build error is not a test, and HE in particular is easy to forget.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTRA_LINK_KINDS, extraLinksFromJson, isValidExtraLinkUrl, parseExtraLinks } from "@/lib/developmentExtraLinks";
import { DEVELOPMENT_STRINGS } from "@/lib/developmentCopy";

test("a valid list survives in input order", () => {
  const links = parseExtraLinks([
    { kind: "camera", url: "https://example.com/cam" },
    { kind: "video", url: "https://youtube.com/watch?v=x" },
  ]);
  assert.deepEqual(links, [
    { kind: "camera", url: "https://example.com/cam" },
    { kind: "video", url: "https://youtube.com/watch?v=x" },
  ]);
});

test("one bad entry does not cost the others their buttons", () => {
  const links = parseExtraLinks([
    { kind: "video", url: "https://example.com/v" },
    { kind: "brochure", url: "https://example.com/b" }, // retired/unknown kind
    null,
    "not an object",
    { kind: "tour360" }, // no url
    { kind: "camera", url: "https://example.com/c" },
  ]);
  assert.deepEqual(links.map((l) => l.kind), ["video", "camera"]);
});

test("a duplicate kind keeps the first, so one caption never points at two places", () => {
  const links = parseExtraLinks([
    { kind: "tour360", url: "https://first.example.com" },
    { kind: "tour360", url: "https://second.example.com" },
  ]);
  assert.deepEqual(links, [{ kind: "tour360", url: "https://first.example.com" }]);
});

test("every kind parse yields a kind that has a label in all five languages", () => {
  // The guard against a kind reaching the renderer with no caption: an
  // unlabelled kind renders an empty pill that still links somewhere.
  for (const kind of EXTRA_LINK_KINDS) {
    const [link] = parseExtraLinks([{ kind, url: "https://example.com" }]);
    assert.ok(link, `${kind} did not survive parsing`);
    for (const [lang, strings] of Object.entries(DEVELOPMENT_STRINGS)) {
      const label = strings.extraLinks[link.kind];
      assert.equal(typeof label, "string", `${lang} has no label for ${kind}`);
      assert.ok(label.trim().length > 0, `${lang}'s label for ${kind} is blank`);
    }
  }
});

test("every language also says the link opens in a new tab", () => {
  for (const [lang, strings] of Object.entries(DEVELOPMENT_STRINGS)) {
    assert.ok(strings.extraLinkNewTab.trim().length > 0, `${lang} has no new-tab wording`);
  }
});

test("only https:// is accepted", () => {
  assert.ok(isValidExtraLinkUrl("https://example.com/360"));
  assert.ok(isValidExtraLinkUrl("  https://example.com/360  "));

  for (const bad of [
    "http://example.com", // plain http — a mixed-content warning on our https page
    "example.com", // a bare domain would resolve relative to our own site
    "/uploads/tour", // same
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "HTTPS://example.com".replace("HTTPS", "ftp"),
    "",
    "   ",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isValidExtraLinkUrl(bad as unknown), false, `accepted ${String(bad)}`);
  }
});

test("a scheme-bearing hostile URL never reaches the page", () => {
  assert.deepEqual(parseExtraLinks([{ kind: "video", url: "javascript:alert(1)" }]), []);
});

test("non-arrays read as no links rather than throwing", () => {
  for (const v of [null, undefined, {}, "", 0, { kind: "video", url: "https://x.example.com" }]) {
    assert.deepEqual(parseExtraLinks(v as unknown), []);
  }
});

test("the form value round-trips, and empty stores as null", () => {
  const json = JSON.stringify([
    { kind: "video", url: "https://example.com/v" },
    { kind: "walkthrough", url: "https://example.com/w" },
  ]);
  assert.deepEqual(extraLinksFromJson(json), [
    { kind: "video", url: "https://example.com/v" },
    { kind: "walkthrough", url: "https://example.com/w" },
  ]);

  // null, not [] — the same null-when-empty convention the description and
  // promoBlocks fields in this override follow, so "nothing to render" reads
  // the same across the whole table.
  assert.equal(extraLinksFromJson("[]"), null);
  assert.equal(extraLinksFromJson(""), null);
  assert.equal(extraLinksFromJson("   "), null);
  assert.equal(extraLinksFromJson("{not json"), null);
  assert.equal(extraLinksFromJson(null), null);

  // A list whose every row is unusable stores as null too, rather than an
  // empty array that would read as "someone configured this".
  assert.equal(extraLinksFromJson(JSON.stringify([{ kind: "video", url: "nope" }])), null);
});
