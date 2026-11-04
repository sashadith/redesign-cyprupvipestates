import test from "node:test";
import assert from "node:assert/strict";
import { stripBlurDataUrls } from "../stripBlur";

test("removes blurDataURL at any depth, keeps everything else, does not mutate", () => {
  const d = new Date(0);
  const input = {
    title: "x",
    n: 3,
    when: d,
    heroBlock: { posterImage: { asset: { url: "/a.jpg", blurDataURL: "data:image/jpeg;base64,AAAA" } } },
    list: [{ previewImage: { asset: { blurDataURL: "b", _ref: "r" } } }, null, "s"],
  };
  const snapshot = JSON.stringify(input);
  const out = stripBlurDataUrls(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(out, {
    title: "x",
    n: 3,
    when: d,
    heroBlock: { posterImage: { asset: { url: "/a.jpg" } } },
    list: [{ previewImage: { asset: { _ref: "r" } } }, null, "s"],
  });
  assert.equal(out.when, d);
});

test("passes primitives and null through", () => {
  assert.equal(stripBlurDataUrls(null), null);
  assert.equal(stripBlurDataUrls("a"), "a");
  assert.equal(stripBlurDataUrls(undefined), undefined);
});
