import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyImageUrls, coverImageUrl } from "@/lib/blog/articleImages";
import { absoluteUploadsUrl } from "@/lib/blog/blocksToMarkdown";
import { uploadsPathOf } from "@/lib/social/carousel/imagePolicy";

const SITE = "https://cyprusvipestates.com";
const text = (content: any[]) => ({ _type: "textContent", content });
const img = (ref: string, alt = "") => ({ _type: "image", alt, asset: { _ref: ref } });

test("cover: the previewImage ref as the absolute original under /uploads/images/", () => {
  assert.equal(
    coverImageUrl({ _type: "image", alt: "x", asset: { _ref: "image-d83805cddc8f80758da09a0617404d1d60223128-2000x1201-jpg", _type: "reference" } }),
    `${SITE}/uploads/images/d83805cddc8f80758da09a0617404d1d60223128-2000x1201.jpg`,
  );
  assert.equal(coverImageUrl({ asset: { url: "/uploads/images/abc-10x10.webp" } }), `${SITE}/uploads/images/abc-10x10.webp`);
});

test("cover: none, unknown or foreign -> null", () => {
  assert.equal(coverImageUrl(null), null);
  assert.equal(coverImageUrl(undefined), null);
  assert.equal(coverImageUrl({}), null);
  assert.equal(coverImageUrl({ asset: { _ref: "not-an-image" } }), null);
  assert.equal(coverImageUrl("https://images.example.com/a.jpg"), null);
});

test("absoluteUploadsUrl only takes /uploads/ paths", () => {
  assert.equal(absoluteUploadsUrl("/uploads/images/a.jpg"), `${SITE}/uploads/images/a.jpg`);
  assert.equal(absoluteUploadsUrl("/og/home.jpg"), null);
  assert.equal(absoluteUploadsUrl("https://evil.test/uploads/a.jpg"), null);
  assert.equal(absoluteUploadsUrl(null), null);
});

test("body images: every block type, in body order, each once", () => {
  const blocks = [
    text([img("image-aaa-1500x1000-jpg", "first"), { _type: "block", style: "normal", children: [{ _type: "span", text: "x" }], markDefs: [] }]),
    { _type: "doubleTextBlock", leftContent: { type: "image", image: { asset: { url: "/uploads/images/bbb.png" } } }, rightContent: null },
    { _type: "projectsSectionBlock", image: { asset: { _ref: "image-zzz-10x10-jpg" } } },
    { _type: "imageFullBlock", imageMain: { picture: { asset: { _ref: "image-ccc-1600x900-webp" } } } },
    text([img("image-aaa-1500x1000-jpg", "again")]),
  ];
  assert.deepEqual(bodyImageUrls(blocks), [
    `${SITE}/uploads/images/aaa-1500x1000.jpg`,
    `${SITE}/uploads/images/bbb.png`,
    `${SITE}/uploads/images/ccc-1600x900.webp`,
  ]);
});

test("body images: none -> []", () => {
  assert.deepEqual(bodyImageUrls(null), []);
  assert.deepEqual(bodyImageUrls([text([{ _type: "block", style: "normal", children: [{ _type: "span", text: "only text" }], markDefs: [] }])]), []);
});

test("the carousel image policy accepts blog image URLs (/uploads/images/) and still refuses /uploads/social/", () => {
  const cover = coverImageUrl({ asset: { _ref: "image-5bd236bf89e46b19672a974e63a5b6e8fdf927f2-1536x1024-jpg" } })!;
  assert.equal(uploadsPathOf(cover), "/uploads/images/5bd236bf89e46b19672a974e63a5b6e8fdf927f2-1536x1024.jpg");
  for (const u of bodyImageUrls([text([img("image-c8c7b1e3-1500x1000-jpg")])])) assert.ok(uploadsPathOf(u).startsWith("/uploads/images/"));
  assert.throws(() => uploadsPathOf(`${SITE}/uploads/social/2026-W45/x/slide-1.jpg`));
});
